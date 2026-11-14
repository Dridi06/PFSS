/* PFMS Scout Workspace – private Supabase-Daten und Medien */
(() => {
  'use strict';

  const TABLES = {
    players: 'pfss_scout_players',
    reports: 'pfss_scout_reports',
    media: 'pfss_scout_media'
  };
  const BUCKET = 'pfss-scout-private';
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const ALLOWED_MEDIA_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]);
  const sections = ['overview', 'global-search', 'database', 'reports', 'photos', 'videos'];
  const labels = {
    overview: 'Übersicht',
    'global-search': 'Globale Spielersuche',
    database: 'Meine Spielerdatenbank',
    reports: 'Scoutingberichte',
    photos: 'Fotos',
    videos: 'Videos'
  };

  const state = {
    active: 'overview',
    initialized: false,
    loading: false,
    hasLoaded: false,
    generation: 0,
    players: [],
    globalPlayers: [],
    globalPlayersAvailable: false,
    reports: [],
    media: [],
    editingPlayerId: null,
    editingReportId: null
  };

  const el = (id) => document.getElementById(id);
  const isCurrentRequest = (generation, userId) =>
    generation === state.generation && userId === window.pfssCurrentUserId;
  const supabase = () => {
    if (typeof pfssSupabase === 'undefined') {
      throw new Error('Die Supabase-Verbindung ist nicht verfügbar.');
    }
    return pfssSupabase;
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const makeId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  const showMessage = (message, isError = false) => {
    const host = el('scoutWorkspaceMessage');
    if (!host) return;
    host.textContent = message;
    host.classList.toggle('is-error', isError);
    host.hidden = !message;
  };
  const notify = (message) => {
    if (typeof window.toast === 'function') window.toast(message);
    else showMessage(message);
  };
  const formatDate = (value) => {
    if (!value) return '–';
    const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? '–' : date.toLocaleDateString('de-DE');
  };
  const fullName = (player) => [player?.name, player?.surname]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ') || 'Unbekannter Spieler';
  const normalized = (value) => String(value ?? '').trim().toLocaleLowerCase('de-DE');

  function addNav() {
    const nav = document.querySelector('.nav-list');
    if (!nav || el('scoutWorkspaceNav')) return;
    const group = document.createElement('div');
    group.id = 'scoutWorkspaceNav';
    group.className = 'scout-workspace-nav';
    group.hidden = true;
    group.innerHTML =
      '<div class="nav-section-label">SCOUT WORKSPACE</div>' +
      sections.map((key) =>
        '<button type="button" class="nav-item scout-private-nav" data-scout-section="' + key + '">' +
          '<span class="nav-icon">' + ({ overview: '⌂', 'global-search': '⌕', database: '▦', reports: '▤', photos: '▧', videos: '▷' })[key] + '</span>' +
          '<span class="nav-label">' + labels[key] + '</span>' +
        '</button>'
      ).join('');
    nav.appendChild(group);
  }

  function addView() {
    const main = document.querySelector('.main-area');
    if (!main || el('view-scout-workspace')) return;

    const view = document.createElement('section');
    view.id = 'view-scout-workspace';
    view.className = 'view scout-shell';
    view.innerHTML = [
      '<div class="scout-topline"><span class="scout-live-dot"></span> PERSÖNLICHER SCOUT-BEREICH <span class="scout-preview-tag">PRIVATER ARBEITSBEREICH</span><button type="button" class="scout-refresh-button" data-scout-action="refresh">↻ Aktualisieren</button></div>',
      '<header class="scout-hero"><div><p class="scout-kicker">PERFORMANCE · TALENT · ANALYSE</p><h1 id="scoutHeading">Dein Scouting. Dein Überblick.</h1><p class="scout-lead">Deine Spielerprofile, Beobachtungen und Medien – persönlich und sicher gespeichert.</p></div><div class="scout-hero-mark">PF<span>MS</span><small>FOOTBALL MANAGEMENT</small></div></header>',
      '<div class="scout-private-note">🔒 Private Daten: Spieler, Berichte und Medien sind deinem Benutzerkonto zugeordnet.</div>',
      '<div class="scout-section-tabs" id="scoutSectionTabs">' +
        sections.map((key) => '<button type="button" data-scout-section="' + key + '">' + labels[key] + '</button>').join('') +
      '</div>',
      '<div id="scoutWorkspaceMessage" class="scout-workspace-message" role="status" aria-live="polite" hidden></div>',

      '<div class="scout-workspace-view active" id="scout-section-overview">',
        '<div class="scout-kpi-grid">',
          '<article class="scout-kpi"><span>SPIELER IM FOKUS</span><strong id="scoutKpiPlayers">–</strong><small>Deine privaten Profile</small><i>♙</i></article>',
          '<article class="scout-kpi"><span>SCOUTINGBERICHTE</span><strong id="scoutKpiReports">–</strong><small>Gespeicherte Beobachtungen</small><i>▤</i></article>',
          '<article class="scout-kpi"><span>Ø BEWERTUNG</span><strong id="scoutKpiRating">–</strong><small>Aus deinen Bewertungen</small><i>✦</i></article>',
          '<article class="scout-kpi"><span>MEDIEN</span><strong id="scoutKpiMedia">–</strong><small>Private Foto- und Videodateien</small><i>▧</i></article>',
        '</div>',
        '<div class="scout-overview-grid">',
          '<section class="scout-panel scout-focus-panel"><div class="scout-panel-head"><div><span class="scout-kicker">DEIN FOKUS</span><h2>Zuletzt bearbeitete Spieler</h2></div><button type="button" class="scout-text-action" data-scout-section="database">Alle Spieler →</button></div><div id="scoutOverviewPlayers"></div></section>',
          '<section class="scout-panel"><div class="scout-panel-head"><div><span class="scout-kicker">LETZTE AKTIVITÄTEN</span><h2>Deine Berichte</h2></div><button type="button" class="scout-text-action" data-scout-section="reports">Alle Berichte →</button></div><div id="scoutOverviewReports"></div></section>',
        '</div>',
        '<section class="scout-panel scout-quick-panel"><div><span class="scout-kicker">DIREKT LOSLEGEN</span><h2>Was möchtest du erledigen?</h2></div><div class="scout-quick-actions">',
          '<button type="button" data-scout-action="new-player"><b>＋</b><span>Spieler anlegen</span><small>Privates Profil erstellen</small></button>',
          '<button type="button" data-scout-action="new-report"><b>▤</b><span>Bericht erstellen</span><small>Beobachtung dokumentieren</small></button>',
          '<button type="button" data-scout-section="photos"><b>▧</b><span>Medien verwalten</span><small>Fotos und Videos sichern</small></button>',
        '</div></section>',
      '</div>',

      '<div class="scout-workspace-view" id="scout-section-global-search">',
        '<div class="scout-page-head"><div><span class="scout-kicker">GLOBALE TALENTDATENBANK</span><h2>Globale Spielersuche</h2><p>Durchsuche freigegebene PFMS-Spielerprofile. Die globale Datenbank ist schreibgeschützt; übernimm interessante Talente in deinen privaten Arbeitsbereich.</p></div><span class="scout-preview-tag">LESEZUGRIFF</span></div>',
        '<section class="scout-panel"><div class="scout-form-grid">',
          '<label class="field">Nachname / Spieler<input id="scoutGlobalFilterName" type="search" placeholder="Spieler suchen …"></label>',
          '<label class="field">Verein<input id="scoutGlobalFilterClub" type="search" placeholder="Verein suchen …"></label>',
          '<label class="field">Position<select id="scoutGlobalFilterPosition"><option value="">Alle Positionen</option><option>Torwart</option><option>Abwehr</option><option>Mittelfeld</option><option>Sturm</option></select></label>',
          '<label class="field">Jahrgang von<input id="scoutGlobalFilterFrom" type="number" min="1900" max="2200" placeholder="z. B. 2006"></label>',
          '<label class="field">Jahrgang bis<input id="scoutGlobalFilterTo" type="number" min="1900" max="2200" placeholder="z. B. 2008"></label>',
          '<label class="field">Spielfuß<select id="scoutGlobalFilterFoot"><option value="">Alle</option><option>Links</option><option>Rechts</option><option>Beidfüßig</option></select></label>',
        '</div></section>',
        '<div class="scout-results-line"><span id="scoutGlobalPlayerCount">0 Spieler</span><span>GLOBALE PFMS-SPIELERDATENBANK</span></div>',
        '<div id="scoutGlobalPlayerGrid" class="scout-data-grid"></div>',
      '</div>',

      '<div class="scout-workspace-view" id="scout-section-database">',
        '<div class="scout-page-head"><div><span class="scout-kicker">TALENTÜBERSICHT</span><h2>Meine Spielerdatenbank</h2><p>Deine persönlichen Spielerprofile, unabhängig von der globalen Datenbank.</p></div><button type="button" class="btn btn-primary" data-scout-action="new-player">＋ Spieler anlegen</button></div>',
        '<section class="scout-panel"><div class="scout-form-grid">',
          '<label class="field">Nachname<input id="scoutFilterName" type="search" placeholder="Spieler suchen …"></label>',
          '<label class="field">Position<select id="scoutFilterPosition"><option value="">Alle Positionen</option><option>Torwart</option><option>Abwehr</option><option>Mittelfeld</option><option>Sturm</option></select></label>',
          '<label class="field">Jahrgang von<input id="scoutFilterFrom" type="number" min="1900" max="2200" placeholder="z. B. 2006"></label>',
          '<label class="field">Jahrgang bis<input id="scoutFilterTo" type="number" min="1900" max="2200" placeholder="z. B. 2008"></label>',
          '<label class="field">Spielfuß<select id="scoutFilterFoot"><option value="">Alle</option><option>Links</option><option>Rechts</option><option>Beidfüßig</option></select></label>',
        '</div></section>',
        '<div class="scout-results-line"><span id="scoutPlayerCount">0 Spieler</span><span>PRIVATE SPIELERPROFILE</span></div>',
        '<div id="scoutPlayerGrid" class="scout-data-grid"></div>',
      '</div>',

      '<div class="scout-workspace-view" id="scout-section-reports">',
        '<div class="scout-page-head"><div><span class="scout-kicker">LEISTUNGSANALYSE</span><h2>Meine Scoutingberichte</h2><p>Jede Beobachtung wird dauerhaft deinem Konto zugeordnet.</p></div><button type="button" class="btn btn-primary" data-scout-action="new-report">＋ Bericht erstellen</button></div>',
        '<div id="scoutReportList" class="scout-report-list"></div>',
      '</div>',

      '<div class="scout-workspace-view" id="scout-section-photos">',
        '<div class="scout-page-head"><div><span class="scout-kicker">MEDIENBIBLIOTHEK</span><h2>Meine Fotos</h2><p>Private Spielerbilder und Beobachtungen sicher hochladen.</p></div><label class="btn btn-primary scout-upload-button" for="scoutMediaInput">＋ Dateien hochladen</label></div>',
        '<input id="scoutMediaInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" multiple hidden>',
        '<div class="scout-upload-hint">JPEG, PNG, WebP, HEIC, MP4, MOV oder WebM · maximal 50 MB je Datei · private Speicherung</div>',
        '<div id="scoutMediaGrid" class="scout-media-grid"></div>',
      '</div>',

      '<div class="scout-workspace-view" id="scout-section-videos">',
        '<div class="scout-page-head"><div><span class="scout-kicker">VIDEOANALYSE</span><h2>Meine Videos</h2><p>Private Spiel- und Trainingssequenzen für deine Analyse.</p></div><button type="button" class="btn btn-primary" data-scout-section="photos">＋ Video hochladen</button></div>',
        '<div id="scoutVideoGrid" class="scout-media-grid"></div>',
      '</div>',

      '<dialog id="scoutPlayerDialog" class="scout-dialog"><form id="scoutPlayerForm" class="scout-dialog-form">',
        '<div class="scout-dialog-head"><div><span class="scout-kicker">SPIELERPROFIL</span><h2 id="scoutPlayerDialogTitle">Spieler anlegen</h2></div><button type="button" class="scout-dialog-close" data-scout-close="scoutPlayerDialog" aria-label="Schließen">×</button></div>',
        '<div class="scout-form-grid">',
          '<label class="field">Vorname<input name="name" maxlength="80" required></label>',
          '<label class="field">Nachname<input name="surname" maxlength="80"></label>',
          '<label class="field">Geburtsdatum<input name="birth" type="date"></label>',
          '<label class="field">Verein<input name="club" maxlength="120"></label>',
          '<label class="field">Position<select name="position" required><option>Torwart</option><option>Abwehr</option><option selected>Mittelfeld</option><option>Sturm</option></select></label>',
          '<label class="field">Spielfuß<select name="foot"><option value="">Nicht angegeben</option><option>Links</option><option>Rechts</option><option>Beidfüßig</option></select></label>',
          '<label class="field">Nationalität<input name="nationality" maxlength="80"></label>',
          '<label class="field">Größe (cm)<input name="height" type="number" min="100" max="250"></label>',
          '<label class="field">Beitrittsdatum<input name="join_date" type="date"></label>',
          '<label class="field">Notizen<textarea name="notes" rows="3" maxlength="5000"></textarea></label>',
        '</div>',
        '<div class="scout-dialog-actions"><button type="button" class="btn btn-secondary" data-scout-close="scoutPlayerDialog">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div>',
      '</form></dialog>',

      '<dialog id="scoutReportDialog" class="scout-dialog"><form id="scoutReportForm" class="scout-dialog-form">',
        '<div class="scout-dialog-head"><div><span class="scout-kicker">BEOBACHTUNG</span><h2 id="scoutReportDialogTitle">Bericht erstellen</h2></div><button type="button" class="scout-dialog-close" data-scout-close="scoutReportDialog" aria-label="Schließen">×</button></div>',
        '<div class="scout-form-grid">',
          '<label class="field">Spieler<select name="player_id" id="scoutReportPlayer" required></select></label>',
          '<label class="field">Beobachtungsdatum<input name="observation_date" type="date" required></label>',
          '<label class="field">Gesamtbewertung (0–4)<input name="overall_rating" type="number" min="0" max="4" step="0.1"></label>',
          '<label class="field">Beobachtung / Analyse<textarea name="notes" rows="6" maxlength="10000" required></textarea></label>',
        '</div>',
        '<div class="scout-dialog-actions"><button type="button" class="btn btn-secondary" data-scout-close="scoutReportDialog">Abbrechen</button><button type="submit" class="btn btn-primary">Bericht speichern</button></div>',
      '</form></dialog>'
    ].join('');

    main.appendChild(view);
  }

  function playerCard(player) {
    const name = fullName(player);
    const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    const reports = state.reports.filter((report) => report.player_id === player.id);
    const bestRating = reports
      .map((report) => Number(report.overall_rating))
      .filter(Number.isFinite);
    const rating = bestRating.length ? Math.max(...bestRating).toFixed(1) + '/4' : '–';
    return '<article class="scout-player-card">' +
      '<div class="scout-player-avatar">' + escapeHtml(initials) + '</div>' +
      '<div class="scout-player-main"><div class="scout-player-top"><h3>' + escapeHtml(name) + '</h3><span class="scout-rating">' + escapeHtml(rating) + '</span></div>' +
      '<p>' + escapeHtml(player.club || 'Verein nicht angegeben') + ' · ' + escapeHtml(player.position || 'Position offen') + '</p>' +
      '<div class="scout-player-tags"><span>' + escapeHtml(player.birth ? String(player.birth).slice(0, 4) : 'Jahrgang –') + '</span>' +
      '<span>' + escapeHtml(player.foot || 'Fuß offen') + '</span><span>' + reports.length + ' Berichte</span></div>' +
      '<div class="scout-card-actions"><button type="button" data-scout-edit-player="' + escapeHtml(player.id) + '">Bearbeiten</button><button type="button" data-scout-delete-player="' + escapeHtml(player.id) + '">Löschen</button></div></div></article>';
  }

  function renderPlayers() {
    const host = el('scoutPlayerGrid');
    if (!host) return;
    const query = normalized(el('scoutFilterName')?.value);
    const position = el('scoutFilterPosition')?.value || '';
    const foot = el('scoutFilterFoot')?.value || '';
    const yearFrom = Number(el('scoutFilterFrom')?.value || 0);
    const yearTo = Number(el('scoutFilterTo')?.value || 0);
    const filtered = state.players.filter((player) => {
      const year = Number(String(player.birth || '').slice(0, 4)) || 0;
      return (!query || normalized(player.surname || fullName(player)).includes(query)) &&
        (!position || player.position === position) &&
        (!foot || player.foot === foot) &&
        (!yearFrom || (year > 0 && year >= yearFrom)) &&
        (!yearTo || (year > 0 && year <= yearTo));
    });
    const count = el('scoutPlayerCount');
    if (count) count.textContent = filtered.length + ' Spieler gefunden';
    host.innerHTML = filtered.length
      ? filtered.map(playerCard).join('')
      : '<div class="empty-state"><b>Keine Spieler gefunden</b><p>Lege ein Profil an oder passe deine Filter an.</p></div>';
  }

  function renderGlobalPlayers() {
    const host = el('scoutGlobalPlayerGrid');
    if (!host) return;
    if (!state.globalPlayersAvailable) {
      host.innerHTML = '<div class="empty-state"><b>Globale Spielersuche noch nicht verfügbar</b><p>Die globale PFMS-Katalogmigration muss in der Testdatenbank angewendet werden. Deine privaten Spieler und Berichte bleiben davon getrennt nutzbar.</p></div>';
      if (el('scoutGlobalPlayerCount')) el('scoutGlobalPlayerCount').textContent = 'Nicht verfügbar';
      return;
    }

    const query = normalized(el('scoutGlobalFilterName')?.value);
    const club = normalized(el('scoutGlobalFilterClub')?.value);
    const position = el('scoutGlobalFilterPosition')?.value || '';
    const foot = el('scoutGlobalFilterFoot')?.value || '';
    const yearFrom = Number(el('scoutGlobalFilterFrom')?.value || 0);
    const yearTo = Number(el('scoutGlobalFilterTo')?.value || 0);
    const filtered = state.globalPlayers.filter((player) => {
      const year = Number(String(player.birth || '').slice(0, 4)) || 0;
      return (!query || normalized(player.surname || fullName(player)).includes(query)) &&
        (!club || normalized(player.club).includes(club)) &&
        (!position || player.position === position) &&
        (!foot || player.foot === foot) &&
        (!yearFrom || (year > 0 && year >= yearFrom)) &&
        (!yearTo || (year > 0 && year <= yearTo));
    });

    if (el('scoutGlobalPlayerCount')) {
      el('scoutGlobalPlayerCount').textContent = filtered.length + ' Spieler gefunden';
    }
    host.innerHTML = filtered.length ? filtered.map((player) => {
      const copied = state.players.some((own) => own.source_global_player_id === player.id);
      const name = fullName(player);
      return '<article class="scout-player-card scout-global-player-card">' +
        '<div class="scout-player-avatar">' + escapeHtml(name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()) + '</div>' +
        '<div class="scout-player-main"><div class="scout-player-top"><h3>' + escapeHtml(name) + '</h3><span class="scout-rating">PFMS</span></div>' +
        '<p>' + escapeHtml(player.club || 'Verein nicht angegeben') + ' · ' + escapeHtml(player.position || 'Position offen') + '</p>' +
        '<div class="scout-player-tags"><span>' + escapeHtml(player.birth ? String(player.birth).slice(0, 4) : 'Jahrgang –') + '</span>' +
        '<span>' + escapeHtml(player.foot || 'Fuß offen') + '</span>' +
        '<span>' + escapeHtml(player.nationality || 'Nationalität –') + '</span></div>' +
        '<div class="scout-card-actions"><button type="button" data-scout-copy-global="' + escapeHtml(player.id) + '"' +
        (copied ? ' disabled' : '') + '>' + (copied ? 'Bereits übernommen' : 'In meinen Bereich übernehmen') + '</button></div></div></article>';
    }).join('') : '<div class="empty-state"><b>Keine Spieler gefunden</b><p>Ändere deine Filter oder prüfe deine Suchbegriffe.</p></div>';
  }

  async function importGlobalPlayer(globalPlayerId) {
    const player = state.globalPlayers.find((item) => item.id === globalPlayerId);
    if (!player) return;
    if (state.players.some((item) => item.source_global_player_id === globalPlayerId)) {
      showMessage('Dieser Spieler befindet sich bereits in deiner privaten Spielerdatenbank.');
      return;
    }

    try {
      const { error } = await supabase().from(TABLES.players).insert({
        source_global_player_id: player.id,
        name: player.name,
        surname: player.surname || null,
        birth: player.birth || null,
        join_date: player.join_date || null,
        nationality: player.nationality || null,
        position: player.position || 'Mittelfeld',
        club: player.club || null,
        height: player.height ?? null,
        foot: player.foot || null,
        notes: null
      });
      if (error) throw error;
      await loadData();
      switchTo('database');
      notify('Spieler wurde in deinen privaten Scout-Bereich übernommen.');
    } catch (error) {
      console.error('PFMS global player copy failed:', error);
      showMessage('Spieler konnte nicht übernommen werden. Bitte die globale Katalogmigration und die private Scout-Verknüpfung prüfen.', true);
    }
  }

  function renderReports() {
    const host = el('scoutReportList');
    if (!host) return;
    if (!state.reports.length) {
      host.innerHTML = '<div class="empty-state"><b>Noch keine Berichte vorhanden</b><p>Erstelle eine Beobachtung für einen Spieler aus deiner Datenbank.</p><button type="button" class="btn btn-secondary" data-scout-action="new-report">Bericht erstellen</button></div>';
      return;
    }
    host.innerHTML = state.reports.map((report) => {
      const player = state.players.find((item) => item.id === report.player_id);
      const rating = report.overall_rating === null || report.overall_rating === undefined
        ? '–' : Number(report.overall_rating).toFixed(1);
      return '<article class="scout-report-card"><div class="scout-report-score">' + escapeHtml(rating) + '</div>' +
        '<div><span class="scout-kicker">' + escapeHtml(formatDate(report.observation_date)) + '</span>' +
        '<h3>' + escapeHtml(fullName(player)) + '</h3><p>' + escapeHtml(report.notes || '') + '</p>' +
        '<div class="scout-card-actions"><button type="button" data-scout-edit-report="' + escapeHtml(report.id) + '">Bearbeiten</button>' +
        '<button type="button" data-scout-delete-report="' + escapeHtml(report.id) + '">Löschen</button></div></div></article>';
    }).join('');
  }

  function renderOverview() {
    const ratingValues = state.reports.map((report) => Number(report.overall_rating)).filter(Number.isFinite);
    const average = ratingValues.length
      ? (ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(1)
      : '–';
    if (el('scoutKpiPlayers')) el('scoutKpiPlayers').textContent = String(state.players.length);
    if (el('scoutKpiReports')) el('scoutKpiReports').textContent = String(state.reports.length);
    if (el('scoutKpiRating')) el('scoutKpiRating').textContent = average;
    if (el('scoutKpiMedia')) el('scoutKpiMedia').textContent = String(state.media.length);

    const playerHost = el('scoutOverviewPlayers');
    if (playerHost) {
      const recent = state.players.slice(0, 4);
      playerHost.innerHTML = recent.length ? recent.map((player) =>
        '<div class="scout-mini-player"><span class="scout-mini-avatar">' +
        escapeHtml(fullName(player).split(/\s+/).map((part) => part[0]).slice(0, 2).join('')) +
        '</span><span><b>' + escapeHtml(fullName(player)) + '</b><small>' +
        escapeHtml(player.club || player.position || 'Spielerprofil') + '</small></span><strong>' +
        escapeHtml(player.position || '–') + '</strong></div>'
      ).join('') : '<div class="empty-state">Noch keine Spieler angelegt.</div>';
    }

    const reportHost = el('scoutOverviewReports');
    if (reportHost) {
      const recentReports = state.reports.slice(0, 4);
      reportHost.innerHTML = recentReports.length ? recentReports.map((report) => {
        const player = state.players.find((item) => item.id === report.player_id);
        return '<div class="scout-mini-report"><span class="scout-mini-report-icon">▤</span><span><b>' +
          escapeHtml(fullName(player)) + '</b><small>' + escapeHtml(formatDate(report.observation_date)) +
          ' · Bewertung ' + escapeHtml(report.overall_rating ?? '–') + '/4</small></span></div>';
      }).join('') : '<div class="empty-state">Noch keine Berichte vorhanden.</div>';
    }
  }

  async function renderMedia() {
    const photoHost = el('scoutMediaGrid');
    const videoHost = el('scoutVideoGrid');
    if (!photoHost || !videoHost) return;
    const mediaSnapshot = [...state.media];
    const requestGeneration = state.generation;
    const requestUserId = window.pfssCurrentUserId;
    if (!mediaSnapshot.length) {
      const empty = '<div class="empty-state"><b>Noch keine Medien vorhanden</b><p>Lade private Spielerfotos oder Videos hoch.</p></div>';
      photoHost.innerHTML = empty;
      videoHost.innerHTML = empty;
      return;
    }
    const cards = await Promise.all(mediaSnapshot.map(async (item) => {
      const result = await supabase().storage.from(BUCKET).createSignedUrl(item.storage_path, 3600);
      if (result.error || !result.data?.signedUrl) {
        return '<article class="scout-media-card"><div class="scout-media-error">Datei derzeit nicht abrufbar</div><div class="scout-media-caption">' +
          escapeHtml(item.file_name) + '</div></article>';
      }
      const url = escapeHtml(result.data.signedUrl);
      const media = item.media_type === 'video'
        ? '<video src="' + url + '" controls playsinline preload="metadata"></video>'
        : '<img src="' + url + '" alt="' + escapeHtml(item.file_name) + '" loading="lazy">';
      return '<article class="scout-media-card">' + media +
        '<div class="scout-media-caption"><span>' + escapeHtml(item.file_name) + '</span>' +
        '<small>' + escapeHtml(formatDate(item.created_at)) + '</small>' +
        '<button type="button" data-scout-delete-media="' + escapeHtml(item.id) + '">Datei löschen</button></div></article>';
    }));
    if (requestGeneration !== state.generation || requestUserId !== window.pfssCurrentUserId) return;
    const photos = cards.filter((card, index) => mediaSnapshot[index].media_type === 'photo');
    const videos = cards.filter((card, index) => mediaSnapshot[index].media_type === 'video');
    photoHost.innerHTML = photos.length ? photos.join('') : '<div class="empty-state">Noch keine Fotos gespeichert.</div>';
    videoHost.innerHTML = videos.length ? videos.join('') : '<div class="empty-state">Noch keine Videos gespeichert.</div>';
  }

  async function loadData() {
    if (state.loading) return;
    const requestGeneration = state.generation;
    const requestUserId = window.pfssCurrentUserId;
    if (!requestUserId) return;
    state.loading = true;
    showMessage('Deine privaten Scouting-Daten werden geladen …');
    try {
      const client = supabase();
      const [playersResult, reportsResult, mediaResult] = await Promise.all([
        client.from(TABLES.players).select('*').order('updated_at', { ascending: false }),
        client.from(TABLES.reports).select('*').order('observation_date', { ascending: false }),
        client.from(TABLES.media).select('*').order('created_at', { ascending: false })
      ]);
      if (requestGeneration !== state.generation || requestUserId !== window.pfssCurrentUserId) return;
      const firstError = playersResult.error || reportsResult.error || mediaResult.error;
      if (firstError) throw firstError;
      state.players = playersResult.data || [];
      state.reports = reportsResult.data || [];
      state.media = mediaResult.data || [];
      const globalResult = await client.from('pfms_global_players')
        .select('id,name,surname,birth,nationality,position,club,foot,height')
        .order('surname', { ascending: true, nullsFirst: false });
      if (requestGeneration !== state.generation || requestUserId !== window.pfssCurrentUserId) return;
      state.globalPlayersAvailable = !globalResult.error;
      state.globalPlayers = globalResult.data || [];
      renderOverview();
      renderPlayers();
      renderGlobalPlayers();
      renderReports();
      await renderMedia();
      if (requestGeneration !== state.generation || requestUserId !== window.pfssCurrentUserId) return;
      state.hasLoaded = true;
      showMessage(globalResult.error
        ? 'Private Daten geladen. Die globale Spielersuche benötigt noch die PFMS-Katalogmigration.'
        : 'Private Daten und globale Spielersuche erfolgreich geladen.');
    } catch (error) {
      if (requestGeneration !== state.generation || requestUserId !== window.pfssCurrentUserId) return;
      state.hasLoaded = false;
      console.error('PFMS Scout Workspace load failed:', error);
      showMessage(
        'Der private Arbeitsbereich konnte nicht geladen werden. Bitte prüfe, ob die Scout-Workspace-Migration und der private Storage-Bucket in der Testdatenbank eingerichtet sind. ' +
        (error?.message || ''),
        true
      );
    } finally {
      if (requestGeneration === state.generation) state.loading = false;
    }
  }

  function switchTo(key) {
    if (!sections.includes(key)) return;
    state.active = key;
    const heading = el('scoutHeading');
    if (heading) heading.textContent = key === 'overview' ? 'Dein Scouting. Dein Überblick.' : key === 'global-search' ? 'Globale Spielersuche' : 'Meine ' + labels[key];
    sections.forEach((section) => {
      const panel = el('scout-section-' + section);
      if (panel) panel.classList.toggle('active', section === key);
    });
    document.querySelectorAll('[data-scout-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.scoutSection === key);
    });
    const title = el('pageTitle');
    if (title) title.textContent = 'Scout · ' + labels[key];
    if (key === 'global-search') renderGlobalPlayers();
    if (key === 'database') renderPlayers();
    if (key === 'reports') renderReports();
  }

  function openPlayerDialog(player) {
    const dialog = el('scoutPlayerDialog');
    const form = el('scoutPlayerForm');
    if (!dialog || !form) return;
    state.editingPlayerId = player?.id || null;
    form.reset();
    if (player) {
      for (const field of form.elements) {
        if (field.name && Object.prototype.hasOwnProperty.call(player, field.name)) {
          field.value = player[field.name] ?? '';
        }
      }
    }
    el('scoutPlayerDialogTitle').textContent = player ? 'Spieler bearbeiten' : 'Spieler anlegen';
    dialog.showModal();
    form.elements.name.focus();
  }

  function openReportDialog(report) {
    const dialog = el('scoutReportDialog');
    const form = el('scoutReportForm');
    if (!dialog || !form) return;
    if (!state.players.length) {
      showMessage('Lege zuerst mindestens einen Spieler an, bevor du einen Bericht erstellst.', true);
      switchTo('database');
      return;
    }
    state.editingReportId = report?.id || null;
    form.reset();
    const playerSelect = el('scoutReportPlayer');
    playerSelect.innerHTML = state.players.map((player) =>
      '<option value="' + escapeHtml(player.id) + '">' + escapeHtml(fullName(player)) + '</option>'
    ).join('');
    form.elements.observation_date.value = report?.observation_date || new Date().toISOString().slice(0, 10);
    form.elements.player_id.value = report?.player_id || state.players[0].id;
    form.elements.overall_rating.value = report?.overall_rating ?? '';
    form.elements.notes.value = report?.notes || '';
    el('scoutReportDialogTitle').textContent = report ? 'Bericht bearbeiten' : 'Bericht erstellen';
    dialog.showModal();
    playerSelect.focus();
  }

  async function savePlayer(event) {
    event.preventDefault();
    const requestGeneration = state.generation;
    const requestUserId = window.pfssCurrentUserId;
    if (!requestUserId) {
      showMessage('Deine Sitzung ist nicht verfügbar. Bitte melde dich erneut an.', true);
      return;
    }

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.name = String(data.name || '').trim();
    data.surname = String(data.surname || '').trim() || null;
    data.club = String(data.club || '').trim() || null;
    data.nationality = String(data.nationality || '').trim() || null;
    data.notes = String(data.notes || '').trim() || null;
    data.foot = data.foot || null;
    data.birth = data.birth || null;
    data.join_date = data.join_date || null;
    data.height = data.height ? Number(data.height) : null;
    if (!data.name) {
      showMessage('Bitte gib mindestens einen Vornamen ein.', true);
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const client = supabase();
      const result = state.editingPlayerId
        ? await client.from(TABLES.players).update(data).eq('id', state.editingPlayerId).select().single()
        : await client.from(TABLES.players).insert(data).select().single();
      if (!isCurrentRequest(requestGeneration, requestUserId)) return;
      if (result.error) throw result.error;
      el('scoutPlayerDialog').close();
      state.editingPlayerId = null;
      await loadData();
      if (isCurrentRequest(requestGeneration, requestUserId)) notify('Spielerprofil wurde sicher gespeichert.');
    } catch (error) {
      if (!isCurrentRequest(requestGeneration, requestUserId)) return;
      console.error('PFMS Scout player save failed:', error);
      showMessage('Spielerprofil konnte nicht gespeichert werden: ' + (error?.message || 'Datenbankfehler'), true);
    } finally {
      button.disabled = false;
    }
  }

  async function saveReport(event) {
    event.preventDefault();
    const requestGeneration = state.generation;
    const requestUserId = window.pfssCurrentUserId;
    if (!requestUserId) {
      showMessage('Deine Sitzung ist nicht verfügbar. Bitte melde dich erneut an.', true);
      return;
    }

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.player_id = String(data.player_id || '');
    data.observation_date = data.observation_date || new Date().toISOString().slice(0, 10);
    data.overall_rating = data.overall_rating === '' ? null : Number(data.overall_rating);
    data.notes = String(data.notes || '').trim();
    if (!data.player_id || !data.notes) {
      showMessage('Bitte wähle einen Spieler und gib eine Beobachtung ein.', true);
      return;
    }
    if (data.overall_rating !== null && (!Number.isFinite(data.overall_rating) || data.overall_rating < 0 || data.overall_rating > 4)) {
      showMessage('Die Bewertung muss zwischen 0 und 4 liegen.', true);
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const client = supabase();
      const result = state.editingReportId
        ? await client.from(TABLES.reports).update(data).eq('id', state.editingReportId).select().single()
        : await client.from(TABLES.reports).insert(data).select().single();
      if (!isCurrentRequest(requestGeneration, requestUserId)) return;
      if (result.error) throw result.error;
      el('scoutReportDialog').close();
      state.editingReportId = null;
      await loadData();
      if (isCurrentRequest(requestGeneration, requestUserId)) notify('Scoutingbericht wurde sicher gespeichert.');
    } catch (error) {
      if (!isCurrentRequest(requestGeneration, requestUserId)) return;
      console.error('PFMS Scout report save failed:', error);
      showMessage('Scoutingbericht konnte nicht gespeichert werden: ' + (error?.message || 'Datenbankfehler'), true);
    } finally {
      button.disabled = false;
    }
  }

  async function deletePlayer(id) {
    const player = state.players.find((item) => item.id === id);
    if (!player || !window.confirm('Spieler "' + fullName(player) + '" und die zugehörigen Berichte wirklich löschen?')) return;
    try {
      const { error } = await supabase().from(TABLES.players).delete().eq('id', id);
      if (error) throw error;
      await loadData();
      notify('Spielerprofil wurde gelöscht.');
    } catch (error) {
      showMessage('Spieler konnte nicht gelöscht werden: ' + (error?.message || 'Datenbankfehler'), true);
    }
  }

  async function deleteReport(id) {
    const report = state.reports.find((item) => item.id === id);
    if (!report || !window.confirm('Diesen Scoutingbericht wirklich löschen?')) return;
    try {
      const { error } = await supabase().from(TABLES.reports).delete().eq('id', id);
      if (error) throw error;
      await loadData();
      notify('Scoutingbericht wurde gelöscht.');
    } catch (error) {
      showMessage('Bericht konnte nicht gelöscht werden: ' + (error?.message || 'Datenbankfehler'), true);
    }
  }

  function safeFileName(name) {
    return String(name || 'datei')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-120) || 'datei';
  }

  async function uploadFiles(files) {
    const selected = [...(files || [])];
    if (!selected.length) return;
    const userId = window.pfssCurrentUserId;
    if (!userId) {
      showMessage('Deine Sitzung ist nicht verfügbar. Bitte melde dich erneut an.', true);
      return;
    }
    const input = el('scoutMediaInput');
    if (input) input.disabled = true;
    let completed = 0;
    for (const file of selected) {
      if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
        showMessage('Dateityp nicht zugelassen: ' + file.name, true);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showMessage('Die Datei "' + file.name + '" überschreitet 50 MB.', true);
        continue;
      }
      const path = userId + '/' + makeId() + '-' + safeFileName(file.name);
      try {
        const client = supabase();
        const uploaded = await client.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });
        if (uploaded.error) throw uploaded.error;
        const metadata = await client.from(TABLES.media).insert({
          media_type: file.type.startsWith('video/') ? 'video' : 'photo',
          file_name: file.name,
          storage_path: path,
          mime_type: file.type,
          file_size: file.size
        });
        if (metadata.error) {
          await client.storage.from(BUCKET).remove([path]);
          throw metadata.error;
        }
        completed += 1;
      } catch (error) {
        console.error('PFMS Scout media upload failed:', error);
        showMessage('Upload für "' + file.name + '" fehlgeschlagen: ' + (error?.message || 'Speicherfehler'), true);
      }
    }
    if (input) {
      input.value = '';
      input.disabled = false;
    }
    await loadData();
    if (completed) notify(completed + ' Datei(en) wurden privat hochgeladen.');
  }

  async function deleteMedia(id) {
    const item = state.media.find((media) => media.id === id);
    if (!item || !window.confirm('Datei "' + item.file_name + '" wirklich löschen?')) return;
    try {
      const client = supabase();
      // Keep the metadata row if Storage refuses deletion, so the file remains discoverable.
      const removedFile = await client.storage.from(BUCKET).remove([item.storage_path]);
      if (removedFile.error) throw removedFile.error;

      const removedRow = await client.from(TABLES.media).delete().eq('id', id);
      if (removedRow.error) {
        showMessage('Die Datei wurde aus dem privaten Speicher entfernt, aber der Datenbankeintrag konnte nicht gelöscht werden: ' + removedRow.error.message, true);
        await loadData();
        return;
      }

      await loadData();
      notify('Datei wurde gelöscht.');
    } catch (error) {
      showMessage('Datei konnte nicht gelöscht werden: ' + (error?.message || 'Speicherfehler'), true);
    }
  }

  function bindEvents() {
    if (state.initialized) return;
    state.initialized = true;

    document.addEventListener('click', (event) => {
      const sectionButton = event.target.closest('[data-scout-section]');
      if (sectionButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!el('view-scout-workspace')) return;
        window.showView?.('scout-workspace', sectionButton);
        switchTo(sectionButton.dataset.scoutSection);
        return;
      }

      const copyGlobalButton = event.target.closest('[data-scout-copy-global]');
      if (copyGlobalButton) {
        importGlobalPlayer(copyGlobalButton.dataset.scoutCopyGlobal);
        return;
      }

      const action = event.target.closest('[data-scout-action]');
      if (action) {
        if (action.dataset.scoutAction === 'new-player') openPlayerDialog(null);
        if (action.dataset.scoutAction === 'new-report') openReportDialog(null);
        if (action.dataset.scoutAction === 'refresh') loadData();
        return;
      }

      const editPlayer = event.target.closest('[data-scout-edit-player]');
      if (editPlayer) openPlayerDialog(state.players.find((player) => player.id === editPlayer.dataset.scoutEditPlayer));
      const deletePlayerButton = event.target.closest('[data-scout-delete-player]');
      if (deletePlayerButton) deletePlayer(deletePlayerButton.dataset.scoutDeletePlayer);
      const editReport = event.target.closest('[data-scout-edit-report]');
      if (editReport) openReportDialog(state.reports.find((report) => report.id === editReport.dataset.scoutEditReport));
      const deleteReportButton = event.target.closest('[data-scout-delete-report]');
      if (deleteReportButton) deleteReport(deleteReportButton.dataset.scoutDeleteReport);
      const deleteMediaButton = event.target.closest('[data-scout-delete-media]');
      if (deleteMediaButton) deleteMedia(deleteMediaButton.dataset.scoutDeleteMedia);
      const closeButton = event.target.closest('[data-scout-close]');
      if (closeButton) el(closeButton.dataset.scoutClose)?.close();
    });

    document.addEventListener('input', (event) => {
      if (['scoutFilterName', 'scoutFilterFrom', 'scoutFilterTo'].includes(event.target.id)) renderPlayers();
      if (['scoutGlobalFilterName','scoutGlobalFilterClub','scoutGlobalFilterFrom','scoutGlobalFilterTo'].includes(event.target.id)) renderGlobalPlayers();
    });
    document.addEventListener('change', (event) => {
      if (['scoutFilterPosition', 'scoutFilterFoot'].includes(event.target.id)) renderPlayers();
      if (['scoutGlobalFilterPosition','scoutGlobalFilterFoot'].includes(event.target.id)) renderGlobalPlayers();
      if (event.target.id === 'scoutMediaInput') uploadFiles(event.target.files);
    });
    el('scoutPlayerForm')?.addEventListener('submit', savePlayer);
    el('scoutReportForm')?.addEventListener('submit', saveReport);
  }

  function activate() {
    const role = String(window.pfssCurrentRole || '').toLowerCase();
    if (!role.includes('scout') || window.pfssIsRealAdmin) return;
    if (!el('view-scout-workspace')) addView();
    addNav();

    document.querySelectorAll('.sidebar [data-view]').forEach((item) => { item.hidden = true; });
    const nav = el('scoutWorkspaceNav');
    if (nav) nav.hidden = false;
    document.querySelectorAll('.sidebar .scout-private-nav').forEach((item) => { item.hidden = false; });
    document.querySelectorAll('.view').forEach((item) => {
      item.classList.toggle('active', item.id === 'view-scout-workspace');
    });

    if (!state.initialized) bindEvents();
    switchTo(state.active);
    if (!state.hasLoaded) {
      state.hasLoaded = true;
      loadData();
    }
  }

  window.pfmsResetScoutWorkspace = function resetScoutWorkspaceForAccountChange() {
    state.generation += 1;
    state.loading = false;
    state.hasLoaded = false;
    state.active = 'overview';
    state.players = [];
    state.globalPlayers = [];
    state.globalPlayersAvailable = false;
    state.reports = [];
    state.media = [];
    state.editingPlayerId = null;
    state.editingReportId = null;
    const nav = el('scoutWorkspaceNav');
    if (nav) nav.hidden = true;
    const view = el('view-scout-workspace');
    if (view) view.classList.remove('active');
    if (el('scoutPlayerDialog')?.open) el('scoutPlayerDialog').close();
    if (el('scoutReportDialog')?.open) el('scoutReportDialog').close();
    showMessage('');
  };

  function boot() {
    addNav();
    addView();
    const shell = el('appShell');
    if (shell) {
      new MutationObserver(activate).observe(shell, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    activate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
