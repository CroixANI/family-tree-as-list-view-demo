'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MarkdownItModule = require('markdown-it');
const { getProjectConfig } = require('../../config/env');
const MarkdownIt = MarkdownItModule.default || MarkdownItModule;

const IMAGE_EXT_FALLBACK_ORDER = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];
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

function copyAvatarToOutput(localAbsPath, personId, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath) {
  const ext = path.extname(localAbsPath).toLowerCase();
  const avatarsDirAbs = path.isAbsolute(outputAvatarsDirRel)
    ? outputAvatarsDirRel
    : path.join(workspaceRootAbs, outputAvatarsDirRel);
  fs.mkdirSync(avatarsDirAbs, { recursive: true });

  const targetAbsPath = path.join(avatarsDirAbs, `${personId}${ext}`);
  fs.copyFileSync(localAbsPath, targetAbsPath);
  return `${avatarsPublicPath}/${personId}${ext}`;
}

function resolvePhoto(personAbsPath, personMeta, personId, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath) {
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
        url: copyAvatarToOutput(explicitLocal, personId, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath),
        remote: false,
        source: 'frontmatter'
      };
    }
  }

  for (const ext of IMAGE_EXT_FALLBACK_ORDER) {
    const candidate = path.join(personDir, `${baseName}${ext}`);
    if (fs.existsSync(candidate)) {
      return {
        url: copyAvatarToOutput(candidate, personId, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath),
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

function parsePersonFile(personAbsPath, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath) {
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
    photo: resolvePhoto(personAbsPath, parsed.data, id, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath),
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

function hashUnionId(seed) {
  return `u-${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
}

function inferRingTone(person, roleVote) {
  const text = `${person.fullName} ${Array.isArray(person.titles) ? person.titles.join(' ') : ''}`.toLowerCase();
  const femaleHintPatterns = [/\bqueen\b/, /\bprincess\b/, /\bduchess\b/, /\bcountess\b/, /\blady\b/];
  const maleHintPatterns = [/\bking\b/, /\bprince\b/, /\bduke\b/, /\bearl\b/, /\blord\b/];

  const hasFemaleHint = femaleHintPatterns.some(pattern => pattern.test(text));
  const hasMaleHint = maleHintPatterns.some(pattern => pattern.test(text));

  if (hasFemaleHint && !hasMaleHint) return 'orange';
  if (hasMaleHint && !hasFemaleHint) return 'blue';

  if (roleVote && roleVote.second > roleVote.first) return 'orange';
  return 'blue';
}

function selectGraphSubtitle(titles) {
  if (!Array.isArray(titles) || titles.length === 0) return '';
  const firstTitle = cleanScalar(titles[0] || '');
  if (!firstTitle) return '';
  return firstTitle.length < 30 ? firstTitle : '';
}

function toGraphPersonPayload(person, ringTone) {
  return {
    id: person.id,
    fullName: person.fullName,
    subtitle: selectGraphSubtitle(person.titles),
    born: person.born,
    died: person.died,
    deceased: Boolean(person.died),
    initials: person.initials,
    ringTone,
    photo: person.photo && person.photo.url
      ? { url: person.photo.url, remote: Boolean(person.photo.remote) }
      : null
  };
}

const D3_DAG_UNION_PREFIX = '__union__:';

function buildD3DagPayload(people, unions, generationById) {
  const personIdSet = new Set(people.map(person => person.id));
  const connectedNodeIds = new Set();
  const edges = [];
  const unionGenerationByNodeId = {};

  unions.forEach(union => {
    const partnerIds = Array.isArray(union.partnerIds)
      ? union.partnerIds.filter(partnerId => personIdSet.has(partnerId))
      : [];
    const childIds = Array.isArray(union.childIds)
      ? union.childIds.filter(childId => personIdSet.has(childId))
      : [];

    if (!partnerIds.length && !childIds.length) return;

    const unionNodeId = `${D3_DAG_UNION_PREFIX}${union.id}`;
    const partnerGenerations = partnerIds
      .map(partnerId => Number(generationById[partnerId]))
      .filter(value => Number.isFinite(value));
    const unionGeneration = Number.isFinite(union.generation)
      ? union.generation
      : (partnerGenerations.length ? Math.min(...partnerGenerations) : 0);
    unionGenerationByNodeId[unionNodeId] = unionGeneration;

    partnerIds.forEach(partnerId => {
      edges.push({ source: partnerId, target: unionNodeId });
      connectedNodeIds.add(partnerId);
      connectedNodeIds.add(unionNodeId);
    });

    childIds.forEach(childId => {
      edges.push({ source: unionNodeId, target: childId });
      connectedNodeIds.add(unionNodeId);
      connectedNodeIds.add(childId);
    });
  });

  people.forEach(person => {
    if (connectedNodeIds.has(person.id)) return;
    // d3-dag includes disconnected nodes via single(true) self edges.
    edges.push({ source: person.id, target: person.id });
  });

  return {
    unionNodePrefix: D3_DAG_UNION_PREFIX,
    unionGenerationByNodeId,
    edges
  };
}

function buildGraphData(rootPersonAbs, personByAbsPath, getMarriagesForPerson, getChildrenForMarriage) {
  const emptyGraph = {
    rootPersonId: '',
    people: [],
    unions: [],
    edges: [],
    d3Dag: {
      unionNodePrefix: D3_DAG_UNION_PREFIX,
      unionGenerationByNodeId: {},
      edges: []
    },
    generationById: {},
    maxGeneration: 0
  };

  if (!rootPersonAbs || !personByAbsPath.has(rootPersonAbs)) {
    return emptyGraph;
  }

  const peopleById = new Map();
  const personAbsById = new Map();
  const unionsById = new Map();
  const roleVotesByAbs = new Map();
  const generationByAbs = new Map();
  const queue = [{ absPath: rootPersonAbs, generation: 0 }];
  generationByAbs.set(rootPersonAbs, 0);

  function ensurePerson(absPath) {
    if (!absPath) return null;
    const person = personByAbsPath.get(absPath);
    if (!person) return null;

    peopleById.set(person.id, person);
    personAbsById.set(person.id, absPath);
    return person;
  }

  function setGeneration(absPath, generation) {
    if (!absPath) return false;
    const previous = generationByAbs.get(absPath);
    if (previous === undefined || generation < previous) {
      generationByAbs.set(absPath, generation);
      return true;
    }
    return false;
  }

  function voteRole(absPath, role) {
    if (!absPath) return;
    if (!roleVotesByAbs.has(absPath)) {
      roleVotesByAbs.set(absPath, { first: 0, second: 0 });
    }
    const counters = roleVotesByAbs.get(absPath);
    if (role === 'second') {
      counters.second += 1;
      return;
    }
    counters.first += 1;
  }

  for (let i = 0; i < queue.length; i += 1) {
    const { absPath, generation } = queue[i];
    const knownGeneration = generationByAbs.get(absPath);
    if (knownGeneration !== undefined && generation > knownGeneration) continue;

    const person = ensurePerson(absPath);
    if (!person) continue;

    const marriages = getMarriagesForPerson(absPath);
    for (const marriage of marriages) {
      const unionId = hashUnionId(marriage.dirAbsPath);
      if (!unionsById.has(unionId)) {
        unionsById.set(unionId, {
          id: unionId,
          partnerIds: [],
          childIds: [],
          married: marriage.married,
          endedBy: marriage.endedBy,
          generation
        });
      }

      const union = unionsById.get(unionId);
      union.generation = Math.min(union.generation, generation);

      marriage.partnerRefs.forEach((partnerAbs, index) => {
        const partner = ensurePerson(partnerAbs);
        if (!partner) return;

        setGeneration(partnerAbs, generation);
        voteRole(partnerAbs, index === 1 ? 'second' : 'first');

        if (!union.partnerIds.includes(partner.id)) {
          union.partnerIds.push(partner.id);
        }
      });

      const children = getChildrenForMarriage(marriage);
      for (const child of children) {
        const childPerson = ensurePerson(child.absPath);
        if (!childPerson) continue;

        if (!union.childIds.includes(childPerson.id)) {
          union.childIds.push(childPerson.id);
        }

        const nextGeneration = generation + 1;
        if (setGeneration(child.absPath, nextGeneration)) {
          queue.push({ absPath: child.absPath, generation: nextGeneration });
        }
      }
    }
  }

  const generationById = {};
  for (const [personId, absPath] of personAbsById.entries()) {
    generationById[personId] = generationByAbs.get(absPath) ?? 0;
  }

  const maxGeneration = Object.values(generationById).reduce((max, depth) => Math.max(max, depth), 0);

  const people = Array.from(peopleById.values())
    .sort((a, b) => {
      const generationA = generationById[a.id] ?? 0;
      const generationB = generationById[b.id] ?? 0;
      if (generationA !== generationB) return generationA - generationB;
      return sortPeople(a, b);
    })
    .map(person => {
      const absPath = personAbsById.get(person.id);
      const roleVote = absPath ? roleVotesByAbs.get(absPath) : null;
      const ringTone = inferRingTone(person, roleVote);
      return toGraphPersonPayload(person, ringTone);
    });

  const unions = Array.from(unionsById.values())
    .map(union => ({
      ...union,
      partnerIds: union.partnerIds.filter(partnerId => peopleById.has(partnerId)),
      childIds: union.childIds.filter(childId => peopleById.has(childId))
    }))
    .filter(union => union.partnerIds.length > 0)
    .sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return a.id.localeCompare(b.id);
    });

  const edges = [];
  for (const union of unions) {
    for (const partnerId of union.partnerIds) {
      edges.push({ source: partnerId, target: union.id, kind: 'partner' });
    }
    for (const childId of union.childIds) {
      edges.push({ source: union.id, target: childId, kind: 'child' });
    }
  }
  const d3Dag = buildD3DagPayload(people, unions, generationById);

  const rootPerson = personByAbsPath.get(rootPersonAbs);
  return {
    rootPersonId: rootPerson ? rootPerson.id : '',
    people,
    unions,
    edges,
    d3Dag,
    generationById,
    maxGeneration
  };
}

function buildTree({
  sourceDirRel,
  sourceDirAbs,
  workspaceRootAbs,
  rootPersonName,
  outputAvatarsDirRel,
  avatarsPublicPath,
  pathPrefix
}) {
  const markdownFiles = walkMarkdown(sourceDirAbs);

  const personByAbsPath = new Map();
  const marriagesByDir = new Map();

  for (const file of markdownFiles) {
    if (path.basename(file) === '_marriage.md') {
      const marriage = parseMarriageFile(file);
      marriagesByDir.set(marriage.dirAbsPath, marriage);
      continue;
    }

    const person = parsePersonFile(file, workspaceRootAbs, outputAvatarsDirRel, avatarsPublicPath);
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
  const graph = buildGraphData(rootPersonAbs, personByAbsPath, getMarriagesForPerson, getChildrenForMarriage);

  return {
    sourceDir: sourceDirRel,
    imageFallbackOrder: IMAGE_EXT_FALLBACK_ORDER,
    pathPrefix,
    root: rootNode,
    graph,
    graphJson: JSON.stringify(graph),
    totalPeople: personByAbsPath.size,
    generatedAt: new Date().toISOString()
  };
}

module.exports = function() {
  const workspaceRootAbs = process.cwd();
  const config = getProjectConfig(workspaceRootAbs);
  const sourceDirRel = config.familyDataDir;
  const sourceDirAbs = path.resolve(workspaceRootAbs, sourceDirRel);
  const rootPersonName = config.familyRootPerson;
  const outputAvatarsDirRel = path.join(config.siteOutputDir, config.avatarsSubdir);
  const avatarsPublicPath = `/${toPosix(config.avatarsSubdir).replace(/^\/+|\/+$/g, '')}`;
  const emptyGraph = {
    rootPersonId: '',
    people: [],
    unions: [],
    edges: [],
    d3Dag: {
      unionNodePrefix: D3_DAG_UNION_PREFIX,
      unionGenerationByNodeId: {},
      edges: []
    },
    generationById: {},
    maxGeneration: 0
  };

  if (!fs.existsSync(sourceDirAbs) || !fs.statSync(sourceDirAbs).isDirectory()) {
    return {
      sourceDir: sourceDirRel,
      imageFallbackOrder: IMAGE_EXT_FALLBACK_ORDER,
      pathPrefix: config.eleventyPathPrefix,
      root: null,
      graph: emptyGraph,
      graphJson: JSON.stringify(emptyGraph),
      totalPeople: 0,
      generatedAt: new Date().toISOString(),
      error: `Family source folder not found: ${sourceDirRel}`
    };
  }

  return buildTree({
    sourceDirRel,
    sourceDirAbs,
    workspaceRootAbs,
    rootPersonName,
    outputAvatarsDirRel,
    avatarsPublicPath,
    pathPrefix: config.eleventyPathPrefix
  });
};
