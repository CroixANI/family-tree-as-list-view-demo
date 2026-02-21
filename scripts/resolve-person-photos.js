#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXT_FALLBACK_ORDER = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];
const DEFAULT_ROOT = 'royal-family-files';

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(fullPath);
    }
  }
  return out;
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return {};

  const endMarker = '\n---\n';
  const endIdx = markdown.indexOf(endMarker, 4);
  if (endIdx === -1) return {};

  const fmBody = markdown.slice(4, endIdx);
  const lines = fmBody.split('\n');
  const data = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sepIdx = line.indexOf(':');
    if (sepIdx <= 0) continue;

    const key = line.slice(0, sepIdx).trim();
    const value = line.slice(sepIdx + 1).trim();
    data[key] = value;
  }

  return data;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function normalizePhotoValue(value) {
  if (!value) return '';
  let cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function resolvePhotoForPerson(personFileAbs, workspaceRootAbs) {
  const markdown = fs.readFileSync(personFileAbs, 'utf8');
  const frontmatter = parseFrontmatter(markdown);
  const personDir = path.dirname(personFileAbs);
  const base = path.basename(personFileAbs, '.md');

  const photoFromFrontmatter = normalizePhotoValue(frontmatter.photo || '');

  if (photoFromFrontmatter) {
    if (isHttpUrl(photoFromFrontmatter)) {
      return { photo: photoFromFrontmatter, source: 'frontmatter' };
    }

    const resolvedLocal = path.resolve(personDir, photoFromFrontmatter);
    if (fs.existsSync(resolvedLocal)) {
      return {
        photo: path.relative(workspaceRootAbs, resolvedLocal).split(path.sep).join('/'),
        source: 'frontmatter'
      };
    }
  }

  for (const ext of IMAGE_EXT_FALLBACK_ORDER) {
    const sibling = path.join(personDir, `${base}${ext}`);
    if (fs.existsSync(sibling)) {
      return {
        photo: path.relative(workspaceRootAbs, sibling).split(path.sep).join('/'),
        source: 'sibling-fallback'
      };
    }
  }

  return { photo: null, source: 'none' };
}

function isPersonMarkdown(fileAbs) {
  if (path.basename(fileAbs) === '_marriage.md') return false;

  const markdown = fs.readFileSync(fileAbs, 'utf8');
  const frontmatter = parseFrontmatter(markdown);
  return Boolean(normalizePhotoValue(frontmatter.full_name || ''));
}

function main() {
  const workspaceRootAbs = process.cwd();
  const rootArg = process.argv[2] || DEFAULT_ROOT;
  const rootAbs = path.resolve(workspaceRootAbs, rootArg);

  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
    console.error(`Input folder not found or not a directory: ${rootArg}`);
    process.exit(1);
  }

  const allMarkdownFiles = walk(rootAbs)
    .filter(isPersonMarkdown)
    .sort((a, b) => a.localeCompare(b));

  const people = allMarkdownFiles.map(personFileAbs => {
    const relPersonFile = path.relative(workspaceRootAbs, personFileAbs).split(path.sep).join('/');
    const result = resolvePhotoForPerson(personFileAbs, workspaceRootAbs);

    return {
      personFile: relPersonFile,
      photo: result.photo,
      source: result.source
    };
  });

  const summary = {
    totalPeople: people.length,
    resolvedByFrontmatter: people.filter(p => p.source === 'frontmatter').length,
    resolvedByFallback: people.filter(p => p.source === 'sibling-fallback').length,
    unresolved: people.filter(p => p.source === 'none').length
  };

  console.log(JSON.stringify({ summary, people }, null, 2));
}

main();
