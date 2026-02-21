# Family Tree Static Site (Eleventy)

This project builds a static family-tree website from folder-based markdown data.

## Install

```bash
npm install
```

## Build

Default source folder:

```bash
npm run build
```

The generated static site is written to `output/`.

Use a different family folder:

```bash
FAMILY_DATA_DIR=my-family-files npm run build
```

Optionally select an explicit root person:

```bash
FAMILY_DATA_DIR=my-family-files FAMILY_ROOT_PERSON="Jane Doe" npm run build
```

Build for a GitHub Pages project path (for example `/my-repo/`):

```bash
ELEVENTY_PATH_PREFIX=/my-repo/ npm run build
```

## Run locally

```bash
npm start
```

## Source data format

- Person file: `Person Name.md`
- Marriage folder: `Person A & Person B/` containing `_marriage.md`
- Children: person files inside the marriage folder

## Photos

Default (no frontmatter changes needed):

- Place sibling image with same basename as person markdown file.
- Fallback extension order is:
  1. `.png`
  2. `.jpg`
  3. `.jpeg`
  4. `.webp`
  5. `.avif`

Optional override in frontmatter:

```yaml
photo: ./Person Name.png
```

or

```yaml
photo: https://example.com/person.png
```

Generate demo photos automatically for the current royal dataset:

```bash
npm run photos:demo
```

## GitHub Pages

A workflow is provided at `.github/workflows/deploy-pages.yml`.
It builds the site and deploys `output/` to GitHub Pages.
