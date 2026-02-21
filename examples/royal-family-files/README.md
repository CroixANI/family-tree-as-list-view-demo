# Royal Family Files

This folder stores source data for a future static-site generator.

## Data model

- Each person is one Markdown file (`<Person Name>.md`).
- Each marriage/partnership is one folder (`<Person A> & <Person B>/`) with `_marriage.md`.
- Children of that union are Markdown files inside that marriage folder.

## Photo convention

Default behavior (recommended for easy GitHub UI editing):

1. Do **not** add a `photo:` field.
2. Put the image file next to the person's Markdown file with the same base name.
   Example:
   - `King George V.md`
   - `King George V.png`

Image extensions to try in order:

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.avif`

Optional override:

- If `photo:` is present in frontmatter, the generator should use it directly.
- `photo:` may be a relative local path (for example `./King George V.png`) or an absolute URL.

## External spouse links

- Use `external_url` in a person file when the spouse should link to another documented family.
