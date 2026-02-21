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

setupNodeToggles();
setupDetailsOverlay();
