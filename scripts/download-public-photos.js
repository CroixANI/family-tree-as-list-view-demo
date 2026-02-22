#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getProjectConfig } = require('../config/env');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];
const SUPPORTED_EXTS = new Set(IMAGE_EXTS);
const CONTENT_TYPE_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif'
};
const MAX_REDIRECTS = 6;

const WIKIPEDIA_TITLES_BY_NAME = Object.freeze({
  'King George VI': 'George_VI',
  'Queen Elizabeth, The Queen Mother': 'Queen_Elizabeth_The_Queen_Mother',
  'Queen Elizabeth II': 'Elizabeth_II',
  'Prince Philip, Duke of Edinburgh': 'Prince_Philip,_Duke_of_Edinburgh',
  'Princess Margaret, Countess of Snowdon': 'Princess_Margaret,_Countess_of_Snowdon',
  'King Charles III': 'Charles_III',
  'Diana, Princess of Wales': 'Diana,_Princess_of_Wales',
  'Queen Camilla': 'Queen_Camilla',
  'Anne, Princess Royal': 'Anne,_Princess_Royal',
  'Prince Andrew, Duke of York': 'Prince_Andrew,_Duke_of_York',
  'Prince Edward, Duke of Edinburgh': 'Prince_Edward,_Duke_of_Edinburgh',
  'William, Prince of Wales': 'William,_Prince_of_Wales',
  'Catherine, Princess of Wales': 'Catherine,_Princess_of_Wales',
  'Prince Harry, Duke of Sussex': 'Prince_Harry,_Duke_of_Sussex',
  'Meghan, Duchess of Sussex': 'Meghan,_Duchess_of_Sussex',
  'Prince George of Wales': 'Prince_George_of_Wales',
  'Princess Charlotte of Wales': 'Princess_Charlotte_of_Wales_(born_2015)',
  'Prince Louis of Wales': 'Prince_Louis_of_Wales',
  'Prince Archie of Sussex': 'Prince_Archie_of_Sussex',
  'Princess Lilibet of Sussex': 'Princess_Lilibet_of_Sussex'
});

function walkMarkdown(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function splitFrontmatter(markdownText) {
  if (!markdownText.startsWith('---\n')) return null;

  const endMarker = '\n---\n';
  const endIdx = markdownText.indexOf(endMarker, 4);
  if (endIdx === -1) return null;

  return {
    frontmatter: markdownText.slice(4, endIdx),
    body: markdownText.slice(endIdx + endMarker.length)
  };
}

function cleanScalar(value) {
  let trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseSimpleFrontmatterMap(frontmatterText) {
  const data = {};
  for (const line of frontmatterText.split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    data[kv[1]] = cleanScalar(kv[2]);
  }
  return data;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function extFromUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const ext = path.extname(parsed.pathname).toLowerCase();
    return SUPPORTED_EXTS.has(ext) ? ext : '';
  } catch {
    return '';
  }
}

function extFromContentType(contentType) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[normalized] || '';
}

function request(urlString, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      reject(new Error('Too many redirects'));
      return;
    }

    const req = https.get(urlString, {
      headers: {
        'User-Agent': 'family-tree-photo-fetcher/1.0',
        ...headers
      }
    }, res => {
      const status = res.statusCode || 0;

      if (status >= 300 && status < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, urlString).toString();
        res.resume();
        resolve(request(nextUrl, headers, redirects + 1));
        return;
      }

      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || '',
          finalUrl: urlString
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

async function requestJson(urlString) {
  const response = await request(urlString, { Accept: 'application/json' });
  return JSON.parse(response.buffer.toString('utf8'));
}

async function resolveWikipediaThumbnail(personName) {
  const title = WIKIPEDIA_TITLES_BY_NAME[personName] || '';
  if (!title) return null;

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await requestJson(summaryUrl);
  const thumbnailUrl = cleanScalar(data && data.thumbnail && data.thumbnail.source);

  if (!thumbnailUrl || !isHttpUrl(thumbnailUrl)) return null;

  return thumbnailUrl;
}

function updateFrontmatterRemovingPhoto(markdownText) {
  const parsed = splitFrontmatter(markdownText);
  if (!parsed) return markdownText;

  const lines = parsed.frontmatter.split('\n');
  const filtered = lines.filter(line => !/^\s*photo:\s*/.test(line));
  const nextFrontmatter = filtered.join('\n');
  return `---\n${nextFrontmatter}\n---\n${parsed.body}`;
}

function hasAnySiblingPhoto(basePath) {
  return IMAGE_EXTS.some(ext => fs.existsSync(`${basePath}${ext}`));
}

async function downloadToBasePath(photoUrl, basePath) {
  const fetched = await request(photoUrl, { Accept: 'image/*,*/*;q=0.8' });
  const ext = extFromUrl(photoUrl) || extFromUrl(fetched.finalUrl) || extFromContentType(fetched.contentType) || '.jpg';
  const outPath = `${basePath}${ext}`;
  fs.writeFileSync(outPath, fetched.buffer);
  return outPath;
}

async function main() {
  const workspaceRootAbs = process.cwd();
  const config = getProjectConfig(workspaceRootAbs);
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const sourceDirRel = args.find(arg => arg !== '--force') || config.familyDataDir;
  const sourceDirAbs = path.resolve(workspaceRootAbs, sourceDirRel);

  if (!fs.existsSync(sourceDirAbs) || !fs.statSync(sourceDirAbs).isDirectory()) {
    console.error(`Family data directory not found: ${sourceDirRel}`);
    process.exit(1);
  }

  const personFiles = walkMarkdown(sourceDirAbs)
    .filter(file => path.basename(file) !== '_marriage.md')
    .sort((a, b) => a.localeCompare(b));

  let totalPeople = 0;
  let downloaded = 0;
  let downloadedFromFrontmatter = 0;
  let downloadedFromWikipedia = 0;
  let skippedExisting = 0;
  let missingImage = 0;
  let frontmatterUpdated = 0;
  const errors = [];

  for (const mdPath of personFiles) {
    const markdown = fs.readFileSync(mdPath, 'utf8');
    const split = splitFrontmatter(markdown);
    if (!split) continue;

    const meta = parseSimpleFrontmatterMap(split.frontmatter);
    const fullName = cleanScalar(meta.full_name);
    if (!fullName) continue;

    totalPeople += 1;
    const basePath = path.join(path.dirname(mdPath), path.basename(mdPath, '.md'));
    const explicitPhoto = cleanScalar(meta.photo);

    if (!force && hasAnySiblingPhoto(basePath)) {
      skippedExisting += 1;

      const rewrittenExisting = updateFrontmatterRemovingPhoto(markdown);
      if (rewrittenExisting !== markdown) {
        fs.writeFileSync(mdPath, rewrittenExisting, 'utf8');
        frontmatterUpdated += 1;
      }
      continue;
    }

    let saved = false;

    if (isHttpUrl(explicitPhoto)) {
      try {
        const outPath = await downloadToBasePath(explicitPhoto, basePath);
        console.log(`downloaded ${path.relative(workspaceRootAbs, outPath)} (frontmatter)`);
        downloaded += 1;
        downloadedFromFrontmatter += 1;
        saved = true;
      } catch (error) {
        // Fall back to wikipedia summary thumbnail below.
      }
    }

    if (!saved) {
      try {
        const wikiThumb = await resolveWikipediaThumbnail(fullName);
        if (wikiThumb) {
          const outPath = await downloadToBasePath(wikiThumb, basePath);
          console.log(`downloaded ${path.relative(workspaceRootAbs, outPath)} (wikipedia-summary)`);
          downloaded += 1;
          downloadedFromWikipedia += 1;
          saved = true;
        }
      } catch (error) {
        // Ignore and treat as missing image.
      }
    }

    if (!saved) {
      missingImage += 1;
      if (isHttpUrl(explicitPhoto) || WIKIPEDIA_TITLES_BY_NAME[fullName]) {
        errors.push({ file: mdPath, message: 'No downloadable public image found' });
        console.error(`missing image ${path.relative(workspaceRootAbs, mdPath)}`);
      }
    }

    const rewritten = updateFrontmatterRemovingPhoto(markdown);
    if (rewritten !== markdown) {
      fs.writeFileSync(mdPath, rewritten, 'utf8');
      frontmatterUpdated += 1;
    }
  }

  console.log(`\nSummary: people=${totalPeople}, downloaded=${downloaded}, from_frontmatter=${downloadedFromFrontmatter}, from_wikipedia=${downloadedFromWikipedia}, skipped_existing=${skippedExisting}, missing_image=${missingImage}, frontmatter_updated=${frontmatterUpdated}`);

  if (errors.length > 0) {
    console.log(`Warnings: ${errors.length} person records ended without a local image.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
