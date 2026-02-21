# Person Photo Resolution Spec

This spec defines how a generator resolves the `photo` for person markdown files.

## Scope

- Applies to `*.md` files under `royal-family-files`.
- Excludes relationship metadata files named `_marriage.md`.

## Inputs

- `filePath`: absolute path to a person markdown file.
- Frontmatter: optional YAML-like block between leading `---` lines.

## Output

For each person file, produce:

- `personFile`: workspace-relative markdown path.
- `photo`: resolved photo value as either:
  - absolute URL (`http://` or `https://`), or
  - workspace-relative path to a local image file, or
  - `null` when no match exists.
- `source`:
  - `frontmatter` when `photo:` is explicitly set,
  - `sibling-fallback` when auto-discovered from sibling image file,
  - `none` when unresolved.

## Resolution algorithm

1. Parse frontmatter from the markdown file (if present).
2. If frontmatter contains `photo` and it is non-empty:
   - If value starts with `http://` or `https://`, use it as-is (`source=frontmatter`).
   - Otherwise resolve it relative to the markdown file directory.
     - If file exists, use that path (`source=frontmatter`).
     - If file does not exist, continue to fallback search.
3. Fallback search in exact order, using same basename as markdown file:
   1. `.png`
   2. `.jpg`
   3. `.jpeg`
   4. `.webp`
   5. `.avif`
4. Return the first existing sibling match as `photo` (`source=sibling-fallback`).
5. If none found, return `photo=null` (`source=none`).

## Notes

- Filenames are matched exactly, including case and spaces.
- This keeps authoring simple in GitHub UI: editors can add `<Person Name>.png` beside `<Person Name>.md` with no frontmatter edits.
