'use strict';

const EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

const PHOTO_BY_NAME = {
  'King George V': 'https://i.pravatar.cc/120?img=12',
  'Queen Elizabeth, The Queen Mother': 'https://i.pravatar.cc/120?img=31',
  'Queen Elizabeth II': 'https://i.pravatar.cc/120?img=33',
  'Prince Philip, Duke of Edinburgh': 'https://i.pravatar.cc/120?img=59',
  'Charles, Prince of Wales': 'https://i.pravatar.cc/120?img=67',
  'Diana, Princess of Wales': 'https://i.pravatar.cc/120?img=47',
  'Camilla, Duchess of Cornwall (2nd)': 'https://i.pravatar.cc/120?img=21',
  'Prince William, Duke of Cambridge': 'https://i.pravatar.cc/120?img=15',
  'Catherine, Duchess of Cambridge': 'https://i.pravatar.cc/120?img=5',
  'Prince George of Cambridge': 'https://i.pravatar.cc/120?img=18',
  'Princess Charlotte of Cambridge': 'https://i.pravatar.cc/120?img=39',
  'Prince Louis of Cambridge': 'https://i.pravatar.cc/120?img=41',
  'Prince Harry, Duke of Sussex': 'https://i.pravatar.cc/120?img=69',
  'Meghan Markle': 'https://i.pravatar.cc/120?img=32',
  'Princess Anne, Princess Royal': 'https://i.pravatar.cc/120?img=24',
  'Prince Andrew, Duke of York': 'https://i.pravatar.cc/120?img=64',
  'Prince Edward, Earl of Wessex': 'https://i.pravatar.cc/120?img=54',
  'Princess Margaret, Countess of Snowdon': 'https://i.pravatar.cc/120?img=45'
};

function fallbackPhoto(name) {
  return `https://i.pravatar.cc/120?u=${encodeURIComponent(name || 'person')}`;
}

function setAvatar(container, personName, imgClass) {
  if (!container || !personName) return;

  const src = PHOTO_BY_NAME[personName] || fallbackPhoto(personName);
  container.innerHTML = '';

  const img = document.createElement('img');
  img.className = imgClass;
  img.alt = `${personName} portrait`;
  img.loading = 'lazy';
  img.src = src;

  img.addEventListener('error', () => {
    container.textContent = personName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }, { once: true });

  container.appendChild(img);
}

// ─── Helper: set expanded/collapsed state on a single .has-children node ──────
function setExpanded(li, expand) {
  const children = li.querySelector(':scope > .children');
  const icon = li.querySelector(':scope > .person-row > .person-row__content > .toggle-icon');
  if (!children) return;
  children.classList.toggle('collapsed', !expand);
  if (icon) icon.textContent = expand ? '▾' : '▸';
}

function getPersonName(li) {
  return li?.querySelector(':scope > .person-row .person-name')?.textContent.trim() || '';
}

function getSpouseDataFromBadge(badge) {
  const spouseName = badge.querySelector('.spouse-name')?.textContent.trim() || 'Unknown spouse';
  const extLink = badge.querySelector('.ext-link');

  return {
    name: spouseName,
    deceased: badge.classList.contains('deceased'),
    external: badge.classList.contains('external'),
    externalHref: extLink?.getAttribute('href') || ''
  };
}

function getSpousesForPerson(li) {
  return Array.from(li.querySelectorAll(':scope > .person-row .spouse-badge')).map(getSpouseDataFromBadge);
}

function renderSpouseRows(list, spouses) {
  if (!spouses.length) {
    list.innerHTML = '<div class="details-meta-value details-placeholder">No spouse recorded</div>';
    return;
  }

  list.innerHTML = '';

  spouses.forEach(spouse => {
    const row = document.createElement('div');
    row.className = 'details-spouse-row';
    if (spouse.deceased) row.classList.add('deceased');
    if (spouse.external) row.classList.add('external');

    const label = document.createElement('span');
    label.className = 'details-spouse-icon';
    label.textContent = '⚭';

    const name = document.createElement('span');
    name.textContent = spouse.name;

    row.append(label, name);

    if (spouse.external) {
      const tag = document.createElement('span');
      tag.className = 'details-spouse-ext-tag';
      tag.textContent = 'External family';
      row.appendChild(tag);
    }

    list.appendChild(row);
  });
}

function ensureLeafBullets() {
  document.querySelectorAll('.person.leaf .person-row__content').forEach(content => {
    if (content.querySelector('.leaf-icon')) return;

    const bullet = document.createElement('span');
    bullet.className = 'toggle-icon leaf-icon';
    bullet.textContent = '•';

    const personName = content.querySelector('.person-name');
    if (personName) {
      content.insertBefore(bullet, personName);
    }
  });
}

function ensureSpouseDetailsButtons() {
  document.querySelectorAll('.spouse-badge').forEach(badge => {
    if (badge.querySelector('.spouse-details-btn')) return;

    const spouseName = badge.querySelector('.spouse-name')?.textContent.trim() || 'spouse';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spouse-details-btn';
    btn.title = 'View spouse details';
    btn.setAttribute('aria-label', `View details for ${spouseName}`);
    btn.innerHTML = EYE_SVG;

    badge.appendChild(btn);
  });
}

function populateTreeAvatars() {
  document.querySelectorAll('.person').forEach(li => {
    const name = getPersonName(li);
    const avatar = li.querySelector(':scope > .person-row .person-avatar');
    setAvatar(avatar, name, 'person-photo');
  });
}

function initDetailsPanel() {
  const overlay = document.getElementById('details-overlay');
  const closeBtn = document.getElementById('details-close');
  const detailsName = document.getElementById('details-name');
  const detailsAvatar = document.getElementById('details-avatar');
  const detailsSpouses = document.getElementById('details-spouses');

  function openDetails(name, spouses) {
    detailsName.textContent = name;
    setAvatar(detailsAvatar, name, 'details-photo');
    renderSpouseRows(detailsSpouses, spouses);
    overlay.hidden = false;
  }

  function closeDetails() {
    overlay.hidden = true;
  }

  document.querySelectorAll('.person > .person-row .details-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const li = btn.closest('.person');
      openDetails(getPersonName(li), getSpousesForPerson(li));
    });
  });

  document.querySelectorAll('.spouse-details-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const badge = btn.closest('.spouse-badge');
      const personLi = btn.closest('.person');
      const primaryName = getPersonName(personLi);
      const spouseData = getSpouseDataFromBadge(badge);

      openDetails(spouseData.name, [{
        name: primaryName,
        deceased: false,
        external: false,
        externalHref: ''
      }]);
    });
  });

  closeBtn.addEventListener('click', closeDetails);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDetails();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) closeDetails();
  });
}

// ─── Toggle a node when its person-row is clicked ─────────────────────────────
document.querySelectorAll('.has-children > .person-row').forEach(row => {
  row.addEventListener('click', function (e) {
    // Let links and all detail buttons pass through without collapsing the node
    if (e.target.closest('a') || e.target.closest('button')) return;

    const li = this.closest('.person.has-children');
    const children = li.querySelector(':scope > .children');
    if (!children) return;

    const isCurrentlyCollapsed = children.classList.contains('collapsed');
    setExpanded(li, isCurrentlyCollapsed);
  });
});

// ─── Expand All ───────────────────────────────────────────────────────────────
document.getElementById('expand-all').addEventListener('click', () => {
  document.querySelectorAll('.person.has-children').forEach(li => setExpanded(li, true));
});

// ─── Collapse All (keeps root level visible) ──────────────────────────────────
document.getElementById('collapse-all').addEventListener('click', () => {
  document.querySelectorAll('.person.has-children').forEach(li => setExpanded(li, false));

  const rootNode = document.querySelector('.family-tree > .person.has-children');
  if (rootNode) setExpanded(rootNode, true);
});

ensureLeafBullets();
ensureSpouseDetailsButtons();
populateTreeAvatars();
initDetailsPanel();
