
const DB_KEYS = {
  players: 'pfss_players_v1',
  reports: 'pfss_reports_v1'
};

let players = read(DB_KEYS.players, []);
let reports = read(DB_KEYS.reports, []);
let mediaItems = [];
let playerSearchHasRun = false;

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function write() {
  localStorage.setItem(DB_KEYS.players, JSON.stringify(players));
  localStorage.setItem(DB_KEYS.reports, JSON.stringify(reports));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function initials(name = '') {
  return name.trim().split(/\s+/)
    .slice(0, 2)
    .map(x => x[0] || '')
    .join('')
    .toUpperCase() || 'PF';
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => el.classList.remove('show'),
    2600
  );
}

function showView(view, navElement = null, fromPopState = false) {
  const selectedLabel = navElement?.textContent?.trim() || (
    view === 'team-workspace' ? 'Mannschaftsübersicht' : ''
  );
  if (!fromPopState && window.history?.pushState) {
    const current = window.history.state;
    if (!current?.pfssView || current.pfssView !== view || current.pfssLabel !== selectedLabel) {
      window.history.pushState(
        { pfssView: view, pfssLabel: selectedLabel },
        '',
        window.location.pathname + window.location.search
      );
    }
  }
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.id === `view-${view}`);
  });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  document.querySelectorAll('.nav-subitem').forEach(el => {
    el.classList.toggle('active', el === navElement);
  });
  const clubViews = ['clubs', 'teams', 'club-members', 'club-admin', 'club-scouting'];
  const clubToggle = document.querySelector('[data-nav-toggle="clubSubnav"]');
  const clubSubnav = document.getElementById('clubSubnav');
  if (clubToggle && clubSubnav && clubViews.includes(view)) {
    clubSubnav.hidden = false;
    clubToggle.setAttribute('aria-expanded', 'true');
    clubToggle.classList.add('expanded', 'active');
  } else if (clubToggle && clubSubnav) {
    clubToggle.classList.remove('active');
  }
  const teamToggle = document.querySelector('[data-nav-toggle="teamSubnav"]');
  const teamSubnav = document.getElementById('teamSubnav');
  if (teamToggle && teamSubnav && view === 'team-workspace') {
    teamSubnav.hidden = false;
    teamToggle.setAttribute('aria-expanded', 'true');
    teamToggle.classList.add('expanded', 'active');
  } else if (teamToggle && teamSubnav) {
    teamToggle.classList.remove('active');
  }

  const names = {
    dashboard: 'Dashboard',
    clubs: 'Vereinsübersicht',
    teams: 'Mannschaften',
    'club-members': 'Mitgliedschaften',
    'club-admin': 'Verwaltung',
    'club-scouting': 'Scouting-Abteilung',
    staff: 'Trainer & Betreuer',
    scouts: 'Scouts',
    players: 'Spieler',
    reports: 'Scouting-Berichte',
    media: 'Medien',
    admin: 'Administration',
    backup: 'Datensicherung',
    'team-workspace': 'Meine Mannschaft'
  };

  if (view === 'team-workspace') {
    const teamCards = [...document.querySelectorAll('#view-team-workspace .team-module-grid .module-card')];
    const teamLabel = selectedLabel || 'Mannschaftsübersicht';
    const overviewNote = document.querySelector('#view-team-workspace .team-workspace-note');
    teamCards.forEach(card => {
      const heading = card.querySelector('h3')?.textContent?.trim() || '';
      card.hidden = teamLabel === 'Mannschaftsübersicht' || heading !== teamLabel;
    });
    if (overviewNote) overviewNote.hidden = selectedLabel !== 'Mannschaftsübersicht';
    const heading = document.querySelector('#view-team-workspace .page-heading h1');
    if (heading) heading.textContent = teamLabel;
    const intro = document.querySelector('#view-team-workspace .page-heading p');
    if (intro) intro.textContent = teamLabel === 'Mannschaftsübersicht'
      ? 'Die zentrale Übersicht deines Mannschaftsbereichs.'
      : 'Der ausgewählte Bereich deiner Mannschaft.';
  }

  document.getElementById('pageTitle').textContent =
    names[view] || 'Dashboard';

  document.getElementById('sidebar').classList.remove('open');
  document.body.classList.remove('sidebar-open');

  if (view === 'players') renderPlayers();
  if (view === 'reports') renderReports();
  if (view === 'dashboard') renderDashboard();
  if (view === 'admin') loadAdminUsers();
}

function openDialog(id) {
  if (id === 'reportDialog') populatePlayerSelect();
  document.getElementById(id).showModal();
}

function closeDialog(id) {
  document.getElementById(id).close();
}

function populatePlayerSelect() {
  const select = document.getElementById('reportPlayerSelect');

  select.innerHTML =
    '<option value="">Spieler auswählen</option>' +
    players.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');
}

function renderDashboard() {
  document.getElementById('statPlayers').textContent = players.length;
  document.getElementById('statReports').textContent = reports.length;
  document.getElementById('statMedia').textContent = mediaItems.length;

  const avg = reports.length
    ? reports.reduce((sum, r) => sum + Number(r.rating), 0) / reports.length
    : null;

  document.getElementById('statRating').textContent =
    avg === null ? '–' : avg.toFixed(1);

  const host = document.getElementById('recentPlayers');

  if (!players.length) {
    host.className = 'empty-state';
    host.innerHTML = `
      <span class="empty-icon">♙</span>
      <b>Noch keine Spieler vorhanden</b>
      <p>Lege deinen ersten Spieler an, um deine Datenbank aufzubauen.</p>
      <button class="btn btn-secondary" data-action="new-player">
        Spieler anlegen
      </button>`;
    return;
  }

  host.className = 'player-grid';
  host.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';

  host.innerHTML = players.slice(-4).reverse()
    .map(playerCard).join('');
}

function playerCard(p) {
  return `
    <article class="player-card">
      <div class="player-card-top">
        <div class="player-initial">${escapeHtml(initials(p.name))}</div>
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <small>${escapeHtml(p.club || 'Verein nicht angegeben')}</small>
        </div>
      </div>
      <div class="player-meta">
        <span class="tag">${escapeHtml(p.position)}</span>
        ${p.nationality ? `<span class="tag">${escapeHtml(p.nationality)}</span>` : ''}
        ${p.foot ? `<span class="tag">${escapeHtml(p.foot)}</span>` : ''}
      </div>
    </article>`;
}

function pfssNormalizeSearch(value) {
  return String(value ?? '').trim().toLocaleLowerCase('de-DE');
}
function pfssPlayerSurname(player) {
  if (player.surname) return String(player.surname).trim();
  const parts = String(player.name || '').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : '';
}
function renderPlayers() {
  const host = document.getElementById('playerGrid');
  const criteria = {
    surname: pfssNormalizeSearch(document.getElementById('playerSearchSurname')?.value),
    club: pfssNormalizeSearch(document.getElementById('playerSearchClub')?.value),
    position: pfssNormalizeSearch(document.getElementById('playerSearchPosition')?.value),
    foot: pfssNormalizeSearch(document.getElementById('playerSearchFoot')?.value),
    yearFrom: Number(document.getElementById('playerSearchYearFrom')?.value || 0),
    yearTo: Number(document.getElementById('playerSearchYearTo')?.value || 0),
    joinDate: String(document.getElementById('playerSearchJoinDate')?.value || '').trim()
  };
  const sortBy = document.getElementById('playerSortBy')?.value || 'surname';
  const direction = document.getElementById('playerSortDirection')?.value === 'desc' ? -1 : 1;
  const filtered = players.filter(player => {
    const surname = pfssNormalizeSearch(pfssPlayerSurname(player));
    const club = pfssNormalizeSearch(player.club);
    const position = pfssNormalizeSearch(player.position);
    const birthYear = String(player.birth || '').slice(0, 4);
    const foot = pfssNormalizeSearch(player.foot);
    const birthYearNumber = Number(birthYear) || 0;
    const joinDate = String(player.joinDate || '').slice(0, 10);
    return (!criteria.surname || surname.includes(criteria.surname)) &&
      (!criteria.club || club.includes(criteria.club)) &&
      (!criteria.position || position === criteria.position) &&
      (!criteria.foot || foot === criteria.foot) &&
      (!criteria.yearFrom || (birthYearNumber > 0 && birthYearNumber >= criteria.yearFrom)) &&
      (!criteria.yearTo || (birthYearNumber > 0 && birthYearNumber <= criteria.yearTo)) &&
      (!criteria.joinDate || joinDate === criteria.joinDate);
  });
  filtered.sort((a,b) => {
    if (sortBy === 'year') return ((Number(String(a.birth||'').slice(0,4))||0) - (Number(String(b.birth||'').slice(0,4))||0)) * direction;
    let left, right;
    if (sortBy === 'position') { left=pfssNormalizeSearch(a.position); right=pfssNormalizeSearch(b.position); }
    else if (sortBy === 'joinDate') {
      left=String(a.joinDate||''); right=String(b.joinDate||'');
      if (!left && right) return 1;
      if (left && !right) return -1;
    }
    else { left=pfssNormalizeSearch(pfssPlayerSurname(a)); right=pfssNormalizeSearch(pfssPlayerSurname(b)); }
    return left.localeCompare(right,'de',{numeric:true,sensitivity:'base'}) * direction;
  });
  host.classList.add('player-results-list');
  const count=document.getElementById('playerSearchCount');
  if(count) count.textContent=playerSearchHasRun ? filtered.length+' Treffer gefunden' : players.length+' Spieler insgesamt';
  host.innerHTML=filtered.length ? filtered.map(playerCard).join('') : `
    <div class="empty-state wide"><span class="empty-icon">⌕</span><b>Keine passenden Spieler gefunden</b><p>Bitte passe deine Suchkriterien an.</p></div>`;
}

function renderReports() {
  const host = document.getElementById('reportList');

  if (!reports.length) {
    host.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">▤</span>
        <b>Noch keine Berichte vorhanden</b>
        <p>Erstelle einen Bericht, um Spielerleistungen zu dokumentieren.</p>
        <button class="btn btn-secondary" data-action="new-report">
          Bericht erstellen
        </button>
      </div>`;
    return;
  }

  host.innerHTML = reports.slice().reverse().map(r => {
    const p = players.find(x => x.id === r.playerId);

    return `
      <article class="report-card">
        <div class="rating-bubble">${escapeHtml(r.rating)}</div>
        <div>
          <h3>${escapeHtml(p?.name || 'Unbekannter Spieler')}</h3>
          <small>${escapeHtml(r.date || 'Ohne Datum')} · Scouting-Bewertung</small>
          <p>${escapeHtml(r.notes)}</p>
        </div>
      </article>`;
  }).join('');
}

function savePlayer(form) {
  const data = Object.fromEntries(new FormData(form).entries());

  players.push({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),
    ...data,
    createdAt: new Date().toISOString()
  });

  write();
  form.reset();
  closeDialog('playerDialog');
  renderDashboard();
  renderPlayers();
  toast('Spielerprofil wurde gespeichert.');
}

function saveReport(form) {
  const data = Object.fromEntries(new FormData(form).entries());

  reports.push({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),
    ...data,
    createdAt: new Date().toISOString()
  });

  write();
  form.reset();
  closeDialog('reportDialog');
  renderDashboard();
  renderReports();
  toast('Scouting-Bericht wurde gespeichert.');
}


function exportPfssBackup() {
  const backup = {
    product: 'PFSS',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data: { players, reports }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PFSS-Backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('PFSS-Backup wurde erstellt.');
}

function importPfssBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(String(reader.result || ''));
      if (backup?.product !== 'PFSS' || backup?.formatVersion !== 1 ||
          !Array.isArray(backup?.data?.players) || !Array.isArray(backup?.data?.reports)) {
        throw new Error('Ungültiges PFSS-Backupformat');
      }
      const importedPlayers = backup.data.players;
      const importedReports = backup.data.reports;
      const validPlayers = importedPlayers.every(p =>
        p && typeof p === 'object' && typeof p.id === 'string' &&
        typeof p.name === 'string' && typeof p.position === 'string'
      );
      const playerIds = new Set(importedPlayers.map(p => p.id));
      const validReports = importedReports.every(r =>
        r && typeof r === 'object' && typeof r.id === 'string' &&
        typeof r.playerId === 'string' && playerIds.has(r.playerId) &&
        Number.isFinite(Number(r.rating)) && typeof r.notes === 'string'
      );
      if (!validPlayers || !validReports) {
        throw new Error('Backup enthält unvollständige oder ungültige Datensätze');
      }
      const confirmed = window.confirm(
        `Backup enthält ${importedPlayers.length} Spieler und ${importedReports.length} Berichte.\\n\\nDie aktuell gespeicherten Spieler und Berichte in diesem Browser werden dadurch ersetzt. Vorher bitte bei Bedarf ein Backup exportieren. Fortfahren?`
      );
      if (!confirmed) return;
      players = importedPlayers;
      reports = importedReports;
      write();
      renderDashboard();
      renderPlayers();
      renderReports();
      toast('Backup erfolgreich wiederhergestellt.');
    } catch (error) {
      toast('Backup ungültig oder beschädigt. Es wurden keine Daten geändert.');
    }
  };
  reader.onerror = () => toast('Die Backup-Datei konnte nicht gelesen werden.');
  reader.readAsText(file);
}

function addMedia(files) {
  [...files].forEach(file => {
    if (
      !file.type.startsWith('image/') &&
      !file.type.startsWith('video/')
    ) return;

    const url = URL.createObjectURL(file);

    mediaItems.push({
      name: file.name,
      type: file.type,
      url
    });

    const card = document.createElement('article');
    card.className = 'media-card';

    const media = file.type.startsWith('video/')
      ? document.createElement('video')
      : document.createElement('img');

    media.src = url;

    if (media.tagName === 'VIDEO') {
      media.controls = true;
      media.playsInline = true;
    } else {
      media.alt = file.name;
    }

    const caption = document.createElement('div');
    caption.textContent = file.name;

    card.append(media, caption);
    document.getElementById('mediaGrid').append(card);
  });

  renderDashboard();

  if (files.length) {
    toast('Dateien hinzugefügt. Hinweis: vorerst nur in dieser Sitzung verfügbar.');
  }
}

document.addEventListener('click', event => {
  const navToggle = event.target.closest('[data-nav-toggle]');
  if (navToggle) {
    const submenu = document.getElementById(navToggle.dataset.navToggle);
    const willOpen = submenu.hidden;
    submenu.hidden = !willOpen;
    navToggle.setAttribute('aria-expanded', String(willOpen));
    navToggle.classList.toggle('expanded', willOpen);
    return;
  }

  const view = event.target.closest('[data-view]');

  if (view) {
    showView(view.dataset.view, view);
    return;
  }

  const skeletonAction = event.target.closest('[data-skeleton-action]');
  if (skeletonAction) {
    toast(`${skeletonAction.dataset.skeletonAction}-Modul ist vorbereitet; Datenbank-Anbindung folgt.`);
    return;
  }

  const adminSave = event.target.closest('[data-admin-save]');
  if (adminSave) { saveAdminUser(adminSave); return; }

  const action = event.target.closest('[data-action]')?.dataset.action;

  if (action === 'new-player') {
    openDialog('playerDialog');
  }

  if (action === 'new-report') {
    if (!players.length) {
      toast('Bitte lege zuerst einen Spieler an.');
      showView('players');
      return;
    }

    openDialog('reportDialog');
  }

  const close = event.target.closest('[data-close]')?.dataset.close;

  if (close) closeDialog(close);
});

document.getElementById('playerForm')
  .addEventListener('submit', e => {
    e.preventDefault();
    savePlayer(e.currentTarget);
  });

document.getElementById('reportForm')
  .addEventListener('submit', e => {
    e.preventDefault();
    saveReport(e.currentTarget);
  });

document.getElementById('playerSearchForm').addEventListener('submit', event => {
  event.preventDefault(); playerSearchHasRun=true; renderPlayers();
});
document.getElementById('playerSearchForm').addEventListener('reset', () => window.setTimeout(() => {
  playerSearchHasRun=false; renderPlayers();
},0));
document.getElementById('adminUserSearchForm').addEventListener('submit', event => {
  event.preventDefault(); loadAdminUsers();
});
document.getElementById('adminUserSearchForm').addEventListener('reset', () => window.setTimeout(loadAdminUsers,0));
document.getElementById('refreshAdminButton').addEventListener('click',loadAdminUsers);

document.getElementById('mediaInput')
  .addEventListener('change', e => {
    addMedia(e.target.files);
    e.target.value = '';
  });

document.querySelectorAll('input[type=file]:not(#mediaInput)')
  .forEach(input => {
    input.addEventListener('change', e => {
      addMedia(e.target.files);
      e.target.value = '';
    });
  });

window.addEventListener('popstate', event => {
  const state = event.state;
  if (!state?.pfssView) return;
  const candidates = [...document.querySelectorAll('[data-view]')];
  const navElement = candidates.find(el =>
    el.dataset.view === state.pfssView &&
    (!state.pfssLabel || el.textContent.trim() === state.pfssLabel)
  ) || null;
  showView(state.pfssView, navElement, true);
});

document.getElementById('menuToggle')
  .addEventListener('click', () => {
    const isOpen = document.getElementById('sidebar').classList.toggle('open');
    document.body.classList.toggle('sidebar-open', isOpen);
  });

// Mobile Sidebar: mit einer horizontalen Wischbewegung nach links schließen.
(() => {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  let touchStart = null;
  const mobileQuery = window.matchMedia('(max-width: 760px)');

  sidebar.addEventListener('touchstart', event => {
    if (!mobileQuery.matches || !sidebar.classList.contains('open')) {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  sidebar.addEventListener('touchend', event => {
    if (!touchStart || !mobileQuery.matches || !sidebar.classList.contains('open')) {
      touchStart = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    touchStart = null;

    // Nur eine deutliche Linksbewegung schließt; vertikales Scrollen bleibt normal.
    if (deltaX <= -65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
    }
  }, { passive: true });

  sidebar.addEventListener('touchcancel', () => {
    touchStart = null;
  }, { passive: true });
})();

renderDashboard();

document.getElementById('exportBackupButton')
  .addEventListener('click', exportPfssBackup);
document.getElementById('importBackupButton')
  .addEventListener('click', () => document.getElementById('backupFileInput').click());
document.getElementById('backupFileInput')
  .addEventListener('change', event => {
    importPfssBackup(event.target.files?.[0]);
    event.target.value = '';
  });

// ============================================
// PFSS AUTHENTICATION – SUPABASE
// ============================================

const PFSS_SUPABASE_URL =
  'https://nkkajhjdvfjzrvxkbokg.supabase.co';

const PFSS_SUPABASE_KEY =
  'sb_publishable_0FH-h-DJDhEnF4TKzTUiBg_7hDljTHi';

const pfssSupabase = window.supabase.createClient(
  PFSS_SUPABASE_URL,
  PFSS_SUPABASE_KEY
);

function updateConnectionStatus() {
  const online = navigator.onLine;
  const userDot = document.getElementById('userPresenceDot');
  if (userDot) {
    userDot.classList.toggle('is-offline', !online);
    userDot.setAttribute('aria-label', online ? 'Benutzer online' : 'Benutzer offline');
  }
  const systemTitle = document.getElementById('systemStatusTitle');
  const connectionText = document.getElementById('connectionStatusText');
  const connectionStatus = document.getElementById('connectionStatus');
  const dots = [
    document.getElementById('systemStatusDot'),
    document.getElementById('connectionStatusDot')
  ];

  dots.forEach(dot => {
    if (dot) dot.classList.toggle('is-offline', !online);
  });

  if (systemTitle) systemTitle.textContent = online ? 'System bereit' : 'System offline';
  if (connectionText) connectionText.textContent = online ? 'ONLINE' : 'OFFLINE';
  if (connectionStatus) connectionStatus.classList.toggle('is-offline', !online);
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

function showAuthScreen() {
  window.scrollTo(0, 0);
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('pendingScreen').classList.add('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

function showPendingScreen(status) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('pendingScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');

  const title = document.getElementById('pendingTitle');
  const message = document.getElementById('pendingText');

  if (status === 'suspended') {
    title.textContent = 'Zugang gesperrt';
    message.textContent =
      'Dein Konto ist derzeit gesperrt. Bitte wende dich an die Administration.';
  } else {
    title.textContent = 'Freigabe ausstehend';
    message.textContent =
      'Dein Konto wurde angelegt. Der Zugang wird nach Prüfung freigeschaltet.';
  }
}

function applyAdminPreviewMode(mode) {
  if (!window.pfssIsRealAdmin) return;

  const allowed = ['admin','scout','agency','club','member'];
  if (!allowed.includes(mode)) mode = 'admin';

  const configs = {
    admin: {
      label: 'ADMIN-MODUS',
      target: 'admin',
      views: ['clubs','agencies','scouts','admin-members','players','admin-errors','admin-inbox','admin-payments','admin','backup'],
      groups: []
    },
    scout: {
      label: 'VORSCHAU: SCOUT',
      target: 'scouts',
      views: ['dashboard','scouts','players','reports','media'],
      groups: []
    },
    agency: {
      label: 'VORSCHAU: AGENTUR',
      target: 'agencies',
      views: ['dashboard','agencies','scouts','players','reports','media'],
      groups: []
    },
    club: {
      label: 'VORSCHAU: VEREIN',
      target: 'clubs',
      views: ['dashboard','clubs','teams','club-members','club-admin','club-scouting','team-workspace','reports','media'],
      groups: ['clubSubnav','teamSubnav']
    },
    member: {
      label: 'VORSCHAU: MITGLIED',
      target: 'dashboard',
      views: ['dashboard','players','reports','media'],
      groups: []
    }
  };

  const config = configs[mode];
  window.pfssPreviewMode = mode;

  const label = document.getElementById('previewModeLabel');
  if (label) label.textContent = config.label;

  const adminNavSection = document.getElementById('adminNavSection');
  if (adminNavSection) adminNavSection.hidden = mode !== 'admin' && mode !== 'club' && mode !== 'agency' && mode !== 'scout';

  document.querySelectorAll('.sidebar [data-view]').forEach(item => {
    const view = item.dataset.view;
    item.hidden = !config.views.includes(view);
  });

  const clubToggle = document.querySelector('[data-nav-toggle="clubSubnav"]');
  const clubSubnav = document.getElementById('clubSubnav');
  const teamToggle = document.querySelector('[data-nav-toggle="teamSubnav"]');
  const teamSubnav = document.getElementById('teamSubnav');

  if (clubToggle) clubToggle.hidden = !config.groups.includes('clubSubnav');
  if (clubSubnav) clubSubnav.hidden = true;
  if (teamToggle) teamToggle.hidden = !config.groups.includes('teamSubnav');
  if (teamSubnav) teamSubnav.hidden = true;

  [clubToggle, teamToggle].forEach(toggle => {
    if (!toggle) return;
    toggle.classList.remove('active','expanded');
    toggle.setAttribute('aria-expanded','false');
  });

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('admin-mode', mode === 'admin');

  const consoles = {
    club: document.getElementById('adminClubConsole'),
    agency: document.getElementById('adminAgencyConsole'),
    scout: document.getElementById('adminScoutConsole')
  };
  Object.entries(consoles).forEach(([key,element]) => {
    if (element) element.hidden = mode !== 'admin';
  });

  const nav = [...document.querySelectorAll('.sidebar [data-view]')]
    .find(el => el.dataset.view === config.target && !el.hidden) || null;

  showView(config.target, nav, true);

  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    const pageNames = {
      admin: 'Administration',
      scout: 'Scouts',
      agency: 'Agenturen',
      club: 'Vereinsübersicht',
      member: 'Dashboard'
    };
    pageTitle.textContent = mode === 'admin'
      ? pageNames.admin
      : config.label + ' · ' + pageNames[mode];
  }
}

function showAuthenticatedApp(user, profile) {
  window.scrollTo(0, 0);
  const role = String(profile.role || '').toLowerCase().replace(/[ä]/g,'ae').replace(/[ö]/g,'oe').replace(/[ü]/g,'ue');
  const username = profile.username || user.email || 'PFMS Nutzer';
  const isAdmin = role === 'admin' || role === 'administrator';
  const adminClubConsole = document.getElementById('adminClubConsole');
  const adminScoutConsole = document.getElementById('adminScoutConsole');
  if (adminClubConsole) adminClubConsole.hidden = !isAdmin;
  if (adminScoutConsole) adminScoutConsole.hidden = !isAdmin;
  const isScout = role.includes('scout');
  const isTeam = ['trainer','co-trainer','cotrainer','betreuer','coach'].some(x => role.includes(x));
  const isClub = ['praesident','präsident','vorstand','jugendleiter','vereinsleiter'].some(x => role.includes(x));
  const normalStartView = isAdmin ? 'admin' : isScout ? 'scouts' : isTeam ? 'team-workspace' : isClub ? 'clubs' : 'dashboard';
  const firstLoginKey = 'pfms_first_dashboard_seen_' + user.id;
  const sessionWelcomeKey = 'pfms_welcome_session_' + user.id;
  let firstLogin = false;
  let newAuthenticatedSession = false;
  try {
    firstLogin = localStorage.getItem(firstLoginKey) !== '1';
    newAuthenticatedSession = sessionStorage.getItem(sessionWelcomeKey) !== '1';
    if (firstLogin) localStorage.setItem(firstLoginKey, '1');
    if (newAuthenticatedSession) sessionStorage.setItem(sessionWelcomeKey, '1');
  } catch (storageError) {
    firstLogin = false;
    newAuthenticatedSession = false;
  }
  const showIntro = firstLogin;
  const showReturningGreeting = !firstLogin && newAuthenticatedSession;
  const startView = showIntro ? 'dashboard' : normalStartView;
  const introPanel = document.getElementById('firstLoginIntro');
  const returningPanel = document.getElementById('returningWelcome');
  if (introPanel) introPanel.hidden = !showIntro;
  if (returningPanel) returningPanel.hidden = !showReturningGreeting;

  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('pendingScreen').classList.add('hidden');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('accountEmail').textContent = username;
  document.querySelector('.profile-mini small').textContent =
    isAdmin ? 'Administrator' : isScout ? 'Scout' : isTeam ? 'Trainerteam' : isClub ? 'Vereinsverwaltung' : 'Mitglied';
  const adminNavSection = document.getElementById('adminNavSection');
  if (adminNavSection) adminNavSection.hidden = !isAdmin;
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('admin-mode', isAdmin);
  document.querySelectorAll('.sidebar [data-view]').forEach(item => {
    if (!item.classList.contains('admin-nav-item')) item.hidden = isAdmin;
  });
  window.pfssCurrentUserId = user.id;
  window.pfssCurrentRole = profile.role;
  window.pfssIsRealAdmin = isAdmin;
  window.pfssPreviewMode = 'admin';
  const previewSwitch = document.getElementById('adminPreviewSwitch');
  const previewSelect = document.getElementById('adminPreviewMode');
  if (previewSwitch) previewSwitch.hidden = !isAdmin;
  if (previewSelect) {
    previewSelect.value = 'admin';
    if (!previewSelect.dataset.bound) {
      previewSelect.addEventListener('change', () => applyAdminPreviewMode(previewSelect.value));
      previewSelect.dataset.bound = 'true';
    }
  }
  applyAdminPreviewMode('admin');
  setupPfmsAdminManagement();
  const userIdDisplay = document.getElementById('userIdDisplay');
  const userIdValue = document.getElementById('userIdValue');
  if (userIdDisplay && userIdValue) {
    userIdValue.textContent = user.id;
    userIdDisplay.hidden = false;
    const copyUserIdButton = document.getElementById('copyUserIdButton');
    if (copyUserIdButton && !copyUserIdButton.dataset.copyBound) {
      copyUserIdButton.addEventListener('click', async () => {
        const id = window.pfssCurrentUserId;
        if (!id) return;
        try {
          await navigator.clipboard.writeText(id);
          copyUserIdButton.innerHTML = '<span class="user-id-copy-icon">✓</span>';
          copyUserIdButton.title = 'User-ID kopiert';
          window.setTimeout(() => {
            copyUserIdButton.innerHTML = '<span class="user-id-copy-icon">⧉</span>';
            copyUserIdButton.title = 'User-ID kopieren';
          }, 1600);
        } catch (error) {
          window.prompt('User-ID kopieren:', id);
        }
      });
      copyUserIdButton.dataset.copyBound = 'true';
    }
  }
  document.getElementById('accountStatus').textContent = 'Freigegeben';
  renderDashboard();

  const welcome = document.getElementById('welcomeSequence');
  const welcomeUser = document.getElementById('welcomeUser');
  if (welcomeUser) welcomeUser.textContent = 'Willkommen, ' + username + '!';
  if (welcome) welcome.classList.remove('hidden');
  window.clearTimeout(window.pfmsWelcomeTimer);
  window.pfmsWelcomeTimer = window.setTimeout(() => {
    window.scrollTo(0, 0);
    if (welcome) welcome.classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    window.history.replaceState(
      { pfssView: startView, pfssLabel: startView === 'team-workspace' ? 'Mannschaftsübersicht' : startView },
      '',
      window.location.pathname + window.location.search
    );
    const nav = [...document.querySelectorAll('[data-view]')].find(el => el.dataset.view === startView &&
      (startView !== 'team-workspace' || el.textContent.trim() === 'Mannschaftsübersicht'));
    showView(startView, nav, true);
  }, 4500);
}

async function loadAdminUsers() {
  const message = document.getElementById('adminMessage');
  const host = document.getElementById('adminUserList');
  if (window.pfssCurrentRole !== 'admin') {
    message.textContent = 'Kein Administratorzugang.';
    host.innerHTML = '';
    return;
  }
  message.textContent = 'Benutzer werden geladen …';
  try {
    const { data, error } = await pfssSupabase.rpc('pfss_admin_list_profiles');
    if (error) throw error;
    const users = data || [];
    document.getElementById('adminTotalUsers').textContent = users.length;
    document.getElementById('adminPendingUsers').textContent = users.filter(x => x.status === 'pending').length;
    document.getElementById('adminApprovedUsers').textContent = users.filter(x => x.status === 'approved').length;
    document.getElementById('adminSuspendedUsers').textContent = users.filter(x => x.status === 'suspended').length;
    const nameQuery=pfssNormalizeSearch(document.getElementById('adminUserSearchName')?.value);
    const idQuery=pfssNormalizeSearch(document.getElementById('adminUserSearchId')?.value);
    const roleQuery=document.getElementById('adminUserSearchRole')?.value||'';
    const statusQuery=document.getElementById('adminUserSearchStatus')?.value||'';
    const filtered=users.filter(user =>
      (!nameQuery||pfssNormalizeSearch(user.username).includes(nameQuery)) &&
      (!idQuery||pfssNormalizeSearch(user.id).includes(idQuery)) &&
      (!roleQuery||user.role===roleQuery) &&
      (!statusQuery||user.status===statusQuery)
    ).sort((a,b)=>pfssNormalizeSearch(a.username).localeCompare(pfssNormalizeSearch(b.username),'de',{sensitivity:'base'}));
    host.innerHTML = filtered.length ? filtered.map(user => {
      const self = user.id === window.pfssCurrentUserId;
      return `<article class="admin-user-card" data-user-id="${escapeHtml(user.id)}">
        <div class="admin-user-info"><b>${escapeHtml(user.username || 'Ohne Benutzername')}</b><small>${escapeHtml(user.id)}</small><span class="tag">${escapeHtml(user.status)}</span></div>
        <div class="admin-user-controls">
          <label>Rolle<select data-role>${['user','scout','admin'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role === 'user' ? 'Mitglied' : role === 'scout' ? 'Scout' : 'Administrator'}</option>`).join('')}</select></label>
          <label>Status<select data-status>${['pending','approved','suspended'].map(status => `<option value="${status}" ${user.status === status ? 'selected' : ''}>${status === 'pending' ? 'Ausstehend' : status === 'approved' ? 'Freigegeben' : 'Gesperrt'}</option>`).join('')}</select></label>
          <button class="btn btn-secondary admin-save" type="button" data-admin-save ${self ? 'disabled title="Eigenes Administratorkonto ist geschützt"' : ''}>Speichern</button>
        </div>
        ${self ? '<small class="admin-self-note">Eigenes Administratorkonto geschützt</small>' : ''}
      </article>`;
    }).join('') : '<div class="empty-state"><b>Keine Benutzer gefunden</b></div>';
    message.textContent = users.length ? 'Benutzerliste aktuell.' : 'Noch keine Benutzer vorhanden.';
  } catch (error) {
    message.textContent = 'Benutzerverwaltung nicht verfügbar. Bitte zuerst die Admin-Datenbankmigration in Supabase ausführen.';
    host.innerHTML = '';
  }
}

async function saveAdminUser(button) {
  const card = button.closest('[data-user-id]');
  if (!card || window.pfssCurrentRole !== 'admin') return;
  const userId = card.dataset.userId;
  const role = card.querySelector('[data-role]').value;
  const status = card.querySelector('[data-status]').value;
  button.disabled = true;
  try {
    const { error } = await pfssSupabase.rpc('pfss_admin_update_profile', {
      p_user_id: userId, p_role: role, p_status: status
    });
    if (error) throw error;
    toast('Benutzerkonto aktualisiert.');
    await loadAdminUsers();
  } catch (error) {
    toast('Änderung fehlgeschlagen. Berechtigung und Datenbankmigration prüfen.');
    button.disabled = false;
  }
}


function pfmsAdminToolsMarkup(type) {
  const title=type==='club'?'Vereine':type==='agency'?'Agenturen':'Scouts';
  const fields=type==='scout'
    ? `<label class="field">Scout-Name<input type="search" data-pfms-name placeholder="Vor- oder Nachname"></label>
       <label class="field">E-Mail<input type="search" data-pfms-email placeholder="E-Mail-Adresse"></label>
       <label class="field">User-ID<input type="text" data-pfms-id placeholder="Scout-ID"></label>
       <label class="field">Status<select data-pfms-status><option value="">Alle Status</option><option value="active">Aktiv</option><option value="pending">Ausstehend</option><option value="suspended">Gesperrt</option></select></label>`
    : `<label class="field">${type==='club'?'Vereinsname':'Agenturname'}<input type="search" data-pfms-name placeholder="Name eingeben"></label>
       <label class="field">Organisations-ID<input type="text" data-pfms-id placeholder="Organisations-ID"></label>
       <label class="field">Status<select data-pfms-status><option value="">Alle Status</option><option value="active">Aktiv</option><option value="pending">Ausstehend</option><option value="suspended">Gesperrt</option></select></label>`;
  return `<div class="panel">
    <div class="panel-heading"><div><div class="eyebrow">LIVE-DATENBANKVERWALTUNG</div><h3>${title} suchen</h3></div><span class="module-status">Verwaltung</span></div>
    <form class="pfss-search-form" data-pfms-search-form><div class="pfss-search-fields">${fields}</div>
      <div class="pfss-search-actions"><button class="btn btn-primary" type="submit">Suchen</button><button class="btn btn-secondary" type="reset">Zurücksetzen</button></div>
    </form>
    <p class="admin-message" data-pfms-message>Suchkriterien eingeben und Suche starten.</p><div data-pfms-results class="admin-org-results"></div>
  </div>
  <div class="panel" data-pfms-detail hidden><div class="panel-heading"><div><div class="eyebrow">DETAILS</div><h3 data-pfms-detail-title>Auswahl</h3></div></div><div data-pfms-detail-body></div></div>`;
}

function setupPfmsAdminManagement() {
  if (window.pfssCurrentRole !== 'admin') return;
  const configs = [
    {type:'club',id:'adminClubConsole'},
    {type:'agency',id:'adminAgencyConsole'},
    {type:'scout',id:'adminScoutConsole'}
  ];
  configs.forEach(({type,id}) => {
    const root=document.getElementById(id);
    if (!root || root.dataset.pfmsReady) return;
    root.innerHTML=pfmsAdminToolsMarkup(type);
    root.dataset.pfmsReady='true';
    const form=root.querySelector('[data-pfms-search-form]');
    form.addEventListener('submit',event=>{event.preventDefault();loadPfmsAdminDirectory(type,root);});
    form.addEventListener('reset',()=>window.setTimeout(()=>loadPfmsAdminDirectory(type,root),0));
    loadPfmsAdminDirectory(type,root);
  });
}

async function loadPfmsAdminDirectory(type,root) {
  const message=root.querySelector('[data-pfms-message]'), results=root.querySelector('[data-pfms-results]');
  message.textContent='Daten werden geladen …'; results.innerHTML='';
  try {
    const rpc=type==='scout'?'pfms_admin_list_legacy_scouts':'pfms_admin_search_legacy_organizations';
    const args=type==='scout'?{p_query:''}:{p_type:type,p_query:''};
    const {data,error}=await pfssSupabase.rpc(rpc,args); if(error)throw error;
    const nameQuery=pfssNormalizeSearch(root.querySelector('[data-pfms-name]')?.value);
    const emailQuery=pfssNormalizeSearch(root.querySelector('[data-pfms-email]')?.value);
    const idQuery=pfssNormalizeSearch(root.querySelector('[data-pfms-id]')?.value);
    const statusQuery=root.querySelector('[data-pfms-status]')?.value||'';
    const filtered=(data||[]).filter(item=>{
      const name=type==='scout'?(item.full_name||item.username||''):(item.name||'');
      const email=type==='scout'?(item.email||''):'';
      const id=type==='scout'?(item.user_id||''):(item.id||'');
      const status=item.profile_status||item.status||'';
      return (!nameQuery||pfssNormalizeSearch(name).includes(nameQuery)) &&
        (!emailQuery||pfssNormalizeSearch(email).includes(emailQuery)) &&
        (!idQuery||pfssNormalizeSearch(id).includes(idQuery)) &&
        (!statusQuery||status===statusQuery);
    }).sort((a,b)=>{
      const left=type==='scout'?(a.full_name||a.username||a.email||''):(a.name||'');
      const right=type==='scout'?(b.full_name||b.username||b.email||''):(b.name||'');
      return String(left).localeCompare(String(right),'de',{sensitivity:'base'});
    });
    if(!filtered.length){message.textContent='Keine Einträge gefunden.';return;}
    message.textContent=filtered.length+' Einträge gefunden.';
    results.innerHTML=filtered.map((item,index)=>{
      const id=type==='scout'?item.user_id:item.id;
      const name=type==='scout'?(item.full_name||item.username||item.email||'Scout'):(item.name||'Organisation');
      const meta=type==='scout'?(item.email||item.username||'Einzelscout'):item.organization_type;
      return `<button type="button" class="admin-directory-row" data-entry-index="${index}">
        <span><b>${escapeHtml(name)}</b><small>${escapeHtml(id)} · ${escapeHtml(meta||'')}</small></span>
        <span class="tag">${escapeHtml(item.profile_status||item.status||'')}</span>
      </button>`;
    }).join('');
    results.querySelectorAll('[data-entry-index]').forEach(button=>button.addEventListener('click',()=>{
      const item=filtered[Number(button.dataset.entryIndex)];
      if(type==='scout')showPfmsScoutDetails(root,item); else showPfmsOrganizationDetails(root,item);
    }));
  } catch(error) { console.error('PFMS Admin Directory:',error); message.textContent='Suche fehlgeschlagen: '+(error?.message||'Unbekannter Datenbankfehler'); }
}

async function showPfmsOrganizationDetails(root,org) {
  const detail=root.querySelector('[data-pfms-detail]');
  const body=root.querySelector('[data-pfms-detail-body]');
  root.querySelector('[data-pfms-detail-title]').textContent=org.name+' · '+org.id;
  detail.hidden=false;
  body.innerHTML='<p class="admin-message">Mitglieder werden geladen …</p>';
  let members=[];
  try {
    const {data,error}=await pfssSupabase.rpc(
      'pfms_admin_list_legacy_org_members',{p_org_id:org.id}
    );
    if(error)throw error;
    members=data||[];
  } catch(error) {
    console.error('PFMS members:',error);
    body.innerHTML='<p class="admin-message">Mitglieder konnten nicht geladen werden.</p>';
    return;
  }

  body.innerHTML=`
    <section class="admin-user-card" data-invitation-tools>
      <b>Neue Einladung erstellen</b>
      <div class="admin-user-controls">
        <label>Mitgliedsrolle
          <select data-invite-role>
            <option value="scout">Scout</option>
            <option value="trainer">Trainer</option>
            <option value="co_trainer">Co-Trainer</option>
            <option value="betreuer">Betreuer</option>
            <option value="member">Mitglied</option>
          </select>
        </label>
        <label>Gültigkeit
          <select data-invite-days>
            <option value="7">7 Tage</option>
            <option value="14">14 Tage</option>
            <option value="30">30 Tage</option>
          </select>
        </label>
      </div>
      <button type="button" class="btn btn-primary" data-create-invite>Einladungslink erstellen</button>
      <p class="admin-message" data-invite-message></p>
      <div data-invite-result hidden>
        <input type="text" data-invite-url readonly aria-label="Einladungslink">
        <button type="button" class="btn btn-secondary" data-copy-invite>Link kopieren</button>
      </div>
      <small>Der Link ist einmalig verwendbar und läuft nach der gewählten Frist ab.</small>
    </section>
    <h4>Mitglieder</h4>
    <div data-org-members>
      ${members.length ? members.map((m,i)=>`<article class="admin-user-card" data-member-index="${i}">
        <div class="admin-user-info">
          <b>${escapeHtml(m.full_name||m.username||m.email||'Mitglied')}</b>
          <small>${escapeHtml(m.email||m.user_id)}</small>
          <span class="tag">${escapeHtml(m.member_role)} · ${escapeHtml(m.status)}</span>
        </div>
        <div class="admin-user-controls">
          <label>Rolle<select data-member-role>${['owner','club_admin','agency_admin','scout','trainer','co_trainer','betreuer','member'].map(v=>`<option value="${v}" ${m.member_role===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>Status<select data-member-status>${['pending','active','suspended'].map(v=>`<option value="${v}" ${m.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
        </div>
        <button type="button" class="btn btn-secondary" data-save-member>Änderungen speichern</button>
        <p class="admin-message" data-member-message></p>
      </article>`).join('') : '<p class="admin-message">Noch keine Mitglieder zugeordnet.</p>'}
    </div>`;

  const createButton=body.querySelector('[data-create-invite]');
  createButton.addEventListener('click',async()=>{
    const message=body.querySelector('[data-invite-message]');
    const result=body.querySelector('[data-invite-result]');
    createButton.disabled=true;
    message.textContent='Einladung wird erstellt …';
    result.hidden=true;
    try {
      const {data,error}=await pfssSupabase.rpc('pfms_create_legacy_invitation',{
        p_organization_id:org.id,
        p_role:body.querySelector('[data-invite-role]').value,
        p_expires_in_days:Number(body.querySelector('[data-invite-days]').value)
      });
      if(error)throw error;
      const url=new URL(window.location.href);
      url.searchParams.set('invite',data);
      body.querySelector('[data-invite-url]').value=url.toString();
      result.hidden=false;
      message.textContent='Einladung erstellt. Der Code wird nur jetzt angezeigt – bitte den Link sicher weitergeben.';
    } catch(error) {
      console.error('PFMS invitation creation:',error);
      message.textContent='Einladung fehlgeschlagen: '+(error?.message||'Berechtigung oder Organisation prüfen.');
    } finally {createButton.disabled=false;}
  });
  body.querySelector('[data-copy-invite]').addEventListener('click',async()=>{
    const input=body.querySelector('[data-invite-url]');
    try {
      await navigator.clipboard.writeText(input.value);
      body.querySelector('[data-invite-message]').textContent='Einladungslink kopiert.';
    } catch(error) {
      input.focus();
      input.select();
      body.querySelector('[data-invite-message]').textContent='Link markieren und kopieren.';
    }
  });

  body.querySelectorAll('[data-member-index]').forEach(card=>{
    const m=members[Number(card.dataset.memberIndex)];
    card.querySelector('[data-save-member]').addEventListener('click',async()=>{
      const save=card.querySelector('[data-save-member]');
      save.disabled=true;
      try {
        const {error}=await pfssSupabase.rpc(
          'pfms_admin_update_legacy_membership',{
            p_membership_id:m.membership_id,
            p_role:card.querySelector('[data-member-role]').value,
            p_status:card.querySelector('[data-member-status]').value
          }
        );
        if(error)throw error;
        card.querySelector('[data-member-message]').textContent='Änderungen gespeichert.';
      } catch(error) {
        console.error('PFMS membership update:',error);
        card.querySelector('[data-member-message]').textContent='Speichern fehlgeschlagen: Berechtigung oder Eingaben prüfen.';
      } finally {save.disabled=false;}
    });
  });
}

function showPfmsScoutDetails(root,scout) {
  const detail=root.querySelector('[data-pfms-detail]');
  root.querySelector('[data-pfms-detail-title]').textContent=
    (scout.full_name||scout.username||scout.email||'Scout')+' · '+scout.user_id;
  detail.hidden=false;
  root.querySelector('[data-pfms-detail-body]').innerHTML=`<div class="admin-user-card">
    <b>${escapeHtml(scout.full_name||scout.username||scout.email||'Scout')}</b>
    <small>Benutzername: ${escapeHtml(scout.username||'–')}</small>
    <small>E-Mail: ${escapeHtml(scout.email||'–')}</small>
    <small>User-ID: ${escapeHtml(scout.user_id)}</small>
    <small>Profilstatus: ${escapeHtml(scout.profile_status||'–')}</small>
    <small>Aktive Organisationen: ${Number(scout.organization_count||0)}</small>
  </div>`;
}

async function checkPfssAccess(user) {
  const { data: profile, error } = await pfssSupabase
    .from('profiles')
    .select('status, role, username')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    showPendingScreen('pending');
    document.getElementById('pendingText').textContent =
      'Dein Profil konnte noch nicht geprüft werden. Bitte versuche es später erneut.';
    return;
  }

  if (profile.status !== 'approved') {
    showPendingScreen(profile.status);
    return;
  }

  showAuthenticatedApp(user, profile);
}

async function pfssLogout() {
  try {
    if (window.pfssCurrentUserId) sessionStorage.removeItem('pfms_welcome_session_' + window.pfssCurrentUserId);
  } catch (storageError) {}
  await pfssSupabase.auth.signOut();
  showAuthScreen();
}

document.getElementById('authForm')
  .addEventListener('submit', async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const identifier = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const message = document.getElementById('authMessage');
    const button = document.getElementById('loginButton');

    message.textContent = 'Anmeldung wird geprüft …';
    button.disabled = true;

    try {
      let data;
      if (identifier.includes('@')) {
        const result = await pfssSupabase.auth.signInWithPassword({
          email: identifier,
          password
        });
        if (result.error) throw result.error;
        data = result.data;
      } else {
        const response = await fetch(
          PFSS_SUPABASE_URL + '/functions/v1/username-login',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': PFSS_SUPABASE_KEY
            },
            body: JSON.stringify({ username: identifier, password })
          }
        );
        const result = await response.json();
        if (!response.ok || !result.access_token || !result.refresh_token) {
          throw new Error('Anmeldung fehlgeschlagen');
        }
        const sessionResult = await pfssSupabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token
        });
        if (sessionResult.error) throw sessionResult.error;
        data = sessionResult.data;
      }
      await checkPfssAccess(data.user);
    } catch (error) {
      message.textContent =
        'Anmeldung fehlgeschlagen: Benutzername/E-Mail oder Passwort prüfen.';
    } finally {
      button.disabled = false;
    }
  });

document.getElementById('forgotPasswordButton')
  .addEventListener('click', async () => {
    const form = document.getElementById('authForm');
    const email = form.elements.email.value.trim();
    const message = document.getElementById('authMessage');
    const button = document.getElementById('forgotPasswordButton');

    if (!email) {
      message.textContent = 'Bitte gib zuerst deine E-Mail-Adresse ein.';
      form.elements.email.focus();
      return;
    }
    if (!email.includes('@')) {
      message.textContent = 'Für das Zurücksetzen des Passworts bitte die E-Mail-Adresse eingeben.';
      form.elements.email.focus();
      return;
    }

    button.disabled = true;
    message.textContent = 'Wiederherstellungslink wird angefordert …';

    try {
      const { error } = await pfssSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });

      if (error) throw error;

      message.textContent =
        'Falls ein Konto zu dieser Adresse gehört, erhältst du eine E-Mail mit dem Link zum Zurücksetzen des Passworts.';
    } catch (error) {
      message.textContent =
        'Der Wiederherstellungslink konnte gerade nicht angefordert werden. Bitte versuche es später erneut.';
    } finally {
      button.disabled = false;
    }
  });

const signupUsernameField = document.getElementById('signupUsernameField');
const registrationFields = document.getElementById('registrationFields');
const registrationType = document.getElementById('registrationType');
const agencyTypeField = document.getElementById('agencyTypeField');
const organizationNameField = document.getElementById('organizationNameField');
const invitationCodeInput = document.getElementById('invitationCode');
const registrationChoice = document.getElementById('registrationChoice');
const signupEmailField = document.getElementById('signupEmailField');
const signupPasswordField = document.getElementById('signupPasswordField');
const authActions = document.getElementById('authActions');
const requestedRoleField = document.getElementById('requestedRoleField');
const scoutTypeField = document.getElementById('scoutTypeField');
let signupMode = false;
let selectedRegistrationChoice = '';
let selectedBillingCycle = 'monthly';

const inviteFromUrl = new URLSearchParams(window.location.search).get('invite');
if (inviteFromUrl && invitationCodeInput) invitationCodeInput.value = inviteFromUrl;
document.querySelectorAll('[data-pricing]').forEach(group => {
  group.dataset.selectedPlan = 'monthly';
  group.querySelectorAll('.price-option').forEach(option => {
    option.addEventListener('click', () => {
      group.querySelectorAll('.price-option').forEach(item => item.classList.toggle('active', item === option));
      group.dataset.selectedPlan = option.dataset.plan;
      if (selectedRegistrationChoice === group.dataset.pricing) {
        selectedBillingCycle = option.dataset.plan;
      }
    });
  });
});

const registrationChoiceDetails = {
  user: 'Mitglieder können sich ausschließlich über einen gültigen Einladungslink registrieren. Der Link ordnet das Konto direkt dem einladenden Verein oder der Agentur zu.',
  club: 'Der Vereinszugang bietet eine eigene Organisationsverwaltung. Die 30-tägige Testphase startet nach erfolgreicher Einrichtung der Abrechnung.',
  agency: 'Der Agenturzugang bietet eine eigene Agenturverwaltung und Scoutorganisation. Die 30-tägige Testphase startet nach erfolgreicher Einrichtung der Abrechnung.',
  scout: 'Der Einzelscout kann globale Spielerdaten suchen und lesen. Er darf ausschließlich eigene Spielerprofile und eigene Scouting-Berichte erstellen oder bearbeiten.'
};

function chooseRegistrationType(type) {
  selectedRegistrationChoice = type;
  const priceGroup = document.querySelector('[data-pricing="' + type + '"]');
  selectedBillingCycle = priceGroup?.dataset.selectedPlan || 'monthly';
  registrationType.value = type;
  registrationChoice.hidden = true;
  registrationFields.hidden = false;
  document.getElementById('selectedRegistrationLabel').textContent =
    'Ausgewählter Zugang: ' + ({user:'Mitglied',club:'Verein',agency:'Agentur',scout:'Einzelscout'}[type] || type);
  const orderSummary = document.getElementById('orderSummary');
  const memberSummary = document.getElementById('memberFreeSummary');
  const planNames = {club:'Verein',agency:'Agentur',scout:'Einzelscout'};
  const planPrices = {
    club:{monthly:'99,99 €',yearly:'1.099,99 €'},
    agency:{monthly:'79,99 €',yearly:'739,99 €'},
    scout:{monthly:'50,00 €',yearly:'500,00 €'}
  };
  if (orderSummary) {
    const paidPlan = ['club','agency','scout'].includes(type);
    orderSummary.hidden = !paidPlan;
    memberSummary.hidden = type !== 'user';
    if (paidPlan) {
      const cycle = selectedBillingCycle;
      document.getElementById('orderPlanName').textContent = planNames[type];
      document.getElementById('orderPrice').textContent = planPrices[type][cycle];
      document.getElementById('orderPeriod').textContent = cycle === 'yearly' ? 'pro Jahr' : 'pro Monat';
      document.getElementById('orderPlanDetail').textContent = planNames[type] + ' · ' + (cycle === 'yearly' ? 'jährliche Zahlung' : 'monatliche Zahlung');
      document.getElementById('signupButton').textContent = 'Weiter zur Zahlungsübersicht';
    } else {
      document.getElementById('signupButton').textContent = 'Kostenlos registrieren';
    }
  }
  requestedRoleField.hidden = type !== 'user';
  scoutTypeField.hidden = true;
  document.getElementById('scoutType').value = 'solo_scout';
  organizationNameField.hidden = type !== 'club' && type !== 'agency';
  organizationNameField.querySelector('input').required = type === 'club' || type === 'agency';
  agencyTypeField.hidden = type !== 'agency';
  document.getElementById('invitationCodeField').hidden = type !== 'user';
  invitationCodeInput.required = type === 'user';
  document.querySelector('#invitationCodeField .field-hint').textContent = type === 'user'
    ? 'Pflichtfeld: Der Einladungslink ordnet dich direkt einem Verein oder einer Agentur zu.'
    : 'Für diesen Zugang ist keine Mitgliedseinladung erforderlich.';
  document.getElementById('authTitle').textContent = 'Konto registrieren.';
  document.getElementById('authIntro').textContent = 'Ergänze deine Angaben, um die Registrierung abzuschließen.';
  document.getElementById('authMessage').textContent = '';
}

function setAuthMode(mode) {
  signupMode = mode === 'register';
  const form = document.getElementById('authForm');
  const loginButton = document.getElementById('loginButton');
  const signupButton = document.getElementById('signupButton');
  const message = document.getElementById('authMessage');
  document.getElementById('chooseLogin').classList.toggle('active', !signupMode);
  document.getElementById('chooseRegister').classList.toggle('active', signupMode);
  document.getElementById('authTitle').textContent = signupMode ? 'Konto registrieren.' : 'Willkommen.';
  document.getElementById('authIntro').textContent = signupMode
    ? 'Wähle zunächst, wie du PFMS nutzen möchtest.'
    : 'Melde dich mit E-Mail-Adresse oder Benutzername und Passwort an.';
  signupUsernameField.hidden = !signupMode || !selectedRegistrationChoice;
  registrationChoice.hidden = !signupMode || !!selectedRegistrationChoice;
  registrationFields.hidden = !signupMode || !selectedRegistrationChoice;
  signupEmailField.hidden = signupMode && !selectedRegistrationChoice;
  signupPasswordField.hidden = signupMode && !selectedRegistrationChoice;
  authActions.hidden = signupMode && !selectedRegistrationChoice;
  form.elements.username.required = signupMode;
  form.elements.email.autocomplete = signupMode ? 'email' : 'username';
  document.getElementById('emailFieldLabel').textContent = signupMode ? 'E-Mail-Adresse' : 'E-Mail-Adresse oder Benutzername';
  form.elements.email.placeholder = signupMode ? 'name@beispiel.de' : 'E-Mail oder Benutzername';
  loginButton.hidden = signupMode;
  signupButton.hidden = !signupMode;
  document.getElementById('forgotPasswordButton').hidden = signupMode;
  message.textContent = '';
  if (!signupMode) {
    selectedRegistrationChoice = '';
    selectedBillingCycle = 'monthly';
    registrationType.value = '';
    requestedRoleField.hidden = true;
    scoutTypeField.hidden = true;
    organizationNameField.hidden = true;
    organizationNameField.querySelector('input').required = false;
    agencyTypeField.hidden = true;
    document.getElementById('invitationCodeField').hidden = true;
    invitationCodeInput.required = false;
    document.getElementById('acceptLegalTerms').required = false;
  }
}

document.querySelectorAll('[data-registration-choice]').forEach(button => {
  button.addEventListener('click', () => {
    chooseRegistrationType(button.dataset.registrationChoice);
    signupUsernameField.hidden = false;
    signupEmailField.hidden = false;
    signupPasswordField.hidden = false;
    authActions.hidden = false;
  });
});
document.querySelectorAll('[data-choice-info]').forEach(button => {
  button.addEventListener('click', () => {
    const info = document.getElementById('choiceInfoText');
    info.textContent = registrationChoiceDetails[button.dataset.choiceInfo] || '';
    info.hidden = false;
  });
});
document.getElementById('changeRegistrationChoice').addEventListener('click', () => {
  registrationFields.hidden = true;
  signupUsernameField.hidden = true;
  signupEmailField.hidden = true;
  signupPasswordField.hidden = true;
  authActions.hidden = true;
  registrationChoice.hidden = false;
  document.getElementById('authTitle').textContent = 'Konto registrieren.';
  document.getElementById('authIntro').textContent = 'Wähle zunächst, wie du PFMS nutzen möchtest.';
  document.getElementById('authMessage').textContent = '';
  selectedRegistrationChoice = '';
  registrationType.value = '';
});

const legalDialog = document.getElementById('legalInfoDialog');
const legalFrame = document.getElementById('legalInfoFrame');
function closeLegalInfo() {
  if (legalDialog.open) legalDialog.close();
  legalFrame.src = 'about:blank';
}
document.querySelectorAll('[data-legal-doc]').forEach(link => {
  link.addEventListener('click', () => {
    const section = link.dataset.legalDoc === 'datenschutz' ? 'datenschutz' : 'nutzung';
    const title = section === 'datenschutz' ? 'Datenschutzerklärung' : 'AGB';
    document.getElementById('legalInfoTitle').textContent = title;
    legalFrame.src = 'rechtliches.html#' + section;
    document.getElementById('openLegalFull').href = 'rechtliches.html#' + section;
    legalDialog.showModal();
  });
});
document.getElementById('closeLegalInfo').addEventListener('click', closeLegalInfo);
document.getElementById('closeLegalInfoBottom').addEventListener('click', closeLegalInfo);
legalDialog.addEventListener('click', event => {
  if (event.target === legalDialog) closeLegalInfo();
});

document.getElementById('chooseLogin').addEventListener('click', () => setAuthMode('login'));
document.getElementById('chooseRegister').addEventListener('click', () => setAuthMode('register'));

function clearSignupValidation() {
  const form = document.getElementById('authForm');
  form.querySelectorAll('.field-invalid').forEach(field => field.classList.remove('field-invalid'));
  document.getElementById('acceptLegalTerms').classList.remove('checkbox-invalid');
  const message = document.getElementById('authMessage');
  message.classList.remove('auth-message-error');
}
function showSignupError(messageText, fieldElement) {
  clearSignupValidation();
  const message = document.getElementById('authMessage');
  message.textContent = messageText;
  message.classList.add('auth-message-error');
  if (fieldElement) {
    const field = fieldElement.closest('.field');
    if (field) field.classList.add('field-invalid');
    else fieldElement.classList.add('checkbox-invalid');
    fieldElement.focus();
  }
}
document.querySelectorAll('#authForm input, #authForm select').forEach(input => {
  input.addEventListener('input', () => {
    const field = input.closest('.field');
    if (field) field.classList.remove('field-invalid');
    if (input.id === 'acceptLegalTerms' && input.checked) input.classList.remove('checkbox-invalid');
    const message = document.getElementById('authMessage');
    if (message.classList.contains('auth-message-error')) {
      message.textContent = '';
      message.classList.remove('auth-message-error');
    }
  });
  input.addEventListener('change', () => {
    const field = input.closest('.field');
    if (field) field.classList.remove('field-invalid');
    if (input.id === 'acceptLegalTerms' && input.checked) input.classList.remove('checkbox-invalid');
  });
});

document.getElementById('signupButton').addEventListener('click', async () => {
  const form = document.getElementById('authForm');
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const username = (form.elements.username.value || '').trim();
  const message = document.getElementById('authMessage');
  const button = document.getElementById('signupButton');
  const type = registrationType.value;
  const requestedRole = document.getElementById('requestedRole').value;
  const scoutType = document.getElementById('scoutType').value;
  const legalAcceptance = document.getElementById('acceptLegalTerms');
  const organizationName = (form.elements.organizationName.value || '').trim();
  const invitationCode = (form.elements.invitationCode.value || '').trim();

  clearSignupValidation();
  if (!legalAcceptance.checked) {
    showSignupError('Bitte bestätige die AGB und die Kenntnisnahme der Datenschutzerklärung.', legalAcceptance);
    return;
  }
  if (!username) {
    showSignupError('Bitte gib einen Benutzernamen ein.', form.elements.username);
    return;
  }
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) {
    showSignupError('Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt, _ oder -.', form.elements.username);
    return;
  }
  if (!email) {
    showSignupError('Bitte gib deine E-Mail-Adresse ein.', form.elements.email);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSignupError('Bitte gib eine gültige E-Mail-Adresse ein.', form.elements.email);
    return;
  }
  if (!password) {
    showSignupError('Bitte gib ein Passwort ein.', form.elements.password);
    return;
  }
  if (password.length < 8) {
    showSignupError('Das Passwort muss mindestens 8 Zeichen lang sein.', form.elements.password);
    return;
  }
  if (!type) {
    showSignupError('Bitte wähle zuerst deinen Zugangsweg aus.', null);
    return;
  }
  if (type === 'user' && !invitationCode) {
    showSignupError('Eine Mitgliedsregistrierung ist nur mit einem gültigen Einladungslink möglich.', invitationCodeInput);
    return;
  }
  if ((type === 'club' || type === 'agency') && !organizationName) {
    showSignupError('Bitte gib den Namen des Vereins oder der Agentur ein.', form.elements.organizationName);
    return;
  }

  if (['club','agency','scout'].includes(type)) {
    message.textContent = 'Bestellübersicht geprüft. Die Zahlungsansicht ist eine visuelle Vorschau; eine echte Zahlung und Kontoanlage sind noch nicht aktiviert.';
    document.getElementById('orderSummary').scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }

  button.disabled = true;
  message.textContent = 'Registrierung wird vorbereitet …';
  try {
    const metadata = {
      username,
      registration_type: type,
      requested_role: type === 'user' ? requestedRole : null,
      scout_type: type === 'scout' ? 'solo_scout' : null,
      billing_cycle: ['club','agency','scout'].includes(type) ? selectedBillingCycle : null,
      trial_days: ['club','agency','scout'].includes(type) ? 30 : 0,
      agency_type: type === 'agency' ? document.getElementById('agencyType').value : null,
      organization_name: type === 'club' || type === 'agency' ? organizationName : null,
      invitation_code: invitationCode || null
    };
    const { data, error } = await pfssSupabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    if (error) throw error;
    if (data.session && data.user) {
      await checkPfssAccess(data.user);
    } else {
      message.textContent = 'Registrierung vorgemerkt. Bitte bestätige deine E-Mail-Adresse. Die Organisationsanlage bzw. Einladung wird erst nach Aktivierung der serverseitigen Prüf- und Datenbankfunktionen abgeschlossen.';
    }
  } catch (error) {
    message.textContent = 'Registrierung fehlgeschlagen. Bitte prüfe deine Angaben oder versuche es später erneut.';
  } finally {
    button.disabled = false;
  }
});

setAuthMode(inviteFromUrl ? 'register' : 'login');
if (inviteFromUrl) {
  chooseRegistrationType('user');
  signupUsernameField.hidden = false;
  signupEmailField.hidden = false;
  signupPasswordField.hidden = false;
  authActions.hidden = false;
}

document.getElementById('logoutButton')
  .addEventListener('click', pfssLogout);

document.getElementById('logoutPending')
  .addEventListener('click', pfssLogout);

// Bestehende Sitzung beim Laden wiederherstellen
async function initializePfssAuth() {
  showAuthScreen();

  const { data, error } =
    await pfssSupabase.auth.getSession();

  if (error) {
    document.getElementById('authMessage').textContent =
      'Sitzung konnte nicht geladen werden.';
    return;
  }

  if (data.session?.user) {
    await checkPfssAccess(data.session.user);
  }
}

initializePfssAuth();

// Bei Abmeldung Oberfläche schließen
pfssSupabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    showAuthScreen();
  }

  if (event === 'PASSWORD_RECOVERY') {
    setTimeout(() => {
      const dialog = document.getElementById('passwordDialog');
      if (dialog && !dialog.open) dialog.showModal();
    }, 0);
  }
});

document.getElementById('passwordForm')
  .addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.password.value;
    const confirmation = form.elements.confirmPassword.value;
    const message = document.getElementById('passwordMessage');
    const button = document.getElementById('savePasswordButton');

    if (password.length < 8) {
      message.textContent = 'Das Passwort muss mindestens 8 Zeichen enthalten.';
      return;
    }
    if (password !== confirmation) {
      message.textContent = 'Die beiden Passwörter stimmen nicht überein.';
      return;
    }

    button.disabled = true;
    message.textContent = 'Passwort wird sicher gespeichert …';
    try {
      const { error } = await pfssSupabase.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      document.getElementById('passwordDialog').close();
      message.textContent = '';
      toast('Dein Passwort wurde erfolgreich geändert.');
    } catch (error) {
      message.textContent = 'Das Passwort konnte nicht geändert werden. Bitte fordere einen neuen Link an.';
    } finally {
      button.disabled = false;
    }
  });

