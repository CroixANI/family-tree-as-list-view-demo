# Family Tree Static Site (Eleventy)

This project builds a static family-tree website from folder-based markdown data.

## Install

```bash
npm install
```

## Configure with `.env` (recommended)

Copy the template and edit values as needed:

```bash
cp .env.example .env
```

Environment variables (all optional):

- `FAMILY_DATA_DIR` (default: `examples/royal-family-files`)
- `FAMILY_ROOT_PERSON` (default: empty; auto-picks root)
- `SITE_INPUT_DIR` (default: `site`)
- `SITE_INCLUDES_DIR` (default: `_includes`)
- `SITE_DATA_DIR` (default: `_data`)
- `SITE_OUTPUT_DIR` (default: `output`)
- `AVATARS_SUBDIR` (default: `avatars`)
- `ELEVENTY_PATH_PREFIX` (default: `/`)

## Build

With `.env` defaults:

```bash
npm run build
```

The generated static site is written to `SITE_OUTPUT_DIR` (default `output/`).

Override a value ad-hoc without editing `.env`:

```bash
FAMILY_DATA_DIR=examples/my-family-files npm run build
```

Optionally select an explicit root person:

```bash
FAMILY_DATA_DIR=examples/my-family-files FAMILY_ROOT_PERSON="Jane Doe" npm run build
```

Build for a GitHub Pages project path (for example `/my-repo/`):

```bash
ELEVENTY_PATH_PREFIX=/my-repo/ npm run build
```

Quick test with the fake Smith dataset:

```bash
FAMILY_DATA_DIR=examples/smith-family-files npm run build
```

## Run locally

```bash
npm start
```

Important: `npm run start` (`eleventy --serve`) also rebuilds from source, so it uses the same env vars as build.

Use a non-default family source while serving:

```bash
FAMILY_DATA_DIR=examples/smith-family-files npm run start
```

Open a specific person by ID (auto-expand ancestors + highlight row):

```text
http://localhost:8082/?pid=<person-id>
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

If no photo is resolved for a person, the UI shows initials in the avatar circle.

## Stable Person IDs and Avatar Output

- Each person markdown file is expected to have `full_name` in frontmatter.
- During build, if `id` is missing in a person file, it is auto-generated and written back once.
- Existing `id` values are preserved.
- Local person photos are copied to:
  - `<SITE_OUTPUT_DIR>/<AVATARS_SUBDIR>/<person-id>.<ext>`
- Generated HTML uses `/<AVATARS_SUBDIR>/<person-id>.<ext>` paths (with Eleventy path prefix applied).

Generate demo photos automatically for the current royal dataset:

```bash
npm run photos:demo
```

Download public photos (Wikipedia/Wikimedia) into sibling files and remove `photo:` URLs from frontmatter:

```bash
npm run photos:public
```

## GitHub Pages

A workflow is provided at `.github/workflows/deploy-pages.yml`.
It builds the site and deploys `SITE_OUTPUT_DIR` to GitHub Pages.

For CI configuration, set repository Variables in GitHub (`Settings -> Secrets and variables -> Actions -> Variables`) such as:

- `FAMILY_DATA_DIR`
- `FAMILY_ROOT_PERSON`
- `SITE_OUTPUT_DIR`
- `AVATARS_SUBDIR`
