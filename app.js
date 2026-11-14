
const DB_KEYS = {
  players: 'pfss_players_v1',
  reports: 'pfss_reports_v1'
};

// Legacy browser data are retained until an administrator explicitly imports them.
let legacyLocalPlayers = read(DB_KEYS.players, []);
let legacyLocalReports = read(DB_KEYS.reports, []);
let players = [];
let reports = [];
let mediaItems = [];
let playerSearchHasRun = false;
let pfmsMainDataReady = false;
let pfmsMainDataLoading = false;
let pfmsMainDataError = '';
let pfmsMainMediaLoading = false;
let pfmsMainMediaLoadedAt = 0;
let pfmsMainMediaOwnerId = '';
let pfmsMainMediaRequestId = 0;
let pfmsAuthGeneration = 0;
let editingGlobalPlayerId = null;
let editingMainReportId = null;

const PFMS_MAIN_MEDIA_BUCKET = 'pfss-scout-private';
const PFMS_MAIN_MEDIA_MAX_SIZE = 50 * 1024 * 1024;
const PFMS_MAIN_MEDIA_ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'video/mp4', 'video/quicktime', 'video/webm'
]);

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function mapPfmsPlayerRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    surname: row.surname || '',
    birth: row.birth || '',
    joinDate: row.join_date || '',
    nationality: row.nationality || '',
    position: row.position || 'Mittelfeld',
    club: row.club || '',
    height: row.height ?? '',
    foot: row.foot || '',
    notes: row.notes || '',
    createdAt: row.created_at || ''
  };
}

function mapPfmsReportRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    date: row.observation_date || '',
    rating: row.overall_rating,
    notes: row.notes || '',
    createdAt: row.created_at || '',
    authorId: row.author_id || ''
  };
}

function updateMainDataStatus() {
  const playerStatus = document.getElementById('mainPlayerDataStatus');
  const reportStatus = document.getElementById('mainReportDataStatus');
  const text = pfmsMainDataError || (!pfmsMainDataReady ? 'Die Cloud-Daten werden geladen …' : '');
  [playerStatus, reportStatus].forEach(host => {
    if (!host) return;
    host.hidden = !text;
    host.textContent = text;
  });

  const addButton = document.getElementById('addGlobalPlayerButton');
  if (addButton) addButton.hidden = !window.pfssIsRealAdmin || !pfmsMainDataReady;
  document.querySelectorAll('[data-action="new-player"]').forEach(button => {
    button.hidden = !window.pfssIsRealAdmin || !pfmsMainDataReady;
  });

  const importButton = document.getElementById('importLegacyDataButton');
  if (importButton) {
    importButton.hidden = !window.pfssIsRealAdmin || !pfmsMainDataReady ||
      (!legacyLocalPlayers.length && !legacyLocalReports.length);
  }
}

async function loadPfmsMainData() {
  if (!window.pfssCurrentUserId || pfmsMainDataLoading) return false;
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  pfmsMainDataLoading = true;
  pfmsMainDataReady = false;
  pfmsMainDataError = '';
  updateMainDataStatus();

  try {
    const [playerResult, reportResult] = await Promise.all([
      pfssSupabase.from('pfms_global_players')
        .select('*')
        .order('surname', { ascending: true, nullsFirst: false }),
      pfssSupabase.from('pfms_main_scouting_reports')
        .select('*')
        .order('observation_date', { ascending: false })
    ]);
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return false;
    if (playerResult.error) throw playerResult.error;
    if (reportResult.error) throw reportResult.error;

    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return false;
    players = (playerResult.data || []).map(mapPfmsPlayerRow);
    reports = (reportResult.data || []).map(mapPfmsReportRow);
    pfmsMainDataReady = true;
    pfmsMainDataError = '';
    updateMainDataStatus();
    renderDashboard();
    renderPlayers();
    renderReports();
    return true;
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return false;
    console.error('PFMS main cloud data could not be loaded:', error);
    players = [];
    reports = [];
    pfmsMainDataReady = false;
    pfmsMainDataError =
      'Die zentrale Spielerdatenbank konnte nicht geladen werden. Bitte prüfe, ob die PFMS-Katalogmigration in der Testdatenbank angewendet wurde und dein Konto freigegeben ist.';
    updateMainDataStatus();
    renderDashboard();
    renderPlayers();
    renderReports();
    return false;
  } finally {
    if (requestGeneration === pfmsAuthGeneration) pfmsMainDataLoading = false;
  }
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
    const heading = document.querySelector('#view-team-workspace .page-heading h1');
    if (heading) heading.textContent = 'Meine Mannschaften';
    const intro = document.querySelector('#view-team-workspace .page-heading p');
    if (intro) intro.textContent = 'Hier erscheinen ausschließlich deine aktiven Mannschaftszuordnungen.';
  }

  document.getElementById('pageTitle').textContent =
    names[view] || 'Dashboard';

  document.getElementById('sidebar').classList.remove('open');
  document.body.classList.remove('sidebar-open');

  if (view === 'players') renderPlayers();
  if (view === 'reports') renderReports();
  if (view === 'dashboard') renderDashboard();
  if (view === 'media' && window.pfssCurrentUserId) void loadPfmsMainMedia();
  if (view === 'club-members' && window.pfssCurrentUserId) void loadPfmsLegacyInvitationOrganizations();
  if ((view === 'teams' || view === 'team-workspace') && window.pfssCurrentUserId) void loadPfmsLegacyTeams();
  if (view === 'admin') loadAdminUsers();
}

function openGlobalPlayerDialog(player = null) {
  const form = document.getElementById('playerForm');
  if (!form) return;
  editingGlobalPlayerId = player?.id || null;
  form.reset();
  if (player) {
    form.elements.name.value = player.name || '';
    form.elements.surname.value = player.surname || '';
    form.elements.birth.value = player.birth || '';
    form.elements.joinDate.value = player.joinDate || '';
    form.elements.nationality.value = player.nationality || '';
    form.elements.position.value = player.position || 'Mittelfeld';
    form.elements.club.value = player.club || '';
    form.elements.height.value = player.height ?? '';
    form.elements.foot.value = player.foot || '';
    form.elements.notes.value = player.notes || '';
  }
  const heading = document.querySelector('#playerDialog .modal-head h2');
  if (heading) heading.textContent = player ? 'Spielerprofil bearbeiten' : 'Spielerprofil anlegen';
  document.getElementById('playerDialog').showModal();
}

function openMainReportDialog(report = null) {
  const form = document.getElementById('reportForm');
  if (!form) return;
  editingMainReportId = report?.id || null;
  form.reset();
  populatePlayerSelect();

  if (report) {
    form.elements.playerId.value = report.playerId || '';
    form.elements.date.value = report.date || '';
    form.elements.rating.value = report.rating ?? '';
    form.elements.notes.value = report.notes || '';
  } else {
    form.elements.date.value = new Date().toISOString().slice(0, 10);
  }

  const heading = document.querySelector('#reportDialog .modal-head h2');
  if (heading) heading.textContent = report ? 'Scouting-Bericht bearbeiten' : 'Scouting-Bericht erstellen';
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.textContent = report ? 'Änderungen speichern' : 'Bericht speichern';
  document.getElementById('reportDialog').showModal();
}

function openDialog(id) {
  if (id === 'playerDialog') {
    openGlobalPlayerDialog();
    return;
  }
  if (id === 'reportDialog') {
    openMainReportDialog();
    return;
  }
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
          <h3>${escapeHtml(pfssPlayerFullName(p))}</h3>
          <small>${escapeHtml(p.club || 'Verein nicht angegeben')}</small>
        </div>
      </div>
      <div class="player-meta">
        <span class="tag">${escapeHtml(p.position)}</span>
        ${p.nationality ? `<span class="tag">${escapeHtml(p.nationality)}</span>` : ''}
        ${p.foot ? `<span class="tag">${escapeHtml(p.foot)}</span>` : ''}
      </div>
      ${window.pfssIsRealAdmin ? `
        <div class="player-card-actions">
          <button type="button" data-global-player-edit="${escapeHtml(p.id)}">Bearbeiten</button>
          <button type="button" data-global-player-delete="${escapeHtml(p.id)}">Löschen</button>
        </div>` : ''}
    </article>`;
}

function pfssPlayerFullName(player) {
  return [String(player?.name || '').trim(), String(player?.surname || '').trim()]
    .filter(Boolean)
    .join(' ') || 'Unbekannter Spieler';
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

  host.innerHTML = reports.slice().reverse().map(report => {
    const player = players.find(item => item.id === report.playerId);
    const canManage = window.pfssIsRealAdmin || report.authorId === window.pfssCurrentUserId;
    return `
      <article class="report-card">
        <div class="rating-bubble">${escapeHtml(report.rating)}</div>
        <div class="report-card-content">
          <h3>${escapeHtml(player ? pfssPlayerFullName(player) : 'Unbekannter Spieler')}</h3>
          <small>${escapeHtml(report.date || 'Ohne Datum')} · Scouting-Bewertung</small>
          <p>${escapeHtml(report.notes)}</p>
          ${canManage ? `
            <div class="report-card-actions">
              <button type="button" data-main-report-edit="${escapeHtml(report.id)}">Bearbeiten</button>
              <button type="button" data-main-report-delete="${escapeHtml(report.id)}">Löschen</button>
            </div>` : ''}
        </div>
      </article>`;
  }).join('');
}

async function savePlayer(form) {
  if (!window.pfssIsRealAdmin) {
    toast('Nur Plattformadministratoren dürfen den globalen Spielerkatalog verändern.');
    return;
  }
  if (!pfmsMainDataReady) {
    toast('Die Cloud-Datenbank ist noch nicht verfügbar.');
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const row = {
    name: String(data.name || '').trim(),
    surname: String(data.surname || '').trim() || null,
    birth: data.birth || null,
    join_date: data.joinDate || null,
    nationality: String(data.nationality || '').trim() || null,
    position: data.position || 'Mittelfeld',
    club: String(data.club || '').trim() || null,
    height: data.height ? Number(data.height) : null,
    foot: data.foot || null,
    notes: String(data.notes || '').trim() || null
  };
  if (!row.name) {
    toast('Bitte gib einen Spielernamen ein.');
    return;
  }
  if (!editingGlobalPlayerId) row.created_by = window.pfssCurrentUserId;

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const query = pfssSupabase.from('pfms_global_players');
    const result = editingGlobalPlayerId
      ? await query.update(row).eq('id', editingGlobalPlayerId).select('*').single()
      : await query.insert(row).select('*').single();
    if (result.error) throw result.error;

    const savedPlayer = mapPfmsPlayerRow(result.data);
    if (editingGlobalPlayerId) {
      players = players.map(player => player.id === editingGlobalPlayerId ? savedPlayer : player);
    } else {
      players.push(savedPlayer);
    }
    editingGlobalPlayerId = null;
    form.reset();
    closeDialog('playerDialog');
    const heading = document.querySelector('#playerDialog .modal-head h2');
    if (heading) heading.textContent = 'Spielerprofil anlegen';
    renderDashboard();
    renderPlayers();
    toast('Spielerprofil wurde in der globalen PFMS-Datenbank gespeichert.');
  } catch (error) {
    console.error('PFMS global player save failed:', error);
    toast('Spieler konnte nicht gespeichert werden. Bitte Datenbankmigration und Administratorrechte prüfen.');
  } finally {
    button.disabled = false;
  }
}

async function deleteGlobalPlayer(playerId) {
  if (!window.pfssIsRealAdmin || !pfmsMainDataReady) return;
  const player = players.find(item => item.id === playerId);
  if (!player) return;
  if (!window.confirm('Spielerprofil "' + pfssPlayerFullName(player) + '" wirklich löschen? Die Datenbank verhindert die Löschung, solange noch Scoutingberichte auf den Spieler verweisen.')) return;

  try {
    const { error } = await pfssSupabase
      .from('pfms_global_players')
      .delete()
      .eq('id', playerId);
    if (error) throw error;
    players = players.filter(item => item.id !== playerId);
    renderDashboard();
    renderPlayers();
    toast('Spielerprofil wurde gelöscht.');
  } catch (error) {
    console.error('PFMS global player deletion failed:', error);
    toast('Spieler wurde nicht gelöscht. Vorhandene Scoutingberichte schützen die Spielerhistorie.');
  }
}

async function saveReport(form) {
  if (!pfmsMainDataReady) {
    toast('Die Cloud-Datenbank ist noch nicht verfügbar.');
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const playerId = String(data.playerId || '');
  const rating = Number(data.rating);
  const notes = String(data.notes || '').trim();

  if (!players.some(player => player.id === playerId)) {
    toast('Bitte wähle einen gültigen Spieler aus dem globalen Katalog.');
    return;
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 10 || !notes) {
    toast('Bitte gib eine Bewertung von 1 bis 10 und eine Beobachtung ein.');
    return;
  }

  const payload = {
    player_id: playerId,
    observation_date: data.date || new Date().toISOString().slice(0, 10),
    overall_rating: rating,
    notes
  };
  if (!editingMainReportId) payload.author_id = window.pfssCurrentUserId;

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const query = pfssSupabase.from('pfms_main_scouting_reports');
    const result = editingMainReportId
      ? await query.update(payload).eq('id', editingMainReportId).select('*').single()
      : await query.insert(payload).select('*').single();
    if (result.error) throw result.error;

    const savedReport = mapPfmsReportRow(result.data);
    if (editingMainReportId) {
      reports = reports.map(report => report.id === editingMainReportId ? savedReport : report);
    } else {
      reports.push(savedReport);
    }
    editingMainReportId = null;
    form.reset();
    closeDialog('reportDialog');
    const heading = document.querySelector('#reportDialog .modal-head h2');
    if (heading) heading.textContent = 'Scouting-Bericht erstellen';
    if (button) button.textContent = 'Bericht speichern';
    renderDashboard();
    renderReports();
    toast('Scouting-Bericht wurde sicher in der Cloud gespeichert.');
  } catch (error) {
    console.error('PFMS scouting report save failed:', error);
    toast('Bericht konnte nicht gespeichert werden. Prüfe deine Berechtigung und die Datenbankverbindung.');
  } finally {
    button.disabled = false;
  }
}

async function deleteMainReport(reportId) {
  if (!pfmsMainDataReady) return;
  const report = reports.find(item => item.id === reportId);
  if (!report) return;

  const canManage = window.pfssIsRealAdmin || report.authorId === window.pfssCurrentUserId;
  if (!canManage) {
    toast('Du darfst nur deine eigenen Scouting-Berichte verwalten.');
    return;
  }
  if (!window.confirm('Diesen Scouting-Bericht wirklich löschen?')) return;

  try {
    const { error } = await pfssSupabase
      .from('pfms_main_scouting_reports')
      .delete()
      .eq('id', reportId);
    if (error) throw error;
    reports = reports.filter(item => item.id !== reportId);
    renderDashboard();
    renderReports();
    toast('Scouting-Bericht wurde gelöscht.');
  } catch (error) {
    console.error('PFMS scouting report deletion failed:', error);
    toast('Bericht konnte nicht gelöscht werden. Prüfe deine Berechtigung und die Datenbankverbindung.');
  }
}

function exportPfssBackup() {
  const backup = {
    product: 'PFMS',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data: { players, reports }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PFMS-Backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('PFMS-Backup wurde erstellt.');
}

function importPfssBackup(file) {
  if (!file) return;
  if (!window.pfssIsRealAdmin || !pfmsMainDataReady) {
    toast('Ein vollständiger Katalogimport ist nur für Administratoren bei verfügbarer Cloud-Datenbank möglich.');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const backup = JSON.parse(String(reader.result || ''));
      if (!['PFMS','PFSS'].includes(backup?.product) || backup?.formatVersion !== 1 ||
          !Array.isArray(backup?.data?.players) || !Array.isArray(backup?.data?.reports)) {
        throw new Error('Ungültiges PFMS-Backupformat');
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
        'Backup enthält ' + importedPlayers.length + ' Spieler und ' +
        importedReports.length + ' Berichte. Die Einträge werden zusätzlich in die PFMS-Cloud importiert; bestehende Daten bleiben erhalten. Fortfahren?'
      );
      if (!confirmed) return;

      const { data, error } = await pfssSupabase.rpc('pfms_import_legacy_catalogue', {
        p_players: importedPlayers,
        p_reports: importedReports
      });
      if (error) throw error;
      await loadPfmsMainData();
      toast('Backup importiert: ' + data.players_imported + ' Spieler und ' +
        data.reports_imported + ' Berichte.');
    } catch (error) {
      console.error('PFMS cloud backup import failed:', error);
      toast('Backup konnte nicht importiert werden. Prüfe Format, Migration und Datenbankprotokoll.');
    }
  };
  reader.onerror = () => toast('Die Backup-Datei konnte nicht gelesen werden.');
  reader.readAsText(file);
}

async function importLegacyLocalData() {
  if (!window.pfssIsRealAdmin || !pfmsMainDataReady) {
    toast('Alt-Daten können nur durch einen Administrator in die aktive Cloud-Datenbank übernommen werden.');
    return;
  }
  if (!legacyLocalPlayers.length && !legacyLocalReports.length) {
    toast('Keine lokalen PFMS-Alt-Daten gefunden.');
    return;
  }
  const confirmed = window.confirm(
    'Es wurden ' + legacyLocalPlayers.length + ' lokale Spieler und ' +
    legacyLocalReports.length + ' lokale Berichte gefunden. Sie werden zusätzlich in den globalen PFMS-Katalog importiert. Bestehende Cloud-Daten bleiben erhalten. Fortfahren?'
  );
  if (!confirmed) return;

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_import_legacy_catalogue', {
      p_players: legacyLocalPlayers,
      p_reports: legacyLocalReports
    });
    if (error) throw error;

    localStorage.removeItem(DB_KEYS.players);
    localStorage.removeItem(DB_KEYS.reports);
    legacyLocalPlayers = [];
    legacyLocalReports = [];
    await loadPfmsMainData();
    toast('Alt-Daten übernommen: ' + data.players_imported + ' Spieler und ' +
      data.reports_imported + ' Berichte.');
  } catch (error) {
    console.error('PFMS legacy local data import failed:', error);
    toast('Lokale Alt-Daten konnten nicht importiert werden. Die Originaldaten bleiben im Browser erhalten.');
  }
}
function formatPfmsMediaSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderPfmsMainMedia() {
  const host = document.getElementById('mediaGrid');
  if (!host) return;

  if (!mediaItems.length) {
    host.innerHTML = '<div class="empty-state"><span class="empty-icon">▧</span><b>Noch keine Medien gespeichert</b><p>Lade deine Spielerfotos oder Videos hoch. Die Dateien werden privat in der PFMS-Cloud gespeichert.</p></div>';
    renderDashboard();
    return;
  }

  host.innerHTML = mediaItems.map((item) => {
    const url = item.signedUrl ? escapeHtml(item.signedUrl) : '';
    const preview = !url
      ? '<div class="media-unavailable">Datei derzeit nicht abrufbar</div>'
      : item.media_type === 'video'
        ? '<video src="' + url + '" controls playsinline preload="metadata"></video>'
        : '<img src="' + url + '" alt="' + escapeHtml(item.file_name) + '" loading="lazy">';
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE') : '–';

    return '<article class="media-card pfms-cloud-media-card">' +
      preview +
      '<div class="media-card-caption"><b>' + escapeHtml(item.file_name) + '</b>' +
      '<small>' + escapeHtml(date) + ' · ' + escapeHtml(formatPfmsMediaSize(item.file_size)) + '</small>' +
      '<button type="button" class="btn btn-secondary" data-main-media-delete="' + escapeHtml(item.id) + '">Datei löschen</button>' +
      '</div></article>';
  }).join('');

  renderDashboard();
}

async function loadPfmsMainMedia(force = false) {
  const host = document.getElementById('mediaGrid');
  const status = document.getElementById('mainMediaStatus');
  const requestUserId = window.pfssCurrentUserId;
  if (!host) return false;
  if (!requestUserId) {
    mediaItems = [];
    pfmsMainMediaOwnerId = '';
    pfmsMainMediaLoadedAt = 0;
    renderPfmsMainMedia();
    if (status) {
      status.hidden = false;
      status.textContent = 'Bitte melde dich an, um deine privaten Medien zu laden.';
    }
    return false;
  }

  // Never reuse a previous account's private media cache after an account switch.
  if (pfmsMainMediaOwnerId !== requestUserId) {
    pfmsMainMediaRequestId += 1;
    pfmsMainMediaOwnerId = requestUserId;
    pfmsMainMediaLoadedAt = 0;
    mediaItems = [];
    renderPfmsMainMedia();
  }

  if (pfmsMainMediaLoading) return false;
  if (!force && pfmsMainMediaLoadedAt &&
      Date.now() - pfmsMainMediaLoadedAt < 45 * 60 * 1000) {
    return true;
  }

  const requestId = ++pfmsMainMediaRequestId;
  pfmsMainMediaLoading = true;
  if (status) {
    status.hidden = false;
    status.textContent = 'Private Medien werden aus der PFMS-Cloud geladen …';
  }
  try {
    const { data, error } = await pfssSupabase
      .from('pfms_main_media')
      .select('id,owner_id,media_type,file_name,storage_path,mime_type,file_size,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const signedItems = await Promise.all(rows.map(async (item) => {
      const signed = await pfssSupabase.storage
        .from(PFMS_MAIN_MEDIA_BUCKET)
        .createSignedUrl(item.storage_path, 3600);
      return {
        ...item,
        signedUrl: signed.error ? '' : signed.data?.signedUrl || ''
      };
    }));

    if (requestId !== pfmsMainMediaRequestId ||
        requestUserId !== window.pfssCurrentUserId ||
        requestUserId !== pfmsMainMediaOwnerId) return false;

    mediaItems = signedItems;
    pfmsMainMediaLoadedAt = Date.now();
    renderPfmsMainMedia();
    if (status) {
      status.hidden = true;
      status.textContent = '';
    }
    return true;
  } catch (error) {
    if (requestId !== pfmsMainMediaRequestId ||
        requestUserId !== window.pfssCurrentUserId) return false;
    console.error('PFMS main media load failed:', error);
    mediaItems = [];
    pfmsMainMediaLoadedAt = 0;
    renderPfmsMainMedia();
    if (status) {
      status.hidden = false;
      status.textContent = 'Die private Medienbibliothek ist noch nicht verfügbar. Bitte prüfe, ob die PFMS-Medienmigration in der Testdatenbank angewendet wurde.';
    }
    return false;
  } finally {
    if (requestId === pfmsMainMediaRequestId) pfmsMainMediaLoading = false;
  }
}
function safePfmsMediaFileName(value) {
  const cleaned = String(value || 'datei')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(-100);
  return cleaned || 'datei';
}

async function addMedia(files) {
  const selected = Array.from(files || []);
  if (!selected.length) return;
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const isCurrentMediaSession = () =>
    requestGeneration === pfmsAuthGeneration &&
    requestUserId === window.pfssCurrentUserId;
  if (!requestUserId) {
    toast('Deine Sitzung ist nicht verfügbar. Bitte melde dich erneut an.');
    return;
  }
  if (selected.length > 20) {
    toast('Bitte lade höchstens 20 Dateien gleichzeitig hoch.');
    return;
  }

  const input = document.getElementById('mediaInput');
  const status = document.getElementById('mainMediaStatus');
  if (input) input.disabled = true;
  if (status) {
    status.hidden = false;
    status.textContent = 'Dateien werden privat in die PFMS-Cloud hochgeladen …';
  }

  let uploadedCount = 0;
  const failures = [];
  for (const file of selected) {
    if (!isCurrentMediaSession()) break;
    if (!PFMS_MAIN_MEDIA_ALLOWED_TYPES.has(file.type)) {
      failures.push(file.name + ': Dateityp nicht zugelassen.');
      continue;
    }
    if (!file.size || file.size > PFMS_MAIN_MEDIA_MAX_SIZE) {
      failures.push(file.name + ': Die Datei muss kleiner als 50 MB sein.');
      continue;
    }

    const storagePath = requestUserId + '/main/' +
      Date.now() + '-' + Math.random().toString(16).slice(2) + '-' +
      safePfmsMediaFileName(file.name);
    try {
      const uploaded = await pfssSupabase.storage
        .from(PFMS_MAIN_MEDIA_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });
      if (!isCurrentMediaSession()) {
        if (!uploaded.error) {
          try { await pfssSupabase.storage.from(PFMS_MAIN_MEDIA_BUCKET).remove([storagePath]); } catch (_cleanupError) {}
        }
        break;
      }
      if (uploaded.error) throw uploaded.error;

      const metadata = await pfssSupabase.from('pfms_main_media').insert({
        owner_id: requestUserId,
        media_type: file.type.startsWith('video/') ? 'video' : 'photo',
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size
      });
      if (!isCurrentMediaSession()) break;
      if (metadata.error) {
        await pfssSupabase.storage.from(PFMS_MAIN_MEDIA_BUCKET).remove([storagePath]);
        throw metadata.error;
      }
      uploadedCount += 1;
    } catch (error) {
      if (!isCurrentMediaSession()) break;
      console.error('PFMS main media upload failed:', error);
      failures.push(file.name + ': Upload fehlgeschlagen.');
    }
  }

  if (input) {
    input.value = '';
    input.disabled = false;
  }
  if (!isCurrentMediaSession()) return;
  await loadPfmsMainMedia(true);
  if (!isCurrentMediaSession()) return;

  if (status && failures.length) {
    status.hidden = false;
    status.textContent = failures.slice(0, 3).join(' ') +
      (failures.length > 3 ? ' Weitere Dateien konnten nicht hochgeladen werden.' : '');
  }
  if (uploadedCount) toast(uploadedCount + ' Datei(en) wurden privat in PFMS gespeichert.');
  else if (failures.length) toast('Keine Datei konnte hochgeladen werden. Bitte Dateityp, Größe und Datenbankmigration prüfen.');
}

async function deleteMainMedia(mediaId) {
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const isCurrentMediaSession = () =>
    requestGeneration === pfmsAuthGeneration &&
    requestUserId === window.pfssCurrentUserId;
  const item = mediaItems.find((media) => media.id === mediaId);
  if (!requestUserId || !item || item.owner_id !== requestUserId) return;
  if (!window.confirm('Datei "' + item.file_name + '" wirklich aus deiner privaten Medienbibliothek löschen?')) return;

  try {
    const removedFile = await pfssSupabase.storage
      .from(PFMS_MAIN_MEDIA_BUCKET)
      .remove([item.storage_path]);
    if (!isCurrentMediaSession()) return;
    if (removedFile.error) throw removedFile.error;

    const removedRow = await pfssSupabase
      .from('pfms_main_media')
      .delete()
      .eq('id', mediaId)
      .eq('owner_id', requestUserId);
    if (!isCurrentMediaSession()) return;
    if (removedRow.error) {
      await loadPfmsMainMedia(true);
      if (isCurrentMediaSession()) {
        toast('Die Datei wurde aus dem Speicher entfernt; der Datenbankeintrag muss noch geprüft werden.');
      }
      return;
    }

    await loadPfmsMainMedia(true);
    if (isCurrentMediaSession()) toast('Datei wurde aus deiner privaten Medienbibliothek gelöscht.');
  } catch (error) {
    if (!isCurrentMediaSession()) return;
    console.error('PFMS main media deletion failed:', error);
    toast('Datei konnte nicht gelöscht werden. Bitte Berechtigung und Speicherverbindung prüfen.');
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

  const editGlobalPlayerButton = event.target.closest('[data-global-player-edit]');
  if (editGlobalPlayerButton) {
    const player = players.find(item => item.id === editGlobalPlayerButton.dataset.globalPlayerEdit);
    if (player && window.pfssIsRealAdmin) openGlobalPlayerDialog(player);
    return;
  }

  const deleteGlobalPlayerButton = event.target.closest('[data-global-player-delete]');
  if (deleteGlobalPlayerButton) {
    deleteGlobalPlayer(deleteGlobalPlayerButton.dataset.globalPlayerDelete);
    return;
  }

  const editMainReportButton = event.target.closest('[data-main-report-edit]');
  if (editMainReportButton) {
    const report = reports.find(item => item.id === editMainReportButton.dataset.mainReportEdit);
    if (report && (window.pfssIsRealAdmin || report.authorId === window.pfssCurrentUserId)) {
      openMainReportDialog(report);
    }
    return;
  }

  const deleteMainReportButton = event.target.closest('[data-main-report-delete]');
  if (deleteMainReportButton) {
    deleteMainReport(deleteMainReportButton.dataset.mainReportDelete);
    return;
  }

  const deleteMainMediaButton = event.target.closest('[data-main-media-delete]');
  if (deleteMainMediaButton) {
    deleteMainMedia(deleteMainMediaButton.dataset.mainMediaDelete);
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'show-legacy-invitation') {
    const panel = document.getElementById('pfmsLegacyInvitationPanel');
    if (panel) panel.hidden = false;
    void loadPfmsLegacyInvitationOrganizations();
    return;
  }

  if (action === 'hide-legacy-invitation') {
    const panel = document.getElementById('pfmsLegacyInvitationPanel');
    if (panel) panel.hidden = true;
    return;
  }


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
  .addEventListener('submit', async e => {
    e.preventDefault();
    await savePlayer(e.currentTarget);
  });

document.getElementById('reportForm')
  .addEventListener('submit', async e => {
    e.preventDefault();
    await saveReport(e.currentTarget);
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

// Mobile Sidebar: horizontal nach links wischen, auch wenn der Finger
// außerhalb des Sidebar-Bereichs losgelassen wird.
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

  // touchend bewusst am Dokument registrieren: Der Finger darf außerhalb
  // der Sidebar enden, ohne dass das Schließen-Ereignis verloren geht.
  document.addEventListener('touchend', event => {
    if (!touchStart || !mobileQuery.matches || !sidebar.classList.contains('open')) {
      touchStart = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    touchStart = null;

    if (deltaX <= -55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    touchStart = null;
  }, { passive: true });
})();

renderDashboard();

document.getElementById('exportBackupButton')
  .addEventListener('click', exportPfssBackup);
document.getElementById('importBackupButton')
  .addEventListener('click', () => document.getElementById('backupFileInput').click());
document.getElementById('importLegacyDataButton')
  ?.addEventListener('click', importLegacyLocalData);
document.getElementById('backupFileInput')
  .addEventListener('change', event => {
    importPfssBackup(event.target.files?.[0]);
    event.target.value = '';
  });

// ============================================
// PFMS AUTHENTICATION – SUPABASE
// ============================================

const PFSS_SUPABASE_URL =
  'https://nkkajhjdvfjzrvxkbokg.supabase.co';

const PFSS_SUPABASE_KEY =
  'sb_publishable_0FH-h-DJDhEnF4TKzTUiBg_7hDljTHi';

const pfssSupabase = window.supabase.createClient(
  PFSS_SUPABASE_URL,
  PFSS_SUPABASE_KEY,
  {
    auth: {
      // Die Anmeldung bleibt beim normalen Neuladen der Seite erhalten.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

let pfmsClientErrorWindowStart = 0;
let pfmsClientErrorCount = 0;
let pfmsClientErrorHandlersAttached = false;

function pfmsSanitizeLogValue(value, maxLength = 600) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[redacted-token]')
    .replace(/(access_token|refresh_token|password|authorization|bootstrap_token|client_secret|api_key|apikey|secret|token)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/([?&](?:access_token|refresh_token|token|key|password|apikey)=)[^&#\s]*/gi, '$1[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, maxLength);
}

function pfmsSanitizeLogPath(value) {
  return String(value || '/')
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]')
    .replace(/\b\d{5,}\b/g, '[id]')
    .slice(0, 255) || '/';
}

async function pfmsLogClientError(message, context = {}) {
  const now = Date.now();
  if (now - pfmsClientErrorWindowStart > 60000) {
    pfmsClientErrorWindowStart = now;
    pfmsClientErrorCount = 0;
  }
  if (pfmsClientErrorCount >= 5) return;
  pfmsClientErrorCount += 1;

  try {
    const { data, error: sessionError } = await pfssSupabase.auth.getSession();
    if (sessionError || !data.session?.user) return;

    let sourcePath = '';
    if (context.source) {
      try {
        sourcePath = new URL(String(context.source), window.location.origin).pathname.slice(0, 255);
      } catch (error) {
        sourcePath = '';
      }
    }

    const details = {
      source: pfmsSanitizeLogPath(sourcePath),
      line: Number.isFinite(Number(context.line)) ? Number(context.line) : null,
      column: Number.isFinite(Number(context.column)) ? Number(context.column) : null
    };

    const { error } = await pfssSupabase.from('pfms_system_events').insert({
      event_type: 'frontend_error',
      severity: 'error',
      message: pfmsSanitizeLogValue(message, 2000) || 'Unbekannter Frontend-Fehler',
      route: pfmsSanitizeLogPath(window.location.pathname || '/'),
      details
    });
    if (error) console.debug('PFMS error event could not be stored:', error.message);
  } catch (error) {
    // Error reporting must never create another uncaught application error.
    console.debug('PFMS error reporting failed:', error?.message || error);
  }
}

function setupPfmsClientErrorLogging() {
  if (pfmsClientErrorHandlersAttached) return;
  pfmsClientErrorHandlersAttached = true;

  window.addEventListener('error', (event) => {
    void pfmsLogClientError(event.message || 'Unbehandelter JavaScript-Fehler', {
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    void pfmsLogClientError(
      reason instanceof Error ? reason.message : String(reason ?? 'Unbehandelte Promise-Ablehnung')
    );
  });
}

setupPfmsClientErrorLogging();

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

async function updateOwnerBootstrapVisibility(user) {
  const section = document.getElementById('ownerBootstrapSection');
  if (!section) return;
  section.hidden = true;

  // Only the account created through the dedicated owner registration route
  // may see the bootstrap form. The Edge Function independently verifies it.
  if (user?.user_metadata?.registration_type !== 'owner_bootstrap') return;

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_owner_setup_available');
    if (error) throw error;
    section.hidden = data !== true;
  } catch (error) {
    // The owner setup is hidden until its database migration is installed.
    console.warn('PFMS owner setup availability could not be checked:', error?.message || error);
  }
}

function showPendingScreen(status, user) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('pendingScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');

  const title = document.getElementById('pendingTitle');
  const message = document.getElementById('pendingText');
  const ownerSection = document.getElementById('ownerBootstrapSection');
  if (ownerSection) ownerSection.hidden = true;

  if (status === 'suspended') {
    title.textContent = 'Zugang gesperrt';
    message.textContent =
      'Dein Konto ist derzeit gesperrt. Bitte wende dich an die Administration.';
  } else {
    title.textContent = 'Freigabe ausstehend';
    message.textContent =
      'Dein Konto wurde angelegt. Der Zugang wird nach Prüfung freigeschaltet.';
    updateOwnerBootstrapVisibility(user);
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

async function showAuthenticatedApp(user, profile) {
  window.scrollTo(0, 0);
  const role = String(profile.role || '').toLowerCase().replace(/[ä]/g,'ae').replace(/[ö]/g,'oe').replace(/[ü]/g,'ue');
  const username = profile.username || user.email || 'PFMS Nutzer';
  const isAdmin = role === 'admin' || role === 'administrator';
  const adminClubConsole = document.getElementById('adminClubConsole');
  const adminScoutConsole = document.getElementById('adminScoutConsole');
  if (adminClubConsole) adminClubConsole.hidden = !isAdmin;
  if (adminScoutConsole) adminScoutConsole.hidden = !isAdmin;
  const isScout = role.includes('scout');
  let hasAssignedTeam = false;
  try {
    const teamAccess = await pfssSupabase.rpc('pfms_list_my_legacy_teams');
    if (!teamAccess.error) hasAssignedTeam = (teamAccess.data || []).length > 0;
  } catch (teamAccessError) {
    console.warn('PFMS team membership lookup unavailable:', teamAccessError?.message || teamAccessError);
  }
  const isTeam = hasAssignedTeam || ['trainer','co-trainer','cotrainer','betreuer','coach'].some(x => role.includes(x));
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
  if (window.pfssCurrentUserId && window.pfssCurrentUserId !== user.id) {
    resetPfmsAuthenticatedState();
  }
  window.pfssCurrentUserId = user.id;
  window.pfssCurrentRole = profile.role;
  window.pfssIsRealAdmin = isAdmin;
  window.pfssPreviewMode = 'admin';
  setupPfmsLegacyTeamWorkspace();
  await loadPfmsMainData();
  void loadPfmsLegacyTeams();
  await loadPfmsMainMedia();
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
  setupPfmsAdminMembers();
  setupPfmsAdminErrors();
  setupPfmsLegacyInvitationWorkspace();
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
  const shouldShowWelcome = showIntro || showReturningGreeting;
  if (welcomeUser) welcomeUser.textContent = 'Willkommen, ' + username + '!';
  if (welcome) welcome.classList.toggle('hidden', !shouldShowWelcome);

  window.clearTimeout(window.pfmsWelcomeTimer);
  const finishAuthentication = () => {
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
  };

  if (shouldShowWelcome) {
    window.pfmsWelcomeTimer = window.setTimeout(finishAuthentication, 4500);
  } else {
    // Ein normaler Seiten-Reload stellt die App sofort wieder her.
    finishAuthentication();
  }
}

async function loadAdminUsers() {
  const message = document.getElementById('adminMessage');
  const host = document.getElementById('adminUserList');
  if (!window.pfssIsRealAdmin) {
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
  if (!card || !window.pfssIsRealAdmin) return;
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
  if (!window.pfssIsRealAdmin) return;
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

const PFMS_ADMIN_MEMBER_ROLES = {
  owner: 'Besitzer',
  club_admin: 'Vereinsleitung',
  agency_admin: 'Agenturleitung',
  scout: 'Scout',
  trainer: 'Trainer',
  co_trainer: 'Co-Trainer',
  betreuer: 'Betreuer',
  member: 'Mitglied'
};

const PFMS_MEMBERSHIP_STATUSES = {
  pending: 'Ausstehend',
  active: 'Aktiv',
  suspended: 'Gesperrt'
};

let pfmsLegacyTeamsBound = false;
let pfmsLegacyTeams = [];
let pfmsManageableLegacyOrganizations = [];
let pfmsSelectedLegacyTeam = null;
let pfmsSelectedTeamStaff = [];
let pfmsSelectedTeamPermissionAssignment = null;
let pfmsEditingLegacyTeamId = null;
let pfmsLegacyTeamRoster = [];
let pfmsLegacyTeamRosterCandidates = [];

let pfmsLegacyInvitationBound = false;
let pfmsLegacyMemberDirectoryBound = false;
let pfmsLegacyInvitationOrganizations = [];

async function loadPfmsLegacyInvitationOrganizations() {
  const panel = document.getElementById('pfmsLegacyInvitationPanel');
  const form = document.getElementById('pfmsLegacyInvitationForm');
  const inviteSelect = document.getElementById('pfmsLegacyInvitationOrganization');
  const message = document.getElementById('pfmsLegacyInvitationMessage');
  const result = document.getElementById('pfmsLegacyInvitationResult');
  const membersPanel = document.getElementById('pfmsLegacyMembersPanel');
  const memberSelect = document.getElementById('pfmsLegacyMembersOrganization');
  const membersMessage = document.getElementById('pfmsLegacyMembersMessage');
  if (!panel || !form || !inviteSelect || !message || !membersPanel || !memberSelect) return;

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  form.hidden = true;
  result.hidden = true;
  inviteSelect.innerHTML = '<option value="">Organisationen werden geladen …</option>';
  if (requestUserId) message.textContent = 'Deine verwaltbaren Organisationen werden geprüft …';

  if (!requestUserId) {
    panel.hidden = true;
    membersPanel.hidden = true;
    return;
  }

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_list_my_manageable_legacy_organizations');
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;

    pfmsLegacyInvitationOrganizations = data || [];
    const organizations = pfmsLegacyInvitationOrganizations;
    const inviteEligible = organizations.filter(org =>
      ['approved', 'active'].includes(String(org.organization_status || '').toLowerCase())
    );

    if (inviteEligible.length) {
      inviteSelect.innerHTML = inviteEligible.map(org =>
        '<option value="' + escapeHtml(org.organization_id) + '">' +
          escapeHtml(org.organization_name) + ' · ' +
          escapeHtml(org.organization_type === 'agency' ? 'Agentur' : 'Verein') +
        '</option>'
      ).join('');
      form.hidden = false;
      message.textContent = inviteEligible.length + ' Organisation(en) mit Einladungsrecht verfügbar.';
    } else {
      inviteSelect.innerHTML = '<option value="">Keine freigegebene Organisation vorhanden</option>';
      form.hidden = true;
      message.textContent = organizations.length
        ? 'Deine Organisation ist noch nicht freigegeben. Einladungen sind erst nach Freigabe möglich.'
        : 'Für dieses Konto ist keine Organisation mit Einladungsrechten hinterlegt.';
    }

    membersPanel.hidden = organizations.length === 0;
    if (membersMessage) {
      membersMessage.textContent = organizations.length
        ? 'Wähle eine Organisation, um ihre Mitgliedschaften zu verwalten.'
        : 'Für dieses Konto sind keine verwaltbaren Organisationen hinterlegt.';
    }
    if (!organizations.length) {
      memberSelect.innerHTML = '<option value="">Keine Organisation verfügbar</option>';
      return;
    }

    const previousSelection = memberSelect.value;
    memberSelect.innerHTML = organizations.map(org =>
      '<option value="' + escapeHtml(org.organization_id) + '">' +
        escapeHtml(org.organization_name) + ' · ' +
        escapeHtml(org.organization_type === 'agency' ? 'Agentur' : 'Verein') +
        ' (' + escapeHtml(org.organization_status) + ')' +
      '</option>'
    ).join('');
    if (organizations.some(org => org.organization_id === previousSelection)) {
      memberSelect.value = previousSelection;
    }
    await loadPfmsLegacyOrganizationMembers();
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS legacy invitation organizations:', error);
    inviteSelect.innerHTML = '<option value="">Nicht verfügbar</option>';
    message.textContent = 'Organisationen konnten nicht geladen werden. Bitte Staging-Migration und Berechtigungen prüfen.';
    membersPanel.hidden = true;
  }
}

async function loadPfmsLegacyOrganizationMembers() {
  const panel = document.getElementById('pfmsLegacyMembersPanel');
  const form = document.getElementById('pfmsLegacyMembersFilterForm');
  const select = document.getElementById('pfmsLegacyMembersOrganization');
  const message = document.getElementById('pfmsLegacyMembersMessage');
  const results = document.getElementById('pfmsLegacyMemberResults');
  const summary = document.getElementById('pfmsLegacyMembersSummary');
  if (!panel || !form || !select || !message || !results) return;

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const organizationId = select.value;
  if (!requestUserId || !organizationId) {
    results.innerHTML = '';
    if (summary) summary.hidden = true;
    return;
  }

  const query = document.getElementById('pfmsLegacyMembersQuery')?.value.trim() || '';
  const role = document.getElementById('pfmsLegacyMembersRole')?.value || null;
  const status = document.getElementById('pfmsLegacyMembersStatus')?.value || null;
  message.textContent = 'Mitglieder werden geladen …';
  results.innerHTML = '';

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_list_legacy_org_members_for_manager', {
      p_organization_id: organizationId,
      p_query: query,
      p_status: status,
      p_role: role
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;

    const members = data || [];
    const activeCount = members.filter(member => member.membership_status === 'active').length;
    const pendingCount = members.filter(member => member.membership_status === 'pending').length;
    const suspendedCount = members.filter(member => member.membership_status === 'suspended').length;
    if (summary) {
      summary.hidden = false;
      document.getElementById('pfmsLegacyMembersActiveCount').textContent = String(activeCount);
      document.getElementById('pfmsLegacyMembersPendingCount').textContent = String(pendingCount);
      document.getElementById('pfmsLegacyMembersSuspendedCount').textContent = String(suspendedCount);
    }
    message.textContent = members.length
      ? members.length + ' Mitgliedschaft(en) gefunden.'
      : 'Keine passenden Mitgliedschaften gefunden.';

    if (!members.length) {
      results.innerHTML = '<div class="empty-state"><b>Keine Mitglieder gefunden</b><p>Ändere die Suchkriterien oder prüfe, ob die Organisation bereits Mitglieder hat.</p></div>';
      return;
    }

    const roleLabels = {
      owner: 'Besitzer',
      club_admin: 'Vereinsleitung',
      agency_admin: 'Agenturleitung',
      scout: 'Scout',
      trainer: 'Trainer',
      co_trainer: 'Co-Trainer',
      betreuer: 'Betreuer',
      member: 'Mitglied'
    };
    const statusLabels = { pending: 'Ausstehend', active: 'Aktiv', suspended: 'Gesperrt' };
    const operationalRoles = ['scout','trainer','co_trainer','betreuer','member'];

    results.innerHTML = members.map(member => {
      const isLeadership = ['owner','club_admin','agency_admin'].includes(member.member_role);
      const canEdit = window.pfssIsRealAdmin || !isLeadership;
      const availableRoles = window.pfssIsRealAdmin
        ? Object.entries(roleLabels)
        : operationalRoles.map(key => [key, roleLabels[key]]);
      const roleControl = canEdit
        ? '<select data-legacy-member-role>' + availableRoles.map(([value, label]) =>
            '<option value="' + escapeHtml(value) + '"' +
            (member.member_role === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>'
          ).join('') + '</select>'
        : '<span class="tag">' + escapeHtml(roleLabels[member.member_role] || member.member_role) + '</span>';
      const statusControl = canEdit
        ? '<select data-legacy-member-status>' + Object.entries(statusLabels).map(([value, label]) =>
            '<option value="' + escapeHtml(value) + '"' +
            (member.membership_status === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>'
          ).join('') + '</select>'
        : '<span class="tag">' + escapeHtml(statusLabels[member.membership_status] || member.membership_status) + '</span>';
      const displayName = member.full_name || member.username || member.email || 'Mitglied';

      return '<article class="admin-user-card pfms-org-member-card" data-legacy-membership-id="' +
        escapeHtml(member.membership_id) + '">' +
        '<div class="admin-user-info">' +
          '<b>' + escapeHtml(displayName) + '</b>' +
          '<small>' + escapeHtml(member.email || member.user_id) + '</small>' +
          '<small>User-ID: ' + escapeHtml(member.user_id) + '</small>' +
          '<span class="tag">' + escapeHtml(roleLabels[member.member_role] || member.member_role) +
          ' · ' + escapeHtml(statusLabels[member.membership_status] || member.membership_status) + '</span>' +
        '</div>' +
        '<div class="admin-user-controls">' +
          '<label>Rolle' + roleControl + '</label>' +
          '<label>Status' + statusControl + '</label>' +
          (canEdit ? '<button type="button" class="btn btn-secondary" data-save-legacy-membership>Änderungen speichern</button>' : '<small>Leitungsrechte sind hier geschützt.</small>') +
        '</div>' +
        '<p class="admin-message" data-legacy-member-message role="status" aria-live="polite"></p>' +
      '</article>';
    }).join('');
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS legacy organization member directory:', error);
    message.textContent = 'Mitglieder konnten nicht geladen werden. Prüfe Staging-Migration, Organisationsrechte und Datenbankverbindung.';
    if (summary) summary.hidden = true;
    results.innerHTML = '';
  }
}

async function createPfmsLegacyInvitation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById('pfmsLegacyInvitationMessage');
  const resultPanel = document.getElementById('pfmsLegacyInvitationResult');
  const urlInput = document.getElementById('pfmsLegacyInvitationUrl');
  const button = document.getElementById('pfmsLegacyInvitationSubmit');
  const data = Object.fromEntries(new FormData(form).entries());
  const organizationId = String(data.organization_id || '');
  const role = String(data.role || '');
  const expiresInDays = Number(data.expires_in_days);

  if (!organizationId || !['scout','trainer','co_trainer','betreuer','member'].includes(role) ||
      !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
    message.textContent = 'Bitte Organisation, Rolle und Gültigkeit korrekt auswählen.';
    return;
  }

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  if (!requestUserId) {
    message.textContent = 'Deine Sitzung ist nicht verfügbar. Bitte melde dich erneut an.';
    return;
  }

  button.disabled = true;
  resultPanel.hidden = true;
  message.textContent = 'Einmaliger Einladungscode wird sicher erstellt …';
  try {
    const { data: code, error } = await pfssSupabase.rpc('pfms_create_legacy_invitation', {
      p_organization_id: organizationId,
      p_role: role,
      p_expires_in_days: expiresInDays
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error || typeof code !== 'string' || !/^[A-F0-9]{32}$/i.test(code)) {
      throw error || new Error('Invalid invitation response');
    }

    const inviteUrl = new URL(window.location.origin + window.location.pathname);
    inviteUrl.searchParams.set('invite', code);
    urlInput.value = inviteUrl.href;
    resultPanel.hidden = false;
    message.textContent = 'Einladung erstellt. Der Code ist ein Einmalcode und wird nur jetzt angezeigt.';
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS legacy invitation creation failed:', error);
    message.textContent = 'Einladung konnte nicht erstellt werden. Prüfe Organisationsstatus, Leitungsrechte und Datenbankmigration.';
  } finally {
    button.disabled = false;
  }
}

function setupPfmsLegacyInvitationWorkspace() {
  const form = document.getElementById('pfmsLegacyInvitationForm');
  const copyButton = document.getElementById('pfmsLegacyInvitationCopy');
  if (form && !pfmsLegacyInvitationBound) {
    form.addEventListener('submit', createPfmsLegacyInvitation);
    copyButton?.addEventListener('click', async () => {
      const url = document.getElementById('pfmsLegacyInvitationUrl')?.value || '';
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        const message = document.getElementById('pfmsLegacyInvitationMessage');
        if (message) message.textContent = 'Einladungslink wurde in die Zwischenablage kopiert.';
      } catch (error) {
        window.prompt('Einladungslink kopieren:', url);
      }
    });
    pfmsLegacyInvitationBound = true;
  }

  const membersForm = document.getElementById('pfmsLegacyMembersFilterForm');
  const memberSelect = document.getElementById('pfmsLegacyMembersOrganization');
  const refreshButton = document.getElementById('pfmsLegacyMembersRefresh');
  const results = document.getElementById('pfmsLegacyMemberResults');
  if (membersForm && !pfmsLegacyMemberDirectoryBound) {
    membersForm.addEventListener('submit', event => {
      event.preventDefault();
      loadPfmsLegacyOrganizationMembers();
    });
    memberSelect?.addEventListener('change', loadPfmsLegacyOrganizationMembers);
    refreshButton?.addEventListener('click', loadPfmsLegacyOrganizationMembers);
    results?.addEventListener('click', async event => {
      const button = event.target.closest('[data-save-legacy-membership]');
      if (!button) return;
      const card = button.closest('[data-legacy-membership-id]');
      if (!card) return;

      const requestUserId = window.pfssCurrentUserId;
      const requestGeneration = pfmsAuthGeneration;
      const feedback = card.querySelector('[data-legacy-member-message]');
      const role = card.querySelector('[data-legacy-member-role]')?.value;
      const status = card.querySelector('[data-legacy-member-status]')?.value;
      if (!role || !status || !requestUserId) return;

      button.disabled = true;
      feedback.textContent = 'Änderungen werden gespeichert …';
      try {
        const rpcName = window.pfssIsRealAdmin
          ? 'pfms_admin_update_legacy_membership'
          : 'pfms_update_legacy_org_membership_for_manager';
        const args = window.pfssIsRealAdmin
          ? { p_membership_id: card.dataset.legacyMembershipId, p_role: role, p_status: status }
          : { p_membership_id: card.dataset.legacyMembershipId, p_role: role, p_status: status };
        const { error } = await pfssSupabase.rpc(rpcName, args);
        if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
        if (error) throw error;
        feedback.textContent = 'Änderungen gespeichert.';
        await loadPfmsLegacyOrganizationMembers();
      } catch (error) {
        if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
        console.error('PFMS legacy membership update:', error);
        feedback.textContent = 'Änderungen konnten nicht gespeichert werden. Prüfe Rolle, Status und Berechtigung.';
      } finally {
        button.disabled = false;
      }
    });
    pfmsLegacyMemberDirectoryBound = true;
  }
}
function pfmsTeamRoleLabel(role) {
  return ({ trainer: 'Trainer', co_trainer: 'Co-Trainer', betreuer: 'Betreuer' })[role] || role;
}

function renderPfmsLegacyTeamCards() {
  const views = [
    ['pfmsTeamGrid', true],
    ['pfmsMyTeamsGrid', false]
  ];
  views.forEach(([id, managementView]) => {
    const host = document.getElementById(id);
    if (!host) return;
    if (!pfmsLegacyTeams.length) {
      host.innerHTML = '<div class="empty-state"><b>Noch keine Mannschaften vorhanden</b><p>Eine berechtigte Vereinsleitung kann hier die erste Mannschaft für ihren Verein anlegen.</p></div>';
      return;
    }
    host.innerHTML = pfmsLegacyTeams.map((team) => {
      const actions = [];
      actions.push('<button type="button" class="btn btn-secondary" data-pfms-open-team="' + escapeHtml(team.team_id) + '">Mannschaft öffnen</button>');
      if (team.can_manage) {
        actions.push('<button type="button" class="btn btn-secondary" data-pfms-edit-team="' + escapeHtml(team.team_id) + '">Bearbeiten</button>');
        actions.push('<button type="button" class="btn btn-secondary" data-pfms-team-staff="' + escapeHtml(team.team_id) + '">Trainerteam</button>');
      }
      return '<article class="module-card pfms-team-card" data-pfms-team-card="' + escapeHtml(team.team_id) + '">' +
        '<div class="eyebrow">' + escapeHtml(team.organization_name || 'Verein') + '</div>' +
        '<h3>' + escapeHtml(team.team_name) + '</h3>' +
        '<p>' + escapeHtml(team.age_group) + ' · ' + escapeHtml(team.gender) + '</p>' +
        '<div class="pfms-team-meta"><span>' + escapeHtml(team.season) + '</span>' +
        '<span>' + escapeHtml(team.division || 'Keine Liga hinterlegt') + '</span>' +
        '<span>' + Number(team.staff_count || 0) + ' Personen im Trainerteam</span></div>' +
        '<span class="module-status">' + (team.team_status === 'archived' ? 'Archiviert' : 'Aktiv') + '</span>' +
        '<div class="pfms-team-actions">' + actions.join('') + '</div></article>';
    }).join('');
  });

  const addButton = document.getElementById('pfmsAddTeamButton');
  if (addButton) addButton.hidden = !pfmsManageableLegacyOrganizations.length;
}

async function loadPfmsLegacyTeams() {
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  if (!requestUserId) return;
  const messages = ['pfmsTeamsMessage', 'pfmsMyTeamsMessage']
    .map(id => document.getElementById(id)).filter(Boolean);
  messages.forEach(message => message.textContent = 'Mannschaften werden geladen …');

  try {
    const [teamsResult, orgsResult] = await Promise.all([
      pfssSupabase.rpc('pfms_list_my_legacy_teams'),
      pfssSupabase.rpc('pfms_list_my_manageable_legacy_organizations')
    ]);
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (teamsResult.error) throw teamsResult.error;

    pfmsLegacyTeams = teamsResult.data || [];
    pfmsManageableLegacyOrganizations = orgsResult.error ? [] : (orgsResult.data || [])
      .filter(org => org.organization_type === 'club' &&
        ['approved','active'].includes(String(org.organization_status || '').toLowerCase()));

    messages.forEach(message => {
      message.textContent = pfmsLegacyTeams.length
        ? pfmsLegacyTeams.length + ' Mannschaft(en) geladen.'
        : 'Für dieses Konto sind noch keine Mannschaften zugeordnet.';
    });
    renderPfmsLegacyTeamCards();
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team workspace load failed:', error);
    pfmsLegacyTeams = [];
    pfmsManageableLegacyOrganizations = [];
    renderPfmsLegacyTeamCards();
    messages.forEach(message => message.textContent =
      'Mannschaftsverwaltung noch nicht verfügbar. Bitte die Team-Migration in der Testdatenbank anwenden und deine Vereinszuordnung prüfen.');
  }
}

function openPfmsLegacyTeamDialog(team = null) {
  if (!team && !pfmsManageableLegacyOrganizations.length) {
    toast('Du benötigst aktive Leitungsrechte in einem freigegebenen Verein, um Mannschaften anzulegen.');
    return;
  }
  const form = document.getElementById('pfmsTeamForm');
  const dialog = document.getElementById('pfmsTeamDialog');
  if (!form || !dialog) return;
  pfmsEditingLegacyTeamId = team?.team_id || null;
  form.reset();

  const organizationSelect = document.getElementById('pfmsTeamOrganization');
  organizationSelect.innerHTML = pfmsManageableLegacyOrganizations.map(org =>
    '<option value="' + escapeHtml(org.organization_id) + '">' +
      escapeHtml(org.organization_name) + '</option>'
  ).join('');
  if (team) {
    organizationSelect.innerHTML = '<option value="' + escapeHtml(team.organization_id) + '">' +
      escapeHtml(team.organization_name) + '</option>';
    organizationSelect.disabled = true;
    form.elements.team_name.value = team.team_name || '';
    form.elements.age_group.value = team.age_group || 'Senioren';
    form.elements.gender.value = team.gender || 'Gemischt';
    form.elements.season.value = team.season || '';
    form.elements.division.value = team.division || '';
    form.elements.status.value = team.team_status || 'active';
    document.getElementById('pfmsTeamStatusField').hidden = false;
  } else {
    organizationSelect.disabled = false;
    form.elements.season.value = new Date().getFullYear() + '/' + (new Date().getFullYear() + 1);
    form.elements.status.value = 'active';
    document.getElementById('pfmsTeamStatusField').hidden = true;
  }
  document.getElementById('pfmsTeamDialogTitle').textContent =
    team ? 'Mannschaft bearbeiten' : 'Mannschaft anlegen';
  document.getElementById('pfmsTeamSaveButton').textContent =
    team ? 'Änderungen speichern' : 'Mannschaft anlegen';
  document.getElementById('pfmsTeamFormMessage').textContent = '';
  dialog.showModal();
}

async function savePfmsLegacyTeam(event) {
  event.preventDefault();
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const button = document.getElementById('pfmsTeamSaveButton');
  const message = document.getElementById('pfmsTeamFormMessage');
  if (!data.team_name?.trim() || !data.season?.trim()) {
    message.textContent = 'Bitte Mannschaftsname und Saison ausfüllen.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Mannschaft wird gespeichert …';
  try {
    let result;
    if (pfmsEditingLegacyTeamId) {
      result = await pfssSupabase.rpc('pfms_update_legacy_team', {
        p_team_id: pfmsEditingLegacyTeamId,
        p_team_name: data.team_name,
        p_age_group: data.age_group,
        p_gender: data.gender,
        p_season: data.season,
        p_division: data.division || null,
        p_status: data.status || 'active'
      });
    } else {
      result = await pfssSupabase.rpc('pfms_create_legacy_team', {
        p_organization_id: data.organization_id,
        p_team_name: data.team_name,
        p_age_group: data.age_group,
        p_gender: data.gender,
        p_season: data.season,
        p_division: data.division || null
      });
    }
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (result.error) throw result.error;
    document.getElementById('pfmsTeamDialog').close();
    pfmsEditingLegacyTeamId = null;
    await loadPfmsLegacyTeams();
    if (requestGeneration === pfmsAuthGeneration && requestUserId === window.pfssCurrentUserId) toast('Mannschaft wurde gespeichert.');
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team save failed:', error);
    message.textContent = 'Mannschaft konnte nicht gespeichert werden. Prüfe Organisationsrechte und Eingaben.';
  } finally {
    button.disabled = false;
  }
}

function renderPfmsTeamStaffList(teamId, staff, canManage) {
  const host = document.getElementById('pfmsTeamStaffList');
  if (!host) return;
  if (!staff.length) {
    host.innerHTML = '<div class="empty-state">Noch keine Trainer oder Betreuer zugeordnet.</div>';
    return;
  }
  host.innerHTML = staff.map(member =>
    '<article class="admin-user-card" data-team-staff-row="' + escapeHtml(member.assignment_id) + '">' +
      '<div class="admin-user-info"><b>' +
        escapeHtml(member.full_name || member.username || member.email || 'Mitglied') + '</b>' +
        '<small>' + escapeHtml(member.email || member.user_id) + '</small>' +
        '<span class="tag">' + escapeHtml(pfmsTeamRoleLabel(member.team_role)) + ' · ' +
          escapeHtml(member.assignment_status) + '</span></div>' +
      (canManage ? '<div class="pfms-team-staff-actions">' +
        '<button type="button" class="btn btn-secondary" data-pfms-team-permissions="' +
          escapeHtml(member.assignment_id) + '">Bereichsrechte</button>' +
        '<button type="button" class="btn btn-secondary" data-pfms-remove-team-staff="' +
          escapeHtml(member.assignment_id) + '">Zuordnung entfernen</button></div>' : '') +
    '</article>'
  ).join('');
}

async function openPfmsLegacyTeamStaffDialog(teamId) {
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const team = pfmsLegacyTeams.find(item => item.team_id === teamId);
  if (!team || !team.can_manage) return;
  pfmsSelectedLegacyTeam = team;
  const dialog = document.getElementById('pfmsTeamStaffDialog');
  const candidate = document.getElementById('pfmsTeamStaffCandidate');
  const message = document.getElementById('pfmsTeamStaffMessage');
  document.getElementById('pfmsTeamStaffTitle').textContent = 'Trainerteam · ' + team.team_name;
  candidate.innerHTML = '<option value="">Mitglieder werden geladen …</option>';
  message.textContent = 'Aktive Vereinsmitglieder werden geprüft …';
  if (!dialog.open) dialog.showModal();

  try {
    const [candidatesResult, staffResult] = await Promise.all([
      pfssSupabase.rpc('pfms_list_legacy_team_staff_candidates', { p_team_id: teamId }),
      pfssSupabase.rpc('pfms_list_legacy_team_staff', { p_team_id: teamId })
    ]);
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId || pfmsSelectedLegacyTeam?.team_id !== teamId) return;
    if (candidatesResult.error) throw candidatesResult.error;
    if (staffResult.error) throw staffResult.error;

    const assigned = new Set((staffResult.data || []).map(item => item.user_id));
    const candidates = (candidatesResult.data || []).filter(item => !assigned.has(item.user_id));
    candidate.innerHTML = candidates.length
      ? '<option value="">Person auswählen …</option>' + candidates.map(item =>
          '<option value="' + escapeHtml(item.user_id) + '" data-role="' +
            escapeHtml(item.organization_role) + '">' +
            escapeHtml(item.full_name || item.username || item.email || 'Mitglied') +
            ' · ' + escapeHtml(pfmsTeamRoleLabel(item.organization_role)) + '</option>'
        ).join('')
      : '<option value="">Keine weiteren aktiven Trainer oder Betreuer verfügbar</option>';
    message.textContent = candidates.length
      ? candidates.length + ' aktive Person(en) können zugeordnet werden.'
      : 'Bitte lade Trainer, Co-Trainer oder Betreuer zuerst als Vereinsmitglieder ein.';
    pfmsSelectedTeamStaff = staffResult.data || [];
    renderPfmsTeamStaffList(teamId, staffResult.data || [], true);
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team staff load failed:', error);
    message.textContent = 'Trainerteam konnte nicht geladen werden. Prüfe Mitgliedschaften und Datenbankmigration.';
    candidate.innerHTML = '<option value="">Nicht verfügbar</option>';
  }
}

const PFMS_TEAM_PERMISSION_MODULES = {
  squad: 'Spielerkader',
  training: 'Training & Übungen',
  attendance: 'Anwesenheit',
  finance: 'Mannschaftskasse',
  events: 'Fahrten & Veranstaltungen',
  calendar: 'Mannschaftskalender',
  matches: 'Spiele & Aufstellungen',
  analysis: 'Taktik & Analyse'
};

async function openPfmsLegacyTeamPermissions(assignmentId) {
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const team = pfmsSelectedLegacyTeam;
  const assignment = pfmsSelectedTeamStaff.find(item => item.assignment_id === assignmentId);
  if (!team?.can_manage || !assignment) return;
  pfmsSelectedTeamPermissionAssignment = assignment;
  const dialog = document.getElementById('pfmsTeamPermissionsDialog');
  const list = document.getElementById('pfmsTeamPermissionsList');
  const message = document.getElementById('pfmsTeamPermissionsMessage');
  const saveButton = document.getElementById('pfmsTeamPermissionsSave');
  document.getElementById('pfmsTeamPermissionsTitle').textContent =
    'Bereichsrechte · ' + (assignment.full_name || assignment.username || assignment.email || 'Mitglied');
  list.innerHTML = '';
  message.textContent = 'Berechtigungen werden geladen …';
  saveButton.disabled = true;
  if (!dialog.open) dialog.showModal();

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_list_legacy_team_permissions', {
      p_assignment_id: assignmentId
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;
    const permissions = new Map((data || []).map(item => [item.module_key, item]));
    list.innerHTML = Object.entries(PFMS_TEAM_PERMISSION_MODULES).map(([key, label]) => {
      const permission = permissions.get(key) || {};
      const canView = permission.can_view === true;
      const canEdit = permission.can_edit === true;
      return '<div class="pfms-team-permission-row" data-pfms-permission-module="' + key + '">' +
        '<b>' + escapeHtml(label) + '</b>' +
        '<label><input type="checkbox" data-pfms-permission-view' + (canView ? ' checked' : '') + '> Lesen</label>' +
        '<label><input type="checkbox" data-pfms-permission-edit' + (canEdit ? ' checked' : '') + (canView ? '' : ' disabled') + '> Bearbeiten</label>' +
      '</div>';
    }).join('');
    message.textContent = 'Lese- und Bearbeitungsrechte werden getrennt für jeden Bereich gespeichert.';
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team permissions load failed:', error);
    message.textContent = 'Bereichsrechte konnten nicht geladen werden. Bitte die Rechte-Migration anwenden.';
    list.innerHTML = '';
  } finally {
    saveButton.disabled = false;
  }
}

async function savePfmsLegacyTeamPermissions(event) {
  event.preventDefault();
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const assignment = pfmsSelectedTeamPermissionAssignment;
  const list = document.getElementById('pfmsTeamPermissionsList');
  const message = document.getElementById('pfmsTeamPermissionsMessage');
  const button = document.getElementById('pfmsTeamPermissionsSave');
  if (!assignment || !list?.children.length) {
    message.textContent = 'Es sind keine Berechtigungen zum Speichern vorhanden.';
    return;
  }

  const permissions = [...list.querySelectorAll('[data-pfms-permission-module]')].map(row => {
    const canView = row.querySelector('[data-pfms-permission-view]').checked;
    const canEdit = row.querySelector('[data-pfms-permission-edit]').checked;
    return {
      module_key: row.dataset.pfmsPermissionModule,
      can_view: canView || canEdit,
      can_edit: canEdit
    };
  });

  button.disabled = true;
  message.textContent = 'Bereichsrechte werden gespeichert …';
  try {
    const { error } = await pfssSupabase.rpc('pfms_save_legacy_team_permissions', {
      p_assignment_id: assignment.assignment_id,
      p_permissions: permissions
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;
    message.textContent = 'Bereichsrechte wurden gespeichert.';
    toast('Team-Bereichsrechte wurden aktualisiert.');
    dialogClose('pfmsTeamPermissionsDialog');
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team permissions save failed:', error);
    message.textContent = 'Berechtigungen konnten nicht gespeichert werden. Prüfe Trainerrechte und die Datenbankmigration.';
  } finally {
    button.disabled = false;
  }
}

function dialogClose(id) {
  const dialog = document.getElementById(id);
  if (dialog?.open) dialog.close();
}

async function assignPfmsLegacyTeamStaff(event) {
  event.preventDefault();
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const team = pfmsSelectedLegacyTeam;
  const select = document.getElementById('pfmsTeamStaffCandidate');
  const option = select.selectedOptions[0];
  const userId = select.value;
  const role = option?.dataset.role || '';
  const button = document.getElementById('pfmsTeamStaffSaveButton');
  const message = document.getElementById('pfmsTeamStaffMessage');
  if (!team || !userId || !['trainer','co_trainer','betreuer'].includes(role)) {
    message.textContent = 'Bitte wähle ein aktives Vereinsmitglied aus.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Zuordnung wird gespeichert …';
  try {
    const { error } = await pfssSupabase.rpc('pfms_assign_legacy_team_staff', {
      p_team_id: team.team_id,
      p_user_id: userId,
      p_role: role
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;
    message.textContent = 'Trainerteam wurde aktualisiert.';
    await loadPfmsLegacyTeams();
    await openPfmsLegacyTeamStaffDialog(team.team_id);
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS staff assignment failed:', error);
    message.textContent = 'Zuordnung fehlgeschlagen. Die Person muss aktives Vereinsmitglied mit derselben Rolle sein.';
  } finally {
    button.disabled = false;
  }
}

async function removePfmsLegacyTeamStaff(assignmentId) {
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const team = pfmsSelectedLegacyTeam;
  if (!team || !window.confirm('Diese Teamzuordnung wirklich entfernen?')) return;
  try {
    const { error } = await pfssSupabase.rpc('pfms_remove_legacy_team_staff', {
      p_assignment_id: assignmentId
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;
    await loadPfmsLegacyTeams();
    await openPfmsLegacyTeamStaffDialog(team.team_id);
    toast('Teamzuordnung wurde entfernt.');
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team staff removal failed:', error);
    toast('Teamzuordnung konnte nicht entfernt werden. Prüfe deine Berechtigung.');
  }
}

async function loadPfmsGlobalTeamPlayerCandidates(query = '') {
  const team = pfmsSelectedLegacyTeam;
  const select = document.getElementById('pfmsTeamRosterCandidate');
  const message = document.getElementById('pfmsTeamRosterMessage');
  if (!team || !team.can_manage || !select) return;

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  select.innerHTML = '<option value="">Spieler werden gesucht …</option>';
  if (message) message.textContent = 'Globale PFMS-Spielerdatenbank wird durchsucht …';

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_search_global_players_for_team', {
      p_team_id: team.team_id,
      p_query: String(query || '').trim()
    });
    if (requestGeneration !== pfmsAuthGeneration ||
        requestUserId !== window.pfssCurrentUserId ||
        pfmsSelectedLegacyTeam?.team_id !== team.team_id) return;
    if (error) throw error;

    pfmsLegacyTeamRosterCandidates = data || [];
    select.innerHTML = pfmsLegacyTeamRosterCandidates.length
      ? '<option value="">Spieler auswählen …</option>' + pfmsLegacyTeamRosterCandidates.map(player => {
          const fullName = [player.player_name, player.player_surname].filter(Boolean).join(' ');
          const year = player.birth ? String(player.birth).slice(0, 4) : 'Jahrgang –';
          return '<option value="' + escapeHtml(player.player_id) + '">' +
            escapeHtml(fullName) + ' · ' + escapeHtml(player.position || '–') +
            ' · ' + escapeHtml(year) + ' · ' + escapeHtml(player.club || 'Verein –') +
          '</option>';
        }).join('')
      : '<option value="">Keine passenden freien Spieler gefunden</option>';
    if (message) {
      message.textContent = pfmsLegacyTeamRosterCandidates.length
        ? pfmsLegacyTeamRosterCandidates.length + ' Spieler zur Übernahme in den Mannschaftskader gefunden.'
        : 'Keine passenden Spieler gefunden. Prüfe Suchbegriff oder globalen Spielerkatalog.';
    }
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team roster global player search failed:', error);
    select.innerHTML = '<option value="">Suche nicht verfügbar</option>';
    if (message) message.textContent = 'Spielersuche nicht verfügbar. Prüfe Katalogmigration und Mannschaftsrechte.';
  }
}

function renderPfmsLegacyTeamRoster() {
  const host = document.getElementById('pfmsTeamRosterList');
  const count = document.getElementById('pfmsTeamRosterCount');
  const team = pfmsSelectedLegacyTeam;
  if (!host || !team) return;

  const players = pfmsLegacyTeamRoster;
  if (count) count.textContent = players.length + (players.length === 1 ? ' Spieler' : ' Spieler');
  const statuses = {
    active: 'Aktiv',
    injured: 'Verletzt',
    loaned: 'Verliehen',
    inactive: 'Inaktiv'
  };
  const positions = ['Torwart','Abwehr','Mittelfeld','Sturm'];

  if (!players.length) {
    host.innerHTML = '<div class="empty-state"><b>Noch kein Spielerkader vorhanden</b><p>Füge zentrale PFMS-Spielerprofile hinzu. Die globalen Spieler-Stammdaten bleiben dabei unverändert.</p></div>';
    return;
  }

  host.innerHTML = players.map(player => {
    const fullName = [player.player_name, player.player_surname].filter(Boolean).join(' ') || 'Unbekannter Spieler';
    const year = player.birth ? String(player.birth).slice(0, 4) : 'Jahrgang –';
    const currentPosition = player.squad_position || player.preferred_position || '';
    const controls = team.can_manage
      ? '<div class="pfms-roster-edit-controls">' +
          '<label>Nr.<input type="number" min="1" max="99" data-roster-jersey value="' + escapeHtml(player.jersey_number ?? '') + '" placeholder="–"></label>' +
          '<label>Position<select data-roster-position><option value="">Stammposition</option>' +
            positions.map(position => '<option value="' + position + '"' + (player.position_override === position ? ' selected' : '') + '>' + position + '</option>').join('') +
          '</select></label>' +
          '<label>Status<select data-roster-status>' +
            Object.entries(statuses).map(([value,label]) => '<option value="' + value + '"' + (player.squad_status === value ? ' selected' : '') + '>' + label + '</option>').join('') +
          '</select></label>' +
          '<button type="button" class="btn btn-secondary" data-pfms-save-roster-player>Speichern</button>' +
          '<button type="button" class="btn btn-secondary" data-pfms-remove-roster-player>Aus Kader entfernen</button>' +
        '</div>'
      : '<div class="pfms-roster-tags"><span>' + escapeHtml(statuses[player.squad_status] || player.squad_status) + '</span></div>';

    return '<article class="pfms-roster-card" data-pfms-roster-assignment="' + escapeHtml(player.assignment_id) + '">' +
      '<div class="pfms-roster-number">' + escapeHtml(player.jersey_number ?? '–') + '</div>' +
      '<div class="pfms-roster-player-info"><b>' + escapeHtml(fullName) + '</b>' +
        '<small>' + escapeHtml(currentPosition || 'Position –') + ' · ' + escapeHtml(year) +
        ' · ' + escapeHtml(player.foot || 'Fuß –') + '</small>' +
        '<small>' + escapeHtml(player.club || 'Verein nicht angegeben') +
        (player.height ? ' · ' + escapeHtml(player.height) + ' cm' : '') + '</small>' +
      '</div>' +
      controls +
    '</article>';
  }).join('');
}

async function loadPfmsLegacyTeamRoster(teamId = pfmsSelectedLegacyTeam?.team_id) {
  const team = pfmsLegacyTeams.find(item => item.team_id === teamId);
  const host = document.getElementById('pfmsTeamRosterList');
  const form = document.getElementById('pfmsTeamRosterForm');
  const searchForm = document.getElementById('pfmsTeamRosterSearchForm');
  const message = document.getElementById('pfmsTeamRosterMessage');
  if (!team || !host || !form || !searchForm || !message) return;

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  if (!requestUserId) return;
  form.hidden = !team.can_manage;
  searchForm.hidden = !team.can_manage;
  message.textContent = 'Spielerkader wird geladen …';
  host.innerHTML = '';

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_list_legacy_team_players', {
      p_team_id: teamId
    });
    if (requestGeneration !== pfmsAuthGeneration ||
        requestUserId !== window.pfssCurrentUserId ||
        pfmsSelectedLegacyTeam?.team_id !== teamId) return;
    if (error) throw error;

    pfmsLegacyTeamRoster = data || [];
    renderPfmsLegacyTeamRoster();
    message.textContent = pfmsLegacyTeamRoster.length
      ? pfmsLegacyTeamRoster.length + ' Spieler im Mannschaftskader.'
      : 'Noch keine Spieler dieser Mannschaft zugeordnet.';

    if (team.can_manage) {
      await loadPfmsGlobalTeamPlayerCandidates();
    }
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team roster load failed:', error);
    pfmsLegacyTeamRoster = [];
    renderPfmsLegacyTeamRoster();
    message.textContent = 'Spielerkader konnte nicht geladen werden. Bitte Team-Kadermigration und Berechtigungen prüfen.';
  }
}

async function addPfmsLegacyTeamPlayer(event) {
  event.preventDefault();
  const team = pfmsSelectedLegacyTeam;
  const form = event.currentTarget;
  const message = document.getElementById('pfmsTeamRosterMessage');
  if (!team?.can_manage) {
    message.textContent = 'Für diese Mannschaft fehlen dir die Verwaltungsrechte.';
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const playerId = String(data.player_id || '');
  const jerseyNumber = data.jersey_number === '' ? null : Number(data.jersey_number);
  const position = data.position_override || null;
  if (!playerId || (jerseyNumber !== null &&
      (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99))) {
    message.textContent = 'Bitte wähle einen Spieler und eine gültige Trikotnummer von 1 bis 99.';
    return;
  }

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const button = document.getElementById('pfmsTeamRosterAddButton');
  button.disabled = true;
  message.textContent = 'Spieler wird dem Kader zugeordnet …';
  try {
    const { error } = await pfssSupabase.rpc('pfms_add_legacy_team_player', {
      p_team_id: team.team_id,
      p_player_id: playerId,
      p_jersey_number: jerseyNumber,
      p_position_override: position,
      p_squad_status: 'active',
      p_notes: null
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;

    form.reset();
    await loadPfmsLegacyTeamRoster(team.team_id);
    if (requestGeneration === pfmsAuthGeneration && requestUserId === window.pfssCurrentUserId) {
      toast('Spieler wurde dem Mannschaftskader zugeordnet.');
    }
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team roster add failed:', error);
    message.textContent = 'Spieler konnte nicht hinzugefügt werden. Prüfe, ob er bereits im Kader steht oder die Trikotnummer vergeben ist.';
  } finally {
    button.disabled = false;
  }
}

async function updatePfmsLegacyTeamPlayer(button) {
  const card = button.closest('[data-pfms-roster-assignment]');
  const team = pfmsSelectedLegacyTeam;
  const message = document.getElementById('pfmsTeamRosterMessage');
  if (!card || !team?.can_manage) return;

  const jerseyValue = card.querySelector('[data-roster-jersey]')?.value ?? '';
  const jerseyNumber = jerseyValue === '' ? null : Number(jerseyValue);
  if (jerseyNumber !== null && (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99)) {
    message.textContent = 'Die Trikotnummer muss zwischen 1 und 99 liegen.';
    return;
  }

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  button.disabled = true;
  try {
    const { error } = await pfssSupabase.rpc('pfms_update_legacy_team_player', {
      p_assignment_id: card.dataset.pfmsRosterAssignment,
      p_jersey_number: jerseyNumber,
      p_position_override: card.querySelector('[data-roster-position]')?.value || null,
      p_squad_status: card.querySelector('[data-roster-status]')?.value || 'active',
      p_notes: null
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;
    message.textContent = 'Kaderzuordnung wurde aktualisiert.';
    await loadPfmsLegacyTeamRoster(team.team_id);
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team roster update failed:', error);
    message.textContent = 'Änderung konnte nicht gespeichert werden. Prüfe Trikotnummer und Kaderrechte.';
  } finally {
    button.disabled = false;
  }
}

async function removePfmsLegacyTeamPlayer(button) {
  const card = button.closest('[data-pfms-roster-assignment]');
  const team = pfmsSelectedLegacyTeam;
  if (!card || !team?.can_manage) return;
  const label = card.querySelector('.pfms-roster-player-info b')?.textContent || 'diesen Spieler';
  if (!window.confirm(label + ' aus dem Mannschaftskader entfernen? Das globale PFMS-Spielerprofil bleibt erhalten.')) return;

  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  button.disabled = true;
  try {
    const { error } = await pfssSupabase.rpc('pfms_remove_legacy_team_player', {
      p_assignment_id: card.dataset.pfmsRosterAssignment
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    if (error) throw error;
    await loadPfmsLegacyTeamRoster(team.team_id);
    if (requestGeneration === pfmsAuthGeneration && requestUserId === window.pfssCurrentUserId) {
      toast('Spieler wurde aus dem Mannschaftskader entfernt.');
    }
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS team roster remove failed:', error);
    toast('Spieler konnte nicht aus dem Kader entfernt werden.');
  } finally {
    button.disabled = false;
  }
}

async function openPfmsLegacyTeamWorkspace(teamId) {
  const requestUserId = window.pfssCurrentUserId;
  const requestGeneration = pfmsAuthGeneration;
  const team = pfmsLegacyTeams.find(item => item.team_id === teamId);
  if (!team) return;
  pfmsSelectedLegacyTeam = team;
  const panel = document.getElementById('pfmsSelectedTeamPanel');
  const title = document.getElementById('pfmsSelectedTeamTitle');
  const meta = document.getElementById('pfmsSelectedTeamMeta');
  const staffHost = document.getElementById('pfmsSelectedTeamStaff');
  const modules = document.getElementById('pfmsTeamModules');
  panel.hidden = false;
  modules.hidden = false;
  title.textContent = team.team_name;
  meta.textContent = team.organization_name + ' · ' + team.age_group + ' · ' + team.season;
  staffHost.innerHTML = '<p class="admin-message">Trainerteam wird geladen …</p>';

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_list_legacy_team_staff', {
      p_team_id: teamId
    });
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId || pfmsSelectedLegacyTeam?.team_id !== teamId) return;
    if (error) throw error;
    staffHost.innerHTML = '<h3>Trainer & Betreuer</h3>' +
      (data?.length ? data.map(member =>
        '<article class="admin-user-card"><div class="admin-user-info"><b>' +
        escapeHtml(member.full_name || member.username || member.email || 'Mitglied') +
        '</b><small>' + escapeHtml(pfmsTeamRoleLabel(member.team_role)) + '</small></div></article>'
      ).join('') : '<p class="admin-message">Noch kein Trainerteam zugeordnet.</p>');
    if (team.can_manage) {
      staffHost.innerHTML += '<button type="button" class="btn btn-primary" data-pfms-team-staff="' +
        escapeHtml(team.team_id) + '">Trainerteam verwalten</button>';
    }
  } catch (error) {
    if (requestGeneration !== pfmsAuthGeneration || requestUserId !== window.pfssCurrentUserId) return;
    console.error('PFMS selected team staff load failed:', error);
    staffHost.textContent = 'Trainerteam konnte nicht geladen werden.';
  }

  await loadPfmsLegacyTeamRoster(teamId);
}

function setupPfmsLegacyTeamWorkspace() {
  if (pfmsLegacyTeamsBound) return;
  const teamForm = document.getElementById('pfmsTeamForm');
  const staffForm = document.getElementById('pfmsTeamStaffForm');
  if (!teamForm || !staffForm) return;

  document.getElementById('pfmsAddTeamButton')?.addEventListener('click', () =>
    openPfmsLegacyTeamDialog());
  teamForm.addEventListener('submit', savePfmsLegacyTeam);
  staffForm.addEventListener('submit', assignPfmsLegacyTeamStaff);
  document.getElementById('pfmsTeamRosterForm')?.addEventListener('submit', addPfmsLegacyTeamPlayer);
  document.getElementById('pfmsTeamRosterSearchForm')?.addEventListener('submit', event => {
    event.preventDefault();
    loadPfmsGlobalTeamPlayerCandidates(document.getElementById('pfmsTeamRosterSearch')?.value || '');
  });
  document.getElementById('pfmsTeamPermissionsForm')?.addEventListener('submit', savePfmsLegacyTeamPermissions);
  document.getElementById('pfmsTeamPermissionsList')?.addEventListener('change', event => {
    const row = event.target.closest('[data-pfms-permission-module]');
    if (!row) return;
    const view = row.querySelector('[data-pfms-permission-view]');
    const edit = row.querySelector('[data-pfms-permission-edit]');
    if (event.target === view) {
      if (!view.checked) edit.checked = false;
      edit.disabled = !view.checked;
    } else if (event.target === edit && edit.checked) {
      view.checked = true;
      edit.disabled = false;
    }
  });
  document.getElementById('pfmsCloseSelectedTeam')?.addEventListener('click', () => {
    document.getElementById('pfmsSelectedTeamPanel').hidden = true;
    document.getElementById('pfmsTeamModules').hidden = true;
    pfmsSelectedLegacyTeam = null;
  });

  document.addEventListener('click', event => {
    const openButton = event.target.closest('[data-pfms-open-team]');
    if (openButton) {
      if (openButton.closest('#view-teams')) showView('team-workspace');
      openPfmsLegacyTeamWorkspace(openButton.dataset.pfmsOpenTeam);
      return;
    }
    const editButton = event.target.closest('[data-pfms-edit-team]');
    if (editButton) {
      const team = pfmsLegacyTeams.find(item => item.team_id === editButton.dataset.pfmsEditTeam);
      if (team) openPfmsLegacyTeamDialog(team);
      return;
    }
    const staffButton = event.target.closest('[data-pfms-team-staff]');
    if (staffButton) {
      openPfmsLegacyTeamStaffDialog(staffButton.dataset.pfmsTeamStaff);
      return;
    }
    const permissionButton = event.target.closest('[data-pfms-team-permissions]');
    if (permissionButton) {
      openPfmsLegacyTeamPermissions(permissionButton.dataset.pfmsTeamPermissions);
      return;
    }
    const removeButton = event.target.closest('[data-pfms-remove-team-staff]');
    if (removeButton) removePfmsLegacyTeamStaff(removeButton.dataset.pfmsRemoveTeamStaff);
    const saveRosterButton = event.target.closest('[data-pfms-save-roster-player]');
    if (saveRosterButton) {
      updatePfmsLegacyTeamPlayer(saveRosterButton);
      return;
    }
    const removeRosterButton = event.target.closest('[data-pfms-remove-roster-player]');
    if (removeRosterButton) {
      removePfmsLegacyTeamPlayer(removeRosterButton);
      return;
    }
    const showRosterButton = event.target.closest('[data-pfms-show-roster]');
    if (showRosterButton) {
      document.getElementById('pfmsTeamRosterPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  pfmsLegacyTeamsBound = true;
  void loadPfmsLegacyTeams();
}

async function loadPfmsAdminMembers() {
  const message = document.getElementById('pfmsAdminMembersMessage');
  const results = document.getElementById('pfmsAdminMembersResults');
  if (!message || !results) return;
  if (!window.pfssIsRealAdmin) {
    message.textContent = 'Kein Administratorzugang.';
    results.innerHTML = '';
    return;
  }

  const query = document.getElementById('pfmsAdminMembersQuery')?.value.trim() || '';
  const organizationType = document.getElementById('pfmsAdminMembersOrgType')?.value || null;
  const role = document.getElementById('pfmsAdminMembersRole')?.value || null;
  const status = document.getElementById('pfmsAdminMembersStatus')?.value || null;

  message.textContent = 'Mitgliedschaften werden geladen …';
  results.innerHTML = '';

  try {
    const { data, error } = await pfssSupabase.rpc('pfms_admin_list_legacy_members', {
      p_query: query,
      p_status: status,
      p_role: role,
      p_organization_type: organizationType
    });
    if (error) throw error;

    const members = data || [];
    message.textContent = members.length
      ? members.length + ' Mitgliedschaft(en) gefunden.'
      : 'Keine passenden Mitgliedschaften gefunden.';

    if (!members.length) {
      results.innerHTML = '<div class="empty-state"><b>Keine Einträge gefunden</b><p>Ändere die Suchkriterien oder setze die Filter zurück.</p></div>';
      return;
    }

    results.innerHTML = members.map((member) => {
      const roleOptions = Object.entries(PFMS_ADMIN_MEMBER_ROLES).map(([value, label]) =>
        '<option value="' + escapeHtml(value) + '"' +
        (member.member_role === value ? ' selected' : '') + '>' +
        escapeHtml(label) + '</option>'
      ).join('');
      const statusOptions = Object.entries(PFMS_MEMBERSHIP_STATUSES).map(([value, label]) =>
        '<option value="' + escapeHtml(value) + '"' +
        (member.membership_status === value ? ' selected' : '') + '>' +
        escapeHtml(label) + '</option>'
      ).join('');
      const memberName = member.full_name || member.username || member.email || 'Mitglied';
      const orgType = member.organization_type === 'agency' ? 'Agentur' :
        member.organization_type === 'scout_workspace' ? 'Scout-Arbeitsbereich' : 'Verein';

      return '<article class="admin-user-card pfms-global-member-card" data-membership-id="' +
        escapeHtml(member.membership_id) + '">' +
        '<div class="admin-user-info">' +
          '<b>' + escapeHtml(memberName) + '</b>' +
          '<small>' + escapeHtml(member.email || member.user_id) + '</small>' +
          '<small>' + escapeHtml(orgType + ': ' + (member.organization_name || 'Unbekannt')) + '</small>' +
          '<small>User-ID: ' + escapeHtml(member.user_id) + '</small>' +
        '</div>' +
        '<div class="admin-user-controls">' +
          '<label>Rolle<select data-member-role>' + roleOptions + '</select></label>' +
          '<label>Status<select data-member-status>' + statusOptions + '</select></label>' +
        '</div>' +
        '<button type="button" class="btn btn-secondary" data-save-global-membership>Änderungen speichern</button>' +
        '<p class="admin-message" data-global-member-message role="status" aria-live="polite"></p>' +
      '</article>';
    }).join('');
  } catch (error) {
    console.error('PFMS admin member directory:', error);
    message.textContent = 'Mitglieder konnten nicht geladen werden. Bitte Datenbankmigration und Administratorrechte prüfen.';
    results.innerHTML = '';
  }
}

const PFMS_SYSTEM_EVENT_STATUSES = {
  open: 'Offen',
  in_review: 'In Prüfung',
  resolved: 'Erledigt'
};

function formatPfmsSystemEventDate(value) {
  if (!value) return '–';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : date.toLocaleString('de-DE');
}

async function loadPfmsAdminErrors() {
  const message = document.getElementById('pfmsAdminErrorsMessage');
  const results = document.getElementById('pfmsAdminErrorsResults');
  if (!message || !results) return;
  if (!window.pfssIsRealAdmin) {
    message.textContent = 'Kein Administratorzugang.';
    results.innerHTML = '';
    return;
  }

  const query = pfssNormalizeSearch(document.getElementById('pfmsAdminErrorsQuery')?.value);
  const severity = document.getElementById('pfmsAdminErrorsSeverity')?.value || '';
  const status = document.getElementById('pfmsAdminErrorsStatus')?.value || '';

  message.textContent = 'Systemereignisse werden geladen …';
  results.innerHTML = '';

  try {
    const { data, error } = await pfssSupabase
      .from('pfms_system_events')
      .select('id,actor_id,severity,message,route,details,status,created_at,resolved_at,resolved_by')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const events = (data || []).filter((item) =>
      (!severity || item.severity === severity) &&
      (!status || item.status === status) &&
      (!query || pfssNormalizeSearch(item.message).includes(query) ||
        pfssNormalizeSearch(item.route).includes(query))
    );

    message.textContent = events.length
      ? events.length + ' Ereignis(se) angezeigt (maximal 200 neueste Einträge).'
      : 'Keine passenden Systemereignisse gefunden.';

    if (!events.length) {
      results.innerHTML = '<div class="empty-state"><b>Keine Fehler gefunden</b><p>Es gibt derzeit keine passenden protokollierten Frontend-Fehler.</p></div>';
      return;
    }

    results.innerHTML = events.map((item) => {
      const details = item.details && typeof item.details === 'object' ? item.details : {};
      const detailText = [
        details.source ? 'Quelle: ' + details.source : '',
        details.line ? 'Zeile: ' + details.line : '',
        details.column ? 'Spalte: ' + details.column : ''
      ].filter(Boolean).join('\\n');
      const statusOptions = Object.entries(PFMS_SYSTEM_EVENT_STATUSES).map(([value, label]) =>
        '<option value="' + escapeHtml(value) + '"' +
        (item.status === value ? ' selected' : '') + '>' +
        escapeHtml(label) + '</option>'
      ).join('');

      return '<article class="admin-user-card pfms-system-event-card" data-event-id="' +
        escapeHtml(item.id) + '">' +
        '<div class="admin-user-info">' +
          '<b>' + escapeHtml(item.message) + '</b>' +
          '<span class="tag">' + escapeHtml(item.severity) + ' · ' + escapeHtml(PFMS_SYSTEM_EVENT_STATUSES[item.status] || item.status) + '</span>' +
          '<small>' + escapeHtml(formatPfmsSystemEventDate(item.created_at)) + ' · ' + escapeHtml(item.route || '/') + '</small>' +
          '<small>Benutzer-ID: ' + escapeHtml(item.actor_id || 'nicht verfügbar') + '</small>' +
          (detailText ? '<details class="pfms-system-event-details"><summary>Technische Details</summary><pre>' + escapeHtml(detailText) + '</pre></details>' : '') +
        '</div>' +
        '<div class="admin-user-controls"><label>Bearbeitungsstatus<select data-event-status>' + statusOptions + '</select></label>' +
        '<button type="button" class="btn btn-secondary" data-save-event-status>Status speichern</button></div>' +
        '<p class="admin-message" data-event-message role="status" aria-live="polite"></p>' +
      '</article>';
    }).join('');
  } catch (error) {
    console.error('PFMS system event directory:', error);
    message.textContent = 'Fehlerprotokoll konnte nicht geladen werden. Bitte Staging-Migration und Administratorrechte prüfen.';
    results.innerHTML = '';
  }
}

function setupPfmsAdminErrors() {
  if (!window.pfssIsRealAdmin) return;
  const form = document.getElementById('pfmsAdminErrorsFilterForm');
  const results = document.getElementById('pfmsAdminErrorsResults');
  if (!form || !results) return;

  if (!form.dataset.pfmsBound) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadPfmsAdminErrors();
    });
    form.addEventListener('reset', () => window.setTimeout(loadPfmsAdminErrors, 0));
    form.dataset.pfmsBound = 'true';
  }

  if (!results.dataset.pfmsBound) {
    results.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-save-event-status]');
      if (!button) return;
      const card = button.closest('[data-event-id]');
      if (!card) return;

      const status = card.querySelector('[data-event-status]').value;
      const message = card.querySelector('[data-event-message]');
      button.disabled = true;
      message.textContent = 'Status wird gespeichert …';
      try {
        const { error } = await pfssSupabase
          .from('pfms_system_events')
          .update({ status })
          .eq('id', card.dataset.eventId);
        if (error) throw error;
        message.textContent = 'Status gespeichert.';
        await loadPfmsAdminErrors();
      } catch (error) {
        console.error('PFMS system event status update:', error);
        message.textContent = 'Status konnte nicht gespeichert werden: ' + (error?.message || 'Berechtigung oder Datenbank prüfen.');
        button.disabled = false;
      }
    });
    results.dataset.pfmsBound = 'true';
  }

  loadPfmsAdminErrors();
}

function setupPfmsAdminMembers() {
  if (!window.pfssIsRealAdmin) return;
  const form = document.getElementById('pfmsAdminMembersFilterForm');
  const results = document.getElementById('pfmsAdminMembersResults');
  if (!form || !results) return;

  if (!form.dataset.pfmsBound) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadPfmsAdminMembers();
    });
    form.addEventListener('reset', () => window.setTimeout(loadPfmsAdminMembers, 0));
    form.dataset.pfmsBound = 'true';
  }

  if (!results.dataset.pfmsBound) {
    results.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-save-global-membership]');
      if (!button) return;
      const card = button.closest('[data-membership-id]');
      if (!card) return;

      const message = card.querySelector('[data-global-member-message]');
      button.disabled = true;
      message.textContent = 'Änderungen werden gespeichert …';
      try {
        const { error } = await pfssSupabase.rpc('pfms_admin_update_legacy_membership', {
          p_membership_id: card.dataset.membershipId,
          p_role: card.querySelector('[data-member-role]').value,
          p_status: card.querySelector('[data-member-status]').value
        });
        if (error) throw error;
        message.textContent = 'Änderungen gespeichert.';
        await loadPfmsAdminMembers();
      } catch (error) {
        console.error('PFMS global membership update:', error);
        message.textContent = 'Speichern fehlgeschlagen: ' + (error?.message || 'Berechtigung oder Eingaben prüfen.');
        button.disabled = false;
      }
    });
    results.dataset.pfmsBound = 'true';
  }

  loadPfmsAdminMembers();
}

async function checkPfssAccess(user) {
  const { data: profile, error } = await pfssSupabase
    .from('profiles')
    .select('status, role, username')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    showPendingScreen('pending', user);
    document.getElementById('pendingText').textContent =
      'Dein Profil konnte noch nicht geprüft werden. Bitte versuche es später erneut.';
    return;
  }

  if (profile.status !== 'approved') {
    showPendingScreen(profile.status, user);
    return;
  }

  await showAuthenticatedApp(user, profile);
}

function resetPfmsAuthenticatedState() {
  pfmsAuthGeneration += 1;
  pfmsMainDataLoading = false;
  pfmsMainDataReady = false;
  pfmsMainDataError = '';
  players = [];
  reports = [];
  mediaItems = [];
  pfmsMainMediaLoading = false;
  pfmsMainMediaLoadedAt = 0;
  pfmsMainMediaOwnerId = '';
  pfmsMainMediaRequestId += 1;
  editingGlobalPlayerId = null;
  editingMainReportId = null;
  pfmsLegacyTeams = [];
  pfmsManageableLegacyOrganizations = [];
  pfmsSelectedLegacyTeam = null;
  pfmsSelectedTeamStaff = [];
  pfmsSelectedTeamPermissionAssignment = null;
  pfmsLegacyTeamRoster = [];
  pfmsLegacyTeamRosterCandidates = [];
  const rosterList = document.getElementById('pfmsTeamRosterList');
  if (rosterList) rosterList.innerHTML = '';
  const rosterCount = document.getElementById('pfmsTeamRosterCount');
  if (rosterCount) rosterCount.textContent = '0 Spieler';
  document.getElementById('pfmsTeamDialog')?.close();
  document.getElementById('pfmsTeamStaffDialog')?.close();
  document.getElementById('pfmsTeamPermissionsDialog')?.close();
  document.getElementById('pfmsSelectedTeamPanel')?.setAttribute('hidden', '');
  document.getElementById('pfmsTeamModules')?.setAttribute('hidden', '');
  renderPfmsLegacyTeamCards();
  window.pfssCurrentUserId = null;
  window.pfssCurrentRole = '';
  window.pfssIsRealAdmin = false;
  window.pfmsResetScoutWorkspace?.();
  updateMainDataStatus();
  renderDashboard();
  renderPlayers();
  renderReports();
  renderPfmsMainMedia();
}

async function pfssLogout() {
  try {
    if (window.pfssCurrentUserId) sessionStorage.removeItem('pfms_welcome_session_' + window.pfssCurrentUserId);
  } catch (storageError) {}
  resetPfmsAuthenticatedState();
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
  scout: 'Der Einzelscout kann globale Spielerdaten suchen und lesen. Er darf ausschließlich eigene Spielerprofile und eigene Scouting-Berichte erstellen oder bearbeiten.',
  owner_bootstrap: 'Die erstmalige Plattforminhaberschaft wird nur einmal vergeben. Nach der E-Mail-Bestätigung ist ein separater, geheimer Einmalcode erforderlich.'
};

function chooseRegistrationType(type) {
  selectedRegistrationChoice = type;
  const priceGroup = document.querySelector('[data-pricing="' + type + '"]');
  selectedBillingCycle = priceGroup?.dataset.selectedPlan || 'monthly';
  registrationType.value = type;
  registrationChoice.hidden = true;
  registrationFields.hidden = false;
  document.getElementById('selectedRegistrationLabel').textContent =
    'Ausgewählter Zugang: ' + ({user:'Mitglied',club:'Verein',agency:'Agentur',scout:'Einzelscout',owner_bootstrap:'PFMS-Plattforminhaber'}[type] || type);
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
      document.getElementById('signupButton').textContent =
        type === 'owner_bootstrap' ? 'Erstzugang registrieren' : 'Kostenlos registrieren';
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
  document.getElementById('authIntro').textContent = type === 'owner_bootstrap'
    ? 'Lege das erste Inhaberkonto an. Nach der E-Mail-Bestätigung wird der Zugang mit einem separaten Einmalcode aktiviert.'
    : 'Ergänze deine Angaben, um die Registrierung abzuschließen.';
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
      message.textContent = type === 'owner_bootstrap'
        ? 'Inhaberregistrierung vorgemerkt. Bitte bestätige deine E-Mail-Adresse und melde dich anschließend an. Die einmalige Inhaberschaft aktivierst du danach mit dem separaten Einmalcode.'
        : 'Registrierung vorgemerkt. Bitte bestätige deine E-Mail-Adresse. Die Organisationsanlage bzw. Einladung wird erst nach Aktivierung der serverseitigen Prüf- und Datenbankfunktionen abgeschlossen.';
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

document.getElementById('ownerBootstrapForm')
  ?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const tokenInput = document.getElementById('ownerBootstrapToken');
    const message = document.getElementById('ownerBootstrapMessage');
    const button = document.getElementById('ownerBootstrapButton');
    const token = tokenInput.value.trim();

    if (token.length < 40) {
      message.textContent = 'Der Einmalcode ist ungültig oder unvollständig.';
      tokenInput.focus();
      return;
    }

    button.disabled = true;
    message.textContent = 'Die erstmalige Inhaberschaft wird sicher eingerichtet …';
    try {
      const { data, error } = await pfssSupabase.functions.invoke('pfms-owner-bootstrap', {
        body: { bootstrap_token: token }
      });
      if (error || !data?.ok) throw error || new Error('Owner claim rejected');

      tokenInput.value = '';
      message.textContent = 'Plattforminhaberschaft bestätigt. PFMS wird geöffnet …';
      const { data: userData, error: userError } = await pfssSupabase.auth.getUser();
      if (userError || !userData.user) throw userError || new Error('Session unavailable');
      await checkPfssAccess(userData.user);
    } catch (error) {
      console.error('PFMS owner bootstrap failed:', error);
      message.textContent = 'Die Inhaberschaft konnte nicht aktiviert werden. Bitte Einmalcode und Serverkonfiguration prüfen.';
    } finally {
      button.disabled = false;
    }
  });

// Bestehende Sitzung beim Laden wiederherstellen
async function initializePfssAuth() {
  const { data, error } =
    await pfssSupabase.auth.getSession();

  if (error) {
    showAuthScreen();
    document.getElementById('authMessage').textContent =
      'Sitzung konnte nicht geladen werden. Bitte lade die Seite erneut.';
    return;
  }

  if (data.session?.user) {
    // Vorhandene Sitzung wiederverwenden – kein erneuter Login beim Reload.
    await checkPfssAccess(data.session.user);
    return;
  }

  // Nur ohne gespeicherte Sitzung den Login anzeigen.
  showAuthScreen();
}

initializePfssAuth();

// Bei Abmeldung Oberfläche schließen
pfssSupabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    resetPfmsAuthenticatedState();
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

