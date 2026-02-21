#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];
const DEFAULT_DATA_DIR = 'royal-family-files';
const SIZE = 240;

function walkMarkdown(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return {};
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return {};

  const fm = markdown.slice(4, end);
  const data = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    data[m[1]] = String(m[2] || '').trim();
  }
  return data;
}

function isPersonFile(mdFile) {
  if (path.basename(mdFile) === '_marriage.md') return false;
  const text = fs.readFileSync(mdFile, 'utf8');
  const fm = parseFrontmatter(text);
  return Boolean(fm.full_name);
}

function hasAnySiblingPhoto(mdFile) {
  const base = path.join(path.dirname(mdFile), path.basename(mdFile, '.md'));
  return IMAGE_EXTS.some(ext => fs.existsSync(`${base}${ext}`));
}

function download(url, outputPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, outputPath));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', err => reject(err));
    });

    req.on('error', err => reject(err));
    req.setTimeout(20000, () => req.destroy(new Error('Request timeout')));
  });
}

async function main() {
  const root = process.cwd();
  const dataDirArg = process.argv[2] || DEFAULT_DATA_DIR;
  const force = process.argv.includes('--force');
  const dataDir = path.resolve(root, dataDirArg);

  if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
    console.error(`Family directory not found: ${dataDirArg}`);
    process.exit(1);
  }

  const personFiles = walkMarkdown(dataDir)
    .filter(isPersonFile)
    .sort((a, b) => a.localeCompare(b));

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const mdFile of personFiles) {
    const mdText = fs.readFileSync(mdFile, 'utf8');
    const fm = parseFrontmatter(mdText);
    const fullName = fm.full_name || path.basename(mdFile, '.md');

    if (!force && hasAnySiblingPhoto(mdFile)) {
      skipped += 1;
      continue;
    }

    const jpgPath = path.join(path.dirname(mdFile), `${path.basename(mdFile, '.md')}.jpg`);
    const url = `https://i.pravatar.cc/${SIZE}?u=${encodeURIComponent(fullName)}`;

    try {
      await download(url, jpgPath);
      created += 1;
      console.log(`created ${path.relative(root, jpgPath)}`);
    } catch (error) {
      errors.push({ file: mdFile, message: error.message });
      console.error(`failed ${path.relative(root, mdFile)}: ${error.message}`);
    }
  }

  console.log(`\nSummary: total=${personFiles.length}, created=${created}, skipped=${skipped}, errors=${errors.length}`);

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
