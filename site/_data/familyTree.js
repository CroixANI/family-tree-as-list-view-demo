'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MarkdownItModule = require('markdown-it');
const MarkdownIt = MarkdownItModule.default || MarkdownItModule;

const IMAGE_EXT_FALLBACK_ORDER = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];
const OUTPUT_AVATARS_DIR = path.join('output', 'avatars');
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walkMarkdown(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(fullPath);
    }
  }
  return out;
}

function cleanScalar(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function extractFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return { data: {}, body: markdown };
  }

  const closing = '\n---\n';
  const closingIndex = markdown.indexOf(closing, 4);
  if (closingIndex === -1) {
    return { data: {}, body: markdown };
  }

  const frontmatterText = markdown.slice(4, closingIndex);
  const body = markdown.slice(closingIndex + closing.length);
  const lines = frontmatterText.split('\n');
  const data = {};
  let currentArrayKey = null;

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

    const listMatch = rawLine.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentArrayKey) {
      const itemValue = listMatch[1].trim();
      const objectItem = itemValue.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);

      if (objectItem && currentArrayKey === 'partners') {
        data[currentArrayKey].push({
          [objectItem[1]]: cleanScalar(objectItem[2])
        });
      } else {
        data[currentArrayKey].push(cleanScalar(itemValue));
      }
      continue;
    }

    const kvMatch = rawLine.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const value = kvMatch[2];

    if (value.trim() === '') {
      data[key] = [];
      currentArrayKey = key;
    } else {
      data[key] = cleanScalar(value);
      currentArrayKey = null;
    }
  }

  return { data, body };
}

function ensurePersonId(personAbsPath, rawMarkdown, parsedData) {
  const existing = cleanScalar(parsedData.id || '');
  if (existing) return existing;

  const generated = crypto.randomUUID();

  if (!rawMarkdown.startsWith('---\n')) {
    const updatedNoFm = `---\nid: ${generated}\n---\n\n${rawMarkdown}`;
    fs.writeFileSync(personAbsPath, updatedNoFm, 'utf8');
    return generated;
  }

  const closing = '\n---\n';
  const closingIndex = rawMarkdown.indexOf(closing, 4);
  if (closingIndex === -1) {
    const updatedMalformed = `---\nid: ${generated}\n---\n\n${rawMarkdown}`;
    fs.writeFileSync(personAbsPath, updatedMalformed, 'utf8');
    return generated;
  }

  const frontmatterText = rawMarkdown.slice(4, closingIndex);
  const body = rawMarkdown.slice(closingIndex + closing.length);
  const lines = frontmatterText.split('\n');
  const fullNameIndex = lines.findIndex(line => /^\s*full_name:\s*/.test(line));
  const insertAt = fullNameIndex >= 0 ? fullNameIndex + 1 : 0;
  lines.splice(insertAt, 0, `id: ${generated}`);

  const updated = `---\n${lines.join('\n')}\n---\n${body}`;
  fs.writeFileSync(personAbsPath, updated, 'utf8');
  return generated;
}

function copyAvatarToOutput(localAbsPath, personId, workspaceRootAbs) {
  const ext = path.extname(localAbsPath).toLowerCase();
  const avatarsDirAbs = path.join(workspaceRootAbs, OUTPUT_AVATARS_DIR);
  fs.mkdirSync(avatarsDirAbs, { recursive: true });

  const targetAbsPath = path.join(avatarsDirAbs, `${personId}${ext}`);
  fs.copyFileSync(localAbsPath, targetAbsPath);
  return `/avatars/${personId}${ext}`;
}

function resolvePhoto(personAbsPath, personMeta, personId, workspaceRootAbs, sourceDirRel) {
  const personDir = path.dirname(personAbsPath);
  const baseName = path.basename(personAbsPath, '.md');

  const explicitPhoto = cleanScalar(personMeta.photo || '');
  if (explicitPhoto) {
    if (/^https?:\/\//i.test(explicitPhoto)) {
      return { url: explicitPhoto, remote: true, source: 'frontmatter' };
    }

    const explicitLocal = path.resolve(personDir, explicitPhoto);
    if (fs.existsSync(explicitLocal)) {
      return {
        url: copyAvatarToOutput(explicitLocal, personId, workspaceRootAbs),
        remote: false,
        source: 'frontmatter'
      };
    }
  }

  for (const ext of IMAGE_EXT_FALLBACK_ORDER) {
    const candidate = path.join(personDir, `${baseName}${ext}`);
    if (fs.existsSync(candidate)) {
      return {
        url: copyAvatarToOutput(candidate, personId, workspaceRootAbs),
        remote: false,
        source: 'sibling-fallback'
      };
    }
  }

  return { url: null, remote: false, source: 'none' };
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function parsePersonFile(personAbsPath, workspaceRootAbs, sourceDirRel) {
  const rawMarkdown = fs.readFileSync(personAbsPath, 'utf8');
  const parsed = extractFrontmatter(rawMarkdown);
  const fullName = cleanScalar(parsed.data.full_name);

  if (!fullName) {
    return null;
  }

  const id = ensurePersonId(personAbsPath, rawMarkdown, parsed.data);
  const externalUrls = Array.isArray(parsed.data.external_url)
    ? parsed.data.external_url.map(cleanScalar).filter(Boolean)
    : [];

  const notesRaw = parsed.body.trim();

  return {
    absPath: personAbsPath,
    relPath: toPosix(path.relative(workspaceRootAbs, personAbsPath)),
    id,
    fullName,
    born: cleanScalar(parsed.data.born),
    died: cleanScalar(parsed.data.died),
    birthPlace: cleanScalar(parsed.data.birth_place),
    titles: Array.isArray(parsed.data.titles) ? parsed.data.titles.map(cleanScalar).filter(Boolean) : [],
    externalUrls,
    notes: notesRaw,
    notesHtml: notesRaw ? markdown.render(notesRaw) : '',
    photo: resolvePhoto(personAbsPath, parsed.data, id, workspaceRootAbs, sourceDirRel),
    initials: initials(fullName)
  };
}

function parseMarriageFile(marriageAbsPath) {
  const rawMarkdown = fs.readFileSync(marriageAbsPath, 'utf8');
  const parsed = extractFrontmatter(rawMarkdown);
  const partners = Array.isArray(parsed.data.partners) ? parsed.data.partners : [];

  const partnerRefs = partners
    .map(item => (item && typeof item === 'object' ? cleanScalar(item.ref || '') : ''))
    .filter(Boolean)
    .map(ref => path.resolve(path.dirname(marriageAbsPath), ref));

  return {
    absPath: marriageAbsPath,
    dirAbsPath: path.dirname(marriageAbsPath),
    partnerRefs,
    married: cleanScalar(parsed.data.married),
    marriedPlace: cleanScalar(parsed.data.married_place),
    endedBy: cleanScalar(parsed.data.ended_by),
    notes: cleanScalar(parsed.data.notes)
  };
}

function sortMarriages(a, b) {
  if (a.married && b.married) return a.married.localeCompare(b.married);
  if (a.married && !b.married) return -1;
  if (!a.married && b.married) return 1;
  return a.dirAbsPath.localeCompare(b.dirAbsPath);
}

function sortPeople(a, b) {
  if (a.born && b.born) return a.born.localeCompare(b.born);
  if (a.born && !b.born) return -1;
  if (!a.born && b.born) return 1;
  return a.fullName.localeCompare(b.fullName);
}

function buildTree({ sourceDirRel, sourceDirAbs, workspaceRootAbs, rootPersonName }) {
  const markdownFiles = walkMarkdown(sourceDirAbs);

  const personByAbsPath = new Map();
  const marriagesByDir = new Map();

  for (const file of markdownFiles) {
    if (path.basename(file) === '_marriage.md') {
      const marriage = parseMarriageFile(file);
      marriagesByDir.set(marriage.dirAbsPath, marriage);
      continue;
    }

    const person = parsePersonFile(file, workspaceRootAbs, sourceDirRel);
    if (!person) continue;
    personByAbsPath.set(person.absPath, person);
  }

  const topLevelMarriages = Array.from(marriagesByDir.values())
    .filter(m => path.dirname(m.dirAbsPath) === sourceDirAbs)
    .sort(sortMarriages);

  const topLevelPeople = Array.from(personByAbsPath.values())
    .filter(p => path.dirname(p.absPath) === sourceDirAbs)
    .sort(sortPeople);

  let rootPersonAbs = null;

  if (rootPersonName) {
    const exact = Array.from(personByAbsPath.values()).find(p => p.fullName === rootPersonName);
    rootPersonAbs = exact ? exact.absPath : null;
  }

  if (!rootPersonAbs && topLevelMarriages.length > 0 && topLevelMarriages[0].partnerRefs.length > 0) {
    rootPersonAbs = topLevelMarriages[0].partnerRefs[0];
  }

  if (!rootPersonAbs && topLevelPeople.length > 0) {
    rootPersonAbs = topLevelPeople[0].absPath;
  }

  if (!rootPersonAbs && personByAbsPath.size > 0) {
    rootPersonAbs = Array.from(personByAbsPath.keys()).sort()[0];
  }

  const visitedGuard = new Set();

  function getMarriagesForPerson(personAbsPath) {
    const personDir = path.dirname(personAbsPath);
    const entries = fs.readdirSync(personDir, { withFileTypes: true });

    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => marriagesByDir.get(path.join(personDir, entry.name)))
      .filter(Boolean)
      .filter(marriage => marriage.partnerRefs.includes(personAbsPath))
      .sort(sortMarriages);
  }

function getChildrenForMarriage(marriage) {
    const entries = fs.readdirSync(marriage.dirAbsPath, { withFileTypes: true });
    const partnerSet = new Set(marriage.partnerRefs);
    const nestedMarriages = Array.from(marriagesByDir.values())
      .filter(item => path.dirname(item.dirAbsPath) === marriage.dirAbsPath);

    const roleCounts = new Map();
    for (const nested of nestedMarriages) {
      const first = nested.partnerRefs[0];
      const second = nested.partnerRefs[1];

      if (first) {
        if (!roleCounts.has(first)) roleCounts.set(first, { first: 0, second: 0 });
        roleCounts.get(first).first += 1;
      }
      if (second) {
        if (!roleCounts.has(second)) roleCounts.set(second, { first: 0, second: 0 });
        roleCounts.get(second).second += 1;
      }
    }

    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_marriage.md')
      .map(entry => path.join(marriage.dirAbsPath, entry.name))
      .filter(absPath => !partnerSet.has(absPath))
      .filter(absPath => personByAbsPath.has(absPath))
      .filter(absPath => {
        const role = roleCounts.get(absPath);
        // If someone only appears as second partner in nested marriages,
        // treat them as spouse-only records, not blood descendants.
        if (role && role.second > 0 && role.first === 0) return false;
        return true;
      })
      .map(absPath => personByAbsPath.get(absPath))
      .sort(sortPeople);
  }

  function toNode(personAbsPath, stack) {
    const person = personByAbsPath.get(personAbsPath);
    if (!person) return null;

    if (stack.has(personAbsPath)) {
      return {
        ...person,
        spouses: [],
        children: []
      };
    }

    const nextStack = new Set(stack);
    nextStack.add(personAbsPath);

    const marriages = getMarriagesForPerson(personAbsPath);
    const spouses = [];
    const childAbsPaths = [];

    for (const marriage of marriages) {
      const spouseAbs = marriage.partnerRefs.find(p => p !== personAbsPath) || null;
      const spouse = spouseAbs ? personByAbsPath.get(spouseAbs) : null;

      if (spouse) {
        spouses.push({
          id: spouse.id,
          fullName: spouse.fullName,
          born: spouse.born,
          died: spouse.died,
          notes: spouse.notes,
          notesHtml: spouse.notesHtml,
          external: spouse.externalUrls.length > 0,
          externalUrl: spouse.externalUrls[0] || '',
          deceased: Boolean(spouse.died),
          photo: spouse.photo,
          initials: spouse.initials,
          marriage
        });
      }

      const children = getChildrenForMarriage(marriage);
      for (const child of children) {
        if (!childAbsPaths.includes(child.absPath)) {
          childAbsPaths.push(child.absPath);
        }
      }
    }

    const childrenNodes = childAbsPaths
      .map(childAbs => toNode(childAbs, nextStack))
      .filter(Boolean);

    return {
      ...person,
      spouses,
      children: childrenNodes
    };
  }

  const rootNode = rootPersonAbs ? toNode(rootPersonAbs, visitedGuard) : null;

  return {
    sourceDir: sourceDirRel,
    imageFallbackOrder: IMAGE_EXT_FALLBACK_ORDER,
    root: rootNode,
    totalPeople: personByAbsPath.size,
    generatedAt: new Date().toISOString()
  };
}

module.exports = function() {
  const workspaceRootAbs = process.cwd();
  const sourceDirRel = process.env.FAMILY_DATA_DIR || 'royal-family-files';
  const sourceDirAbs = path.resolve(workspaceRootAbs, sourceDirRel);
  const rootPersonName = process.env.FAMILY_ROOT_PERSON || '';

  if (!fs.existsSync(sourceDirAbs) || !fs.statSync(sourceDirAbs).isDirectory()) {
    return {
      sourceDir: sourceDirRel,
      imageFallbackOrder: IMAGE_EXT_FALLBACK_ORDER,
      root: null,
      totalPeople: 0,
      generatedAt: new Date().toISOString(),
      error: `Family source folder not found: ${sourceDirRel}`
    };
  }

  return buildTree({ sourceDirRel, sourceDirAbs, workspaceRootAbs, rootPersonName });
};
