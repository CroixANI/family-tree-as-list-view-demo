'use strict';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function announce(message) {
  const status = document.getElementById('a11y-status');
  if (!status) return;

  status.textContent = '';
  window.setTimeout(() => {
    status.textContent = message;
  }, 10);
}

function getPersonNameFromLi(li) {
  return li?.querySelector(':scope > .person-row .person-name')?.textContent.trim() || 'this person';
}

function setExpanded(li, expand, announceChange = false) {
  const children = li.querySelector(':scope > .children');
  const toggleBtn = li.querySelector(':scope > .person-row > .person-row__content > .toggle-btn');
  const icon = toggleBtn ? toggleBtn.querySelector('.toggle-icon') : null;
  if (!children) return;

  const personName = getPersonNameFromLi(li);

  children.classList.toggle('collapsed', !expand);
  if (icon) icon.textContent = expand ? '▾' : '▸';

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', expand ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', `${expand ? 'Collapse' : 'Expand'} descendants of ${personName}`);
  }

  if (announceChange) {
    announce(`${expand ? 'Expanded' : 'Collapsed'} descendants of ${personName}.`);
  }
}

function createAvatarContent(container, name, photoSrc) {
  container.innerHTML = '';
  if (photoSrc) {
    const img = document.createElement('img');
    img.className = 'details-photo';
    img.alt = `${name} portrait`;
    img.src = photoSrc;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      container.textContent = initials(name);
    }, { once: true });
    container.appendChild(img);
    return;
  }
  container.textContent = initials(name);
}

function setupInlineAvatarFallbacks() {
  document.querySelectorAll('.person-avatar img.person-photo, .spouse-avatar img.spouse-photo').forEach(img => {
    img.addEventListener('error', () => {
      const avatar = img.parentElement;
      if (!avatar) return;

      const spouseBadge = img.closest('.spouse-badge');
      const name = spouseBadge
        ? (spouseBadge.querySelector('.spouse-name')?.textContent.trim() || '')
        : (img.closest('.person-row')?.querySelector('.person-name')?.textContent.trim() || '');

      avatar.textContent = initials(name);
    }, { once: true });
  });
}

function getPersonPhotoSource(personRow) {
  const img = personRow.querySelector(':scope .person-avatar img');
  return img ? img.getAttribute('src') : '';
}

function getSpousesFromRow(personRow) {
  return Array.from(personRow.querySelectorAll(':scope .spouse-badge')).map(badge => ({
    name: badge.querySelector('.spouse-name')?.textContent.trim() || 'Unknown spouse',
    external: badge.classList.contains('external'),
    deceased: badge.classList.contains('deceased')
  }));
}

function getBioHtmlFromContainer(container) {
  if (!container) return '';
  const template = container.querySelector(':scope > .bio-template');
  return template ? template.innerHTML.trim() : '';
}

function renderDetailsSpouses(container, spouses) {
  if (!spouses.length) {
    container.innerHTML = '<div class="details-placeholder">No spouse recorded</div>';
    return;
  }

  container.innerHTML = '';

  spouses.forEach(spouse => {
    const row = document.createElement('div');
    row.className = 'details-spouse-row';
    if (spouse.deceased) row.classList.add('deceased');
    if (spouse.external) row.classList.add('external');

    const icon = document.createElement('span');
    icon.className = 'details-spouse-icon';
    icon.textContent = '⚭';

    const name = document.createElement('span');
    name.textContent = spouse.name;

    row.append(icon, name);

    if (spouse.external) {
      const tag = document.createElement('span');
      tag.className = 'details-spouse-ext-tag';
      tag.textContent = 'External family';
      row.append(tag);
    }

    container.append(row);
  });
}

function setupDetailsOverlay() {
  const overlay = document.getElementById('details-overlay');
  const dialog = document.getElementById('details-dialog');
  const closeBtn = document.getElementById('details-close');
  const detailsName = document.getElementById('details-name');
  const detailsAvatar = document.getElementById('details-avatar');
  const detailsSpouses = document.getElementById('details-spouses');
  const detailsBorn = document.getElementById('details-born');
  const detailsDied = document.getElementById('details-died');
  const detailsBioContent = document.getElementById('details-bio-content');

  if (!overlay || !dialog || !closeBtn || !detailsName || !detailsAvatar || !detailsSpouses || !detailsBorn || !detailsDied || !detailsBioContent) return;

  let lastFocusedElement = null;

  function getFocusableElementsInDialog() {
    return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      if (el.hasAttribute('disabled')) return false;
      if (el.closest('[hidden]')) return false;
      return true;
    });
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || overlay.hidden) return;

    const focusables = getFocusableElementsInDialog();
    if (!focusables.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setMetaValue(el, value, placeholderText = '—') {
    const trimmed = String(value || '').trim();
    if (trimmed) {
      el.textContent = trimmed;
      el.classList.remove('details-placeholder');
      return;
    }

    el.textContent = placeholderText;
    el.classList.add('details-placeholder');
  }

  function openDetails(payload) {
    const {
      name,
      photoSrc,
      spouses,
      born,
      died,
      bioHtml,
      triggerEl
    } = payload;

    lastFocusedElement = triggerEl instanceof HTMLElement ? triggerEl : document.activeElement;

    detailsName.textContent = name;
    createAvatarContent(detailsAvatar, name, photoSrc);
    renderDetailsSpouses(detailsSpouses, spouses);
    setMetaValue(detailsBorn, born, '—');
    setMetaValue(detailsDied, died, '—');
    detailsBioContent.innerHTML = bioHtml && bioHtml.trim()
      ? bioHtml
      : '<p class=\"details-placeholder\">No biography text provided.</p>';

    overlay.hidden = false;
    dialog.addEventListener('keydown', trapFocus);

    window.requestAnimationFrame(() => {
      const focusables = getFocusableElementsInDialog();
      if (focusables.length) {
        focusables[0].focus();
      } else {
        dialog.focus();
      }
    });

    announce(`Opened details dialog for ${name}.`);
  }

  function closeDetails() {
    if (overlay.hidden) return;

    overlay.hidden = true;
    dialog.removeEventListener('keydown', trapFocus);

    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }

    announce('Closed details dialog.');
  }

  document.querySelectorAll('.person > .person-row .details-btn').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      const row = btn.closest('.person-row');
      const personName = row.querySelector('.person-name')?.textContent.trim() || 'Unknown person';
      const personPhoto = getPersonPhotoSource(row);
      const spouses = getSpousesFromRow(row);
      const born = row.dataset.born || '';
      const died = row.dataset.died || '';
      const bioHtml = getBioHtmlFromContainer(row.querySelector(':scope > .person-row__content'));

      openDetails({
        name: personName,
        photoSrc: personPhoto,
        spouses,
        born,
        died,
        bioHtml,
        triggerEl: btn
      });
    });
  });

  document.querySelectorAll('.spouse-details-btn').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      const badge = btn.closest('.spouse-badge');
      const personRow = btn.closest('.person-row');
      const spouseName = badge.querySelector('.spouse-name')?.textContent.trim() || 'Unknown spouse';
      const spousePhoto = badge.getAttribute('data-photo-src') || '';
      const spouseExternal = badge.classList.contains('external');
      const spouseDeceased = badge.classList.contains('deceased');
      const spouseBorn = badge.dataset.born || '';
      const spouseDied = badge.dataset.died || '';
      const spouseBioHtml = getBioHtmlFromContainer(badge);

      const primaryName = personRow.querySelector('.person-name')?.textContent.trim() || 'Unknown person';
      openDetails({
        name: spouseName,
        photoSrc: spousePhoto,
        spouses: [{
          name: primaryName,
          external: false,
          deceased: false
        }],
        born: spouseBorn,
        died: spouseDied,
        bioHtml: spouseBioHtml,
        triggerEl: btn
      });

      if (spouseExternal || spouseDeceased) {
        const extra = detailsSpouses.querySelector('.details-spouse-row');
        if (extra) {
          if (spouseExternal) extra.classList.add('external');
          if (spouseDeceased) extra.classList.add('deceased');
        }
      }
    });
  });

  closeBtn.addEventListener('click', closeDetails);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeDetails();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) closeDetails();
  });
}

function setupNodeToggles() {
  document.querySelectorAll('.toggle-btn').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', event => {
      event.stopPropagation();
      const li = toggleBtn.closest('.person.has-children');
      const children = li?.querySelector(':scope > .children');
      if (!li || !children) return;

      const isCollapsed = children.classList.contains('collapsed');
      setExpanded(li, isCollapsed, true);
    });
  });

  document.querySelectorAll('.has-children > .person-row').forEach(row => {
    row.addEventListener('click', function(event) {
      if (event.target.closest('a') || event.target.closest('button')) return;

      const li = this.closest('.person.has-children');
      const children = li?.querySelector(':scope > .children');
      if (!li || !children) return;

      const isCollapsed = children.classList.contains('collapsed');
      setExpanded(li, isCollapsed, true);
    });
  });

  const expandAll = document.getElementById('expand-all');
  const collapseAll = document.getElementById('collapse-all');

  if (expandAll) {
    expandAll.addEventListener('click', () => {
      document.querySelectorAll('.person.has-children').forEach(li => setExpanded(li, true));
      announce('Expanded all branches.');
    });
  }

  if (collapseAll) {
    collapseAll.addEventListener('click', () => {
      document.querySelectorAll('.person.has-children').forEach(li => setExpanded(li, false));
      const rootNode = document.querySelector('.family-tree > .person.has-children');
      if (rootNode) setExpanded(rootNode, true);
      announce('Collapsed all branches except the root.');
    });
  }
}

function applyPersonSelectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const pid = (params.get('pid') || '').trim();
  if (!pid) return;

  document.querySelectorAll('.person-row.is-active').forEach(row => row.classList.remove('is-active'));
  document.querySelectorAll('.person [aria-current=\"true\"]').forEach(el => el.removeAttribute('aria-current'));

  const escapedPid = window.CSS && typeof window.CSS.escape === 'function'
    ? window.CSS.escape(pid)
    : pid.replace(/\"/g, '\\\"');
  const personLi = document.querySelector(`.person[data-person-id=\"${escapedPid}\"]`);
  if (!personLi) {
    announce(`Person with id ${pid} was not found in this tree.`);
    return;
  }

  let ancestor = personLi.parentElement ? personLi.parentElement.closest('.person.has-children') : null;
  while (ancestor) {
    setExpanded(ancestor, true);
    ancestor = ancestor.parentElement ? ancestor.parentElement.closest('.person.has-children') : null;
  }

  const row = personLi.querySelector(':scope > .person-row');
  const name = personLi.querySelector(':scope > .person-row .person-name');
  if (row) row.classList.add('is-active');
  if (name) name.setAttribute('aria-current', 'true');

  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  announce(`Focused ${name ? name.textContent.trim() : 'selected person'} from URL.`);
}

function readGraphData() {
  const graphDataNode = document.getElementById('graph-data');
  if (!graphDataNode) return null;

  try {
    return JSON.parse(graphDataNode.textContent || '{}');
  } catch (_error) {
    return null;
  }
}

function resolveGraphPhotoUrl(photo, pathPrefix) {
  if (!photo || !photo.url) return '';
  if (photo.remote || /^https?:\/\//i.test(photo.url)) return photo.url;

  const normalizedPrefix = String(pathPrefix || '/')
    .replace(/\/+$/, '')
    .concat('/');
  const normalizedPath = String(photo.url).replace(/^\/+/, '');
  return `${normalizedPrefix}${normalizedPath}`;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDisplaySubtitle(person) {
  const raw = String(person?.subtitle || '').trim();
  if (!raw) return '';
  return raw.length < 30 ? raw : '';
}

function buildGenerationBlocks({
  generation,
  orderedIds,
  unionsAtGeneration,
  generationById,
  baseKeyById,
  baseSourceById,
  personById
}) {
  const blocks = [];
  const used = new Set();
  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));

  function partnersFor(personId) {
    const partners = [];
    for (const union of unionsAtGeneration) {
      if (!Array.isArray(union.partnerIds) || !union.partnerIds.includes(personId)) continue;

      for (const partnerId of union.partnerIds) {
        if (partnerId === personId) continue;
        if ((generationById[partnerId] ?? 0) !== generation) continue;
        if (!partners.includes(partnerId)) partners.push(partnerId);
      }
    }
    return partners;
  }

  function unionForPair(aId, bId) {
    return unionsAtGeneration.find(union =>
      Array.isArray(union.partnerIds)
      && union.partnerIds.includes(aId)
      && union.partnerIds.includes(bId));
  }

  function getSortKey(personId) {
    const value = baseKeyById.get(personId);
    if (Number.isFinite(value)) return value;
    return (orderIndex.get(personId) ?? 10000) * 1000;
  }

  function getAnchorKey(members) {
    const parentAnchoredKeys = members
      .filter(memberId => baseSourceById.get(memberId) === 'parent')
      .map(memberId => baseKeyById.get(memberId))
      .filter(value => Number.isFinite(value));

    if (parentAnchoredKeys.length) return average(parentAnchoredKeys);

    const finiteKeys = members
      .map(memberId => baseKeyById.get(memberId))
      .filter(value => Number.isFinite(value));

    if (finiteKeys.length) return average(finiteKeys);
    return average(members.map(memberId => getSortKey(memberId)));
  }

  const hubIds = orderedIds.filter(personId => {
    const partners = partnersFor(personId);
    return partners.length > 1;
  });

  for (const hubId of hubIds) {
    if (used.has(hubId)) continue;
    const partnerInfos = partnersFor(hubId)
      .filter(partnerId => !used.has(partnerId))
      .map(partnerId => {
        const union = unionForPair(hubId, partnerId);
        return {
          partnerId,
          childCount: union && Array.isArray(union.childIds) ? union.childIds.length : 0,
          key: getSortKey(partnerId)
        };
      });

    if (!partnerInfos.length) continue;

    const leftPartners = partnerInfos
      .filter(info => info.childCount === 0)
      .sort((a, b) => a.key - b.key)
      .map(info => info.partnerId);

    const rightPartners = partnerInfos
      .filter(info => info.childCount > 0)
      .sort((a, b) => a.key - b.key)
      .map(info => info.partnerId);

    const members = [...leftPartners, hubId, ...rightPartners].filter(memberId => !used.has(memberId));
    if (!members.length) continue;

    members.forEach(memberId => used.add(memberId));
    blocks.push({
      members,
      key: getAnchorKey(members)
    });
  }

  for (const personId of orderedIds) {
    if (used.has(personId)) continue;

    const candidates = partnersFor(personId).filter(partnerId => !used.has(partnerId));
    if (candidates.length === 1) {
      const partnerId = candidates[0];
      const partnerHasExtraLinks = partnersFor(partnerId).some(otherId => otherId !== personId && !used.has(otherId));

      if (!partnerHasExtraLinks && !used.has(partnerId)) {
        const pair = [personId, partnerId];
        pair.sort((aId, bId) => {
          const toneA = personById.get(aId)?.ringTone === 'orange' ? 'orange' : 'blue';
          const toneB = personById.get(bId)?.ringTone === 'orange' ? 'orange' : 'blue';
          if (toneA !== toneB) return toneA === 'blue' ? -1 : 1;
          return getSortKey(aId) - getSortKey(bId);
        });

        pair.forEach(memberId => used.add(memberId));
        blocks.push({
          members: pair,
          key: getAnchorKey(pair)
        });
        continue;
      }
    }

    used.add(personId);
    blocks.push({
      members: [personId],
      key: getAnchorKey([personId])
    });
  }

  blocks.sort((a, b) => {
    if (a.key !== b.key) return a.key - b.key;
    const aOrder = orderIndex.get(a.members[0]) ?? 10000;
    const bOrder = orderIndex.get(b.members[0]) ?? 10000;
    return aOrder - bOrder;
  });

  return blocks;
}

function computeD3DagPositionKeys({
  people,
  unions,
  generationById,
  personById,
  nodeWidth,
  nodeStep,
  levelGap
}) {
  const d3Api = (typeof window !== 'undefined' && window && window.d3) ? window.d3 : null;
  if (!d3Api || typeof d3Api.graphConnect !== 'function' || typeof d3Api.sugiyama !== 'function') {
    return null;
  }

  const unionGenerationByNodeId = new Map();
  const edgeList = [];
  const connectedNodeIds = new Set();

  unions.forEach(union => {
    const partnerIds = Array.isArray(union.partnerIds)
      ? union.partnerIds.filter(partnerId => personById.has(partnerId))
      : [];
    const childIds = Array.isArray(union.childIds)
      ? union.childIds.filter(childId => personById.has(childId))
      : [];

    if (!partnerIds.length && !childIds.length) return;

    const unionNodeId = `__union__:${union.id}`;
    const partnerGenerations = partnerIds
      .map(partnerId => Number(generationById[partnerId]))
      .filter(value => Number.isFinite(value));
    const unionGeneration = Number.isFinite(union.generation)
      ? union.generation
      : (partnerGenerations.length ? Math.min(...partnerGenerations) : 0);
    unionGenerationByNodeId.set(unionNodeId, unionGeneration);

    partnerIds.forEach(partnerId => {
      edgeList.push([partnerId, unionNodeId]);
      connectedNodeIds.add(partnerId);
      connectedNodeIds.add(unionNodeId);
    });

    childIds.forEach(childId => {
      edgeList.push([unionNodeId, childId]);
      connectedNodeIds.add(unionNodeId);
      connectedNodeIds.add(childId);
    });
  });

  people.forEach(person => {
    if (connectedNodeIds.has(person.id)) return;
    edgeList.push([person.id, person.id]);
  });

  try {
    const graph = d3Api.graphConnect().single(true)(edgeList);

    let layoutOperator = d3Api.sugiyama()
      .nodeSize([nodeWidth, 1])
      .gap([Math.max(24, nodeStep - nodeWidth), Math.max(24, levelGap / 2)]);

    if (typeof d3Api.layeringSimplex === 'function') {
      const layering = d3Api.layeringSimplex().rank(node => {
        const nodeId = node && typeof node.data === 'string' ? node.data : '';
        if (!nodeId) return undefined;
        if (nodeId.startsWith('__union__:')) {
          const unionGeneration = unionGenerationByNodeId.get(nodeId);
          if (!Number.isFinite(unionGeneration)) return undefined;
          return unionGeneration * 2 + 1;
        }

        const personGeneration = Number(generationById[nodeId]);
        if (!Number.isFinite(personGeneration)) return undefined;
        return personGeneration * 2;
      });
      layoutOperator = layoutOperator.layering(layering);
    }

    if (typeof d3Api.decrossTwoLayer === 'function') {
      layoutOperator = layoutOperator.decross(d3Api.decrossTwoLayer());
    }
    if (typeof d3Api.coordSimplex === 'function') {
      layoutOperator = layoutOperator.coord(d3Api.coordSimplex());
    }

    layoutOperator(graph);

    const positionKeys = new Map();
    for (const node of graph.nodes()) {
      const nodeId = node && typeof node.data === 'string' ? node.data : '';
      if (!nodeId || !personById.has(nodeId)) continue;
      if (!Number.isFinite(node.x)) continue;
      positionKeys.set(nodeId, node.x);
    }

    return positionKeys.size ? positionKeys : null;
  } catch (_error) {
    return null;
  }
}

function computeGraphLayout(graphData) {
  const people = Array.isArray(graphData?.people) ? graphData.people : [];
  const unions = Array.isArray(graphData?.unions) ? graphData.unions : [];
  const generationById = graphData?.generationById && typeof graphData.generationById === 'object'
    ? graphData.generationById
    : {};

  if (!people.length) return null;

  const personById = new Map(people.map(person => [person.id, person]));
  const personIdsByGeneration = new Map();
  const parentUnionsByChild = new Map();
  const unionsByGeneration = new Map();
  const rootPersonId = graphData.rootPersonId || people[0].id;

  people.forEach(person => {
    const generation = Number(generationById[person.id]) || 0;
    if (!personIdsByGeneration.has(generation)) personIdsByGeneration.set(generation, []);
    personIdsByGeneration.get(generation).push(person.id);
  });

  unions.forEach(union => {
    const partnerGenerations = Array.isArray(union.partnerIds)
      ? union.partnerIds
        .map(partnerId => Number(generationById[partnerId]))
        .filter(value => Number.isFinite(value))
      : [];

    const generation = Number.isFinite(union.generation)
      ? union.generation
      : (partnerGenerations.length ? Math.min(...partnerGenerations) : 0);

    if (!unionsByGeneration.has(generation)) unionsByGeneration.set(generation, []);
    unionsByGeneration.get(generation).push(union);

    if (Array.isArray(union.childIds)) {
      union.childIds.forEach(childId => {
        if (!parentUnionsByChild.has(childId)) parentUnionsByChild.set(childId, []);
        parentUnionsByChild.get(childId).push(union.id);
      });
    }
  });

  const NODE_WIDTH = 190;
  const NODE_STEP = 220;
  const BLOCK_GAP = 120;
  const LEVEL_GAP = 280;
  const AVATAR_RADIUS = 51;
  const TOP_OFFSET = 92;
  const OUTER_PADDING = 120;
  const BRANCH_DROP = 142;
  const CHILD_ANCHOR_GAP = AVATAR_RADIUS + 14;

  const dagPositionKeys = computeD3DagPositionKeys({
    people,
    unions,
    generationById,
    personById,
    nodeWidth: NODE_WIDTH,
    nodeStep: NODE_STEP,
    levelGap: LEVEL_GAP
  });

  const maxGeneration = Math.max(
    0,
    ...people.map(person => Number(generationById[person.id]) || 0)
  );
  const provisionalXById = new Map();
  const provisionalUnionXById = new Map();

  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    const ids = (personIdsByGeneration.get(generation) || []).filter(personId => personById.has(personId));
    if (!ids.length) continue;

    const baseKeyById = new Map();
    const baseSourceById = new Map();
    ids.forEach(personId => {
      const dagKey = dagPositionKeys ? dagPositionKeys.get(personId) : Number.NaN;
      if (generation === 0) {
        if (Number.isFinite(dagKey)) {
          baseKeyById.set(personId, dagKey);
          baseSourceById.set(personId, 'dag');
          return;
        }

        if (personId === rootPersonId) {
          baseKeyById.set(personId, -1e9);
          baseSourceById.set(personId, 'root');
          return;
        }
        baseKeyById.set(personId, personById.get(personId).fullName.localeCompare(personById.get(rootPersonId)?.fullName || ''));
        baseSourceById.set(personId, 'name');
        return;
      }

      const parentUnionIds = parentUnionsByChild.get(personId) || [];
      const parentXs = parentUnionIds
        .map(unionId => provisionalUnionXById.get(unionId))
        .filter(value => Number.isFinite(value));
      if (parentXs.length) {
        baseKeyById.set(personId, average(parentXs));
        baseSourceById.set(personId, 'parent');
      } else {
        if (Number.isFinite(dagKey)) {
          baseKeyById.set(personId, dagKey);
          baseSourceById.set(personId, 'dag');
        } else {
          baseKeyById.set(personId, Number.POSITIVE_INFINITY);
          baseSourceById.set(personId, 'fallback');
        }
      }
    });

    const sourceOrder = new Map(ids.map((id, index) => [id, index]));
    const orderedIds = ids.slice().sort((aId, bId) => {
      const keyA = baseKeyById.get(aId);
      const keyB = baseKeyById.get(bId);
      if (keyA !== keyB) return keyA - keyB;
      const orderA = sourceOrder.get(aId) ?? 10000;
      const orderB = sourceOrder.get(bId) ?? 10000;
      if (orderA !== orderB) return orderA - orderB;
      return personById.get(aId).fullName.localeCompare(personById.get(bId).fullName);
    });

    const unionsAtGeneration = unionsByGeneration.get(generation) || [];
    const blocks = buildGenerationBlocks({
      generation,
      orderedIds,
      unionsAtGeneration,
      generationById,
      baseKeyById,
      baseSourceById,
      personById
    });

    const minFirstCenterGap = NODE_WIDTH + BLOCK_GAP;
    const blockSpans = blocks.map(block => Math.max(0, (block.members.length - 1) * NODE_STEP));
    function minGapAfter(blockIndex) {
      return blockSpans[blockIndex] + minFirstCenterGap;
    }
    const desiredFirstCenters = blocks.map(block => {
      if (generation === 0) return Number.NaN;

      const parentAnchoredStarts = block.members
        .map((memberId, index) => ({
          source: baseSourceById.get(memberId),
          start: Number(baseKeyById.get(memberId)) - index * NODE_STEP
        }))
        .filter(item => item.source === 'parent' && Number.isFinite(item.start))
        .map(item => item.start);

      if (parentAnchoredStarts.length) return average(parentAnchoredStarts);

      const anchoredStarts = block.members
        .map((memberId, index) => {
          const key = baseKeyById.get(memberId);
          return Number.isFinite(key) ? key - index * NODE_STEP : Number.NaN;
        })
        .filter(value => Number.isFinite(value));

      if (!anchoredStarts.length) return Number.NaN;
      return average(anchoredStarts);
    });

    const firstCenters = [];
    if (generation === 0) {
      blocks.forEach((_block, index) => {
        firstCenters[index] = index === 0 ? 0 : firstCenters[index - 1] + minGapAfter(index - 1);
      });
    } else {
      const forward = [];
      for (let i = 0; i < blocks.length; i += 1) {
        const desired = Number.isFinite(desiredFirstCenters[i])
          ? desiredFirstCenters[i]
          : (i === 0 ? 0 : forward[i - 1] + minGapAfter(i - 1));
        forward[i] = i === 0
          ? desired
          : Math.max(desired, forward[i - 1] + minGapAfter(i - 1));
      }

      const backward = [];
      for (let i = blocks.length - 1; i >= 0; i -= 1) {
        const desired = Number.isFinite(desiredFirstCenters[i])
          ? desiredFirstCenters[i]
          : (i === blocks.length - 1 ? forward[i] : backward[i + 1] - minGapAfter(i));
        backward[i] = i === blocks.length - 1
          ? desired
          : Math.min(desired, backward[i + 1] - minGapAfter(i));
      }

      for (let i = 0; i < blocks.length; i += 1) {
        firstCenters[i] = (forward[i] + backward[i]) / 2;
      }
    }

    blocks.forEach((block, blockIndex) => {
      const firstCenter = firstCenters[blockIndex];
      block.members.forEach((memberId, memberIndex) => {
        provisionalXById.set(memberId, firstCenter + memberIndex * NODE_STEP);
      });
    });

    unionsAtGeneration.forEach(union => {
      const partnerXs = Array.isArray(union.partnerIds)
        ? union.partnerIds
          .map(partnerId => provisionalXById.get(partnerId))
          .filter(value => Number.isFinite(value))
        : [];

      if (partnerXs.length) {
        provisionalUnionXById.set(union.id, average(partnerXs));
      }
    });
  }

  if (!provisionalXById.size) return null;

  const nodes = [];
  const nodeById = new Map();
  people.forEach(person => {
    if (!provisionalXById.has(person.id)) return;
    const generation = Number(generationById[person.id]) || 0;
    const x = provisionalXById.get(person.id);
    const y = TOP_OFFSET + generation * LEVEL_GAP;
    const node = { ...person, generation, x, y };
    nodes.push(node);
    nodeById.set(person.id, node);
  });

  const unionPositions = new Map();
  unions.forEach(union => {
    const generation = Number.isFinite(union.generation)
      ? union.generation
      : Math.min(
        ...(Array.isArray(union.partnerIds)
          ? union.partnerIds
            .map(partnerId => Number(generationById[partnerId]))
            .filter(value => Number.isFinite(value))
          : [0])
      );

    const partnerXs = Array.isArray(union.partnerIds)
      ? union.partnerIds
        .map(partnerId => nodeById.get(partnerId))
        .filter(Boolean)
        .map(node => node.x)
      : [];

    if (!partnerXs.length) return;
    unionPositions.set(union.id, {
      x: average(partnerXs),
      y: TOP_OFFSET + generation * LEVEL_GAP,
      generation
    });
  });

  const lines = [];
  const dots = [];

  unions.forEach(union => {
    const unionPos = unionPositions.get(union.id);
    if (!unionPos) return;

    const partnerNodes = Array.isArray(union.partnerIds)
      ? union.partnerIds.map(partnerId => nodeById.get(partnerId)).filter(Boolean)
      : [];

    partnerNodes.forEach(partnerNode => {
      lines.push({
        x1: partnerNode.x,
        y1: unionPos.y,
        x2: unionPos.x,
        y2: unionPos.y
      });
    });

    dots.push({ x: unionPos.x, y: unionPos.y });

    const childNodes = Array.isArray(union.childIds)
      ? union.childIds.map(childId => nodeById.get(childId)).filter(Boolean)
      : [];

    if (!childNodes.length) return;

    const branchY = unionPos.y + BRANCH_DROP;
    lines.push({
      x1: unionPos.x,
      y1: unionPos.y,
      x2: unionPos.x,
      y2: branchY
    });

    const childXs = childNodes.map(child => child.x);
    if (childNodes.length > 1) {
      const branchStartX = Math.min(unionPos.x, ...childXs);
      const branchEndX = Math.max(unionPos.x, ...childXs);
      lines.push({
        x1: branchStartX,
        y1: branchY,
        x2: branchEndX,
        y2: branchY
      });
    } else {
      lines.push({
        x1: unionPos.x,
        y1: branchY,
        x2: childXs[0],
        y2: branchY
      });
    }

    childNodes.forEach(childNode => {
      lines.push({
        x1: childNode.x,
        y1: branchY,
        x2: childNode.x,
        y2: childNode.y - CHILD_ANCHOR_GAP
      });
    });
  });

  const lineXValues = lines.flatMap(line => [line.x1, line.x2]);
  const lineYValues = lines.flatMap(line => [line.y1, line.y2]);
  const nodeMinX = nodes.map(node => node.x - NODE_WIDTH / 2);
  const nodeMaxX = nodes.map(node => node.x + NODE_WIDTH / 2);
  const nodeMinY = nodes.map(node => node.y - AVATAR_RADIUS - 18);
  const nodeMaxY = nodes.map(node => node.y + 128);

  const minX = Math.min(...nodeMinX, ...(lineXValues.length ? lineXValues : [0]));
  const maxX = Math.max(...nodeMaxX, ...(lineXValues.length ? lineXValues : [0]));
  const minY = Math.min(...nodeMinY, ...(lineYValues.length ? lineYValues : [0]));
  const maxY = Math.max(...nodeMaxY, ...(lineYValues.length ? lineYValues : [0]));

  const shiftX = minX < 40 ? 40 - minX : 0;
  const shiftY = minY < 40 ? 40 - minY : 0;

  nodes.forEach(node => {
    node.x += shiftX;
    node.y += shiftY;
  });
  lines.forEach(line => {
    line.x1 += shiftX;
    line.x2 += shiftX;
    line.y1 += shiftY;
    line.y2 += shiftY;
  });
  dots.forEach(dot => {
    dot.x += shiftX;
    dot.y += shiftY;
  });

  const worldWidth = Math.ceil(maxX + shiftX + OUTER_PADDING);
  const worldHeight = Math.ceil(maxY + shiftY + OUTER_PADDING);

  return {
    nodes,
    lines,
    dots,
    worldWidth: Math.max(860, worldWidth),
    worldHeight: Math.max(560, worldHeight)
  };
}

function setupGraphView() {
  const graphView = document.getElementById('graph-view');
  const canvas = document.getElementById('graph-canvas');
  const world = document.getElementById('graph-world');
  const linksSvg = document.getElementById('graph-links');
  const nodesLayer = document.getElementById('graph-nodes');
  const resetBtn = document.getElementById('graph-reset-view');
  const graphData = readGraphData();
  const hasGraph = Boolean(graphData && Array.isArray(graphData.people) && graphData.people.length > 0);

  function showMessage(message) {
    if (!canvas) return;
    canvas.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'graph-instructions';
    msg.style.margin = '20px';
    msg.textContent = message;
    canvas.append(msg);
  }

  if (!graphView || !canvas || !world || !linksSvg || !nodesLayer) {
    return {
      hasGraph: false,
      show: () => {}
    };
  }

  let isRendered = false;
  let fitToViewport = null;

  function renderGraph() {
    if (isRendered) return;

    if (!hasGraph) {
      showMessage('No graph data available for this tree.');
      isRendered = true;
      return;
    }

    if (!window.d3 || typeof window.d3.graphConnect !== 'function' || typeof window.d3.sugiyama !== 'function') {
      showMessage('Graph layout libraries did not load. Reload the page to try again.');
      isRendered = true;
      return;
    }

    const layout = computeGraphLayout(graphData);
    if (!layout || !layout.nodes.length) {
      showMessage('Unable to build a graph layout from the current data.');
      isRendered = true;
      return;
    }

    const pathPrefix = graphView.dataset.pathPrefix || '/';
    world.style.width = `${layout.worldWidth}px`;
    world.style.height = `${layout.worldHeight}px`;

    linksSvg.setAttribute('width', String(layout.worldWidth));
    linksSvg.setAttribute('height', String(layout.worldHeight));

    const d3 = window.d3;
    const svgSelection = d3.select(linksSvg);
    svgSelection.selectAll('*').remove();

    svgSelection
      .selectAll('line')
      .data(layout.lines)
      .join('line')
      .attr('x1', line => line.x1)
      .attr('y1', line => line.y1)
      .attr('x2', line => line.x2)
      .attr('y2', line => line.y2);

    svgSelection
      .selectAll('circle')
      .data(layout.dots)
      .join('circle')
      .attr('cx', dot => dot.x)
      .attr('cy', dot => dot.y)
      .attr('r', 4.7);

    nodesLayer.innerHTML = '';
    layout.nodes.forEach(person => {
      const personEl = document.createElement('div');
      personEl.className = 'graph-person';
      if (person.deceased) personEl.classList.add('deceased');
      personEl.style.left = `${person.x}px`;
      personEl.style.top = `${person.y}px`;

      const avatarEl = document.createElement('div');
      avatarEl.className = `graph-avatar ${person.ringTone === 'orange' ? 'ring-orange' : 'ring-blue'}`;

      const fallbackEl = document.createElement('span');
      fallbackEl.className = 'graph-avatar-fallback';
      fallbackEl.textContent = person.initials || initials(person.fullName);
      avatarEl.append(fallbackEl);

      const photoSrc = resolveGraphPhotoUrl(person.photo, pathPrefix);
      if (photoSrc) {
        fallbackEl.style.display = 'none';
        const imgEl = document.createElement('img');
        imgEl.alt = `${person.fullName} portrait`;
        imgEl.loading = 'lazy';
        imgEl.src = photoSrc;
        imgEl.addEventListener('error', () => {
          imgEl.remove();
          fallbackEl.style.display = 'inline';
        }, { once: true });
        avatarEl.prepend(imgEl);
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'graph-person-name';
      nameEl.textContent = person.fullName;

      const subtitle = getDisplaySubtitle(person);
      const subtitleEl = document.createElement('div');
      subtitleEl.className = 'graph-person-subtitle';
      if (subtitle) {
        subtitleEl.textContent = subtitle;
      } else {
        subtitleEl.classList.add('is-empty');
      }

      personEl.append(avatarEl, nameEl, subtitleEl);
      nodesLayer.append(personEl);
    });

    const zoomSelection = d3.select(canvas);
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.25, 3.2])
      .on('zoom', event => {
        const { x, y, k } = event.transform;
        world.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      });

    zoomSelection.call(zoomBehavior);

    fitToViewport = (animate = true) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const scale = Math.min(rect.width / layout.worldWidth, rect.height / layout.worldHeight, 1);
      const translateX = (rect.width - layout.worldWidth * scale) / 2;
      const translateY = (rect.height - layout.worldHeight * scale) / 2;
      const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

      if (animate) {
        zoomSelection
          .transition()
          .duration(220)
          .call(zoomBehavior.transform, transform);
        return;
      }

      zoomSelection.call(zoomBehavior.transform, transform);
    };

    fitToViewport(false);
    isRendered = true;
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (typeof fitToViewport === 'function') {
        fitToViewport(true);
        announce('Graph zoom and pan reset.');
      }
    });
  }

  return {
    hasGraph,
    show: () => {
      renderGraph();
    }
  };
}

function setupViewSwitch(graphViewApi) {
  const listBtn = document.getElementById('view-list');
  const graphBtn = document.getElementById('view-graph');
  const listView = document.getElementById('list-view');
  const graphView = document.getElementById('graph-view');

  if (!listBtn || !graphBtn || !listView || !graphView) return;

  if (!graphViewApi.hasGraph) {
    graphBtn.disabled = true;
    graphBtn.title = 'No graph data is available for this dataset.';
  }

  function setView(nextView, updateUrl = true) {
    const showGraph = nextView === 'graph' && graphViewApi.hasGraph;
    listView.hidden = showGraph;
    graphView.hidden = !showGraph;

    listBtn.classList.toggle('is-active', !showGraph);
    graphBtn.classList.toggle('is-active', showGraph);
    listBtn.setAttribute('aria-pressed', showGraph ? 'false' : 'true');
    graphBtn.setAttribute('aria-pressed', showGraph ? 'true' : 'false');

    if (showGraph) {
      graphViewApi.show();
    }

    if (updateUrl) {
      const nextUrl = new URL(window.location.href);
      if (showGraph) {
        nextUrl.searchParams.set('view', 'graph');
      } else {
        nextUrl.searchParams.delete('view');
      }
      window.history.replaceState({}, '', nextUrl);
    }
  }

  listBtn.addEventListener('click', () => setView('list'));
  graphBtn.addEventListener('click', () => setView('graph'));

  const params = new URLSearchParams(window.location.search);
  const initialView = params.get('view') === 'graph' && graphViewApi.hasGraph ? 'graph' : 'list';
  setView(initialView, false);
}

setupInlineAvatarFallbacks();
setupNodeToggles();
setupDetailsOverlay();
applyPersonSelectionFromUrl();
const graphViewApi = setupGraphView();
setupViewSwitch(graphViewApi);
