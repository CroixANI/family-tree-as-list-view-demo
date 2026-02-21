'use strict';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function setExpanded(li, expand) {
  const children = li.querySelector(':scope > .children');
  const icon = li.querySelector(':scope > .person-row > .person-row__content > .toggle-icon');
  if (!children) return;
  children.classList.toggle('collapsed', !expand);
  if (icon) icon.textContent = expand ? '▾' : '▸';
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
  const closeBtn = document.getElementById('details-close');
  const detailsName = document.getElementById('details-name');
  const detailsAvatar = document.getElementById('details-avatar');
  const detailsSpouses = document.getElementById('details-spouses');

  if (!overlay || !closeBtn || !detailsName || !detailsAvatar || !detailsSpouses) return;

  function openDetails(name, photoSrc, spouses) {
    detailsName.textContent = name;
    createAvatarContent(detailsAvatar, name, photoSrc);
    renderDetailsSpouses(detailsSpouses, spouses);
    overlay.hidden = false;
  }

  function closeDetails() {
    overlay.hidden = true;
  }

  document.querySelectorAll('.person > .person-row .details-btn').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation();
      const row = btn.closest('.person-row');
      const personName = row.querySelector('.person-name')?.textContent.trim() || 'Unknown person';
      const personPhoto = getPersonPhotoSource(row);
      const spouses = getSpousesFromRow(row);
      openDetails(personName, personPhoto, spouses);
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

      const primaryName = personRow.querySelector('.person-name')?.textContent.trim() || 'Unknown person';
      openDetails(spouseName, spousePhoto, [{
        name: primaryName,
        external: false,
        deceased: false
      }]);

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
  document.querySelectorAll('.has-children > .person-row').forEach(row => {
    row.addEventListener('click', function(event) {
      if (event.target.closest('a') || event.target.closest('button')) return;

      const li = this.closest('.person.has-children');
      const children = li.querySelector(':scope > .children');
      if (!children) return;

      const isCollapsed = children.classList.contains('collapsed');
      setExpanded(li, isCollapsed);
    });
  });

  const expandAll = document.getElementById('expand-all');
  const collapseAll = document.getElementById('collapse-all');

  if (expandAll) {
    expandAll.addEventListener('click', () => {
      document.querySelectorAll('.person.has-children').forEach(li => setExpanded(li, true));
    });
  }

  if (collapseAll) {
    collapseAll.addEventListener('click', () => {
      document.querySelectorAll('.person.has-children').forEach(li => setExpanded(li, false));
      const rootNode = document.querySelector('.family-tree > .person.has-children');
      if (rootNode) setExpanded(rootNode, true);
    });
  }
}

setupNodeToggles();
setupDetailsOverlay();
