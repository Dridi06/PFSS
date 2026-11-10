
const DB_KEYS = {
  players: 'pfss_players_v1',
  reports: 'pfss_reports_v1'
};

let players = read(DB_KEYS.players, []);
let reports = read(DB_KEYS.reports, []);
let mediaItems = [];

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

function showView(view) {
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.id === `view-${view}`);
  });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  const names = {
    dashboard: 'Dashboard',
    players: 'Spieler',
    reports: 'Scouting-Berichte',
    media: 'Medien',
    admin: 'Administration'
  };

  document.getElementById('pageTitle').textContent =
    names[view] || 'Dashboard';

  document.getElementById('sidebar').classList.remove('open');

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

function renderPlayers() {
  const query =
    (document.getElementById('playerSearch').value || '').toLowerCase();

  const pos = document.getElementById('positionFilter').value;

  const filtered = players.filter(p =>
    (p.name + ' ' + p.club + ' ' + p.nationality)
      .toLowerCase().includes(query) &&
    (!pos || p.position === pos)
  );

  const host = document.getElementById('playerGrid');

  host.innerHTML = filtered.length
    ? filtered.slice().reverse().map(playerCard).join('')
    : `
      <div class="empty-state wide">
        <span class="empty-icon">⌕</span>
        <b>Keine passenden Spieler gefunden</b>
        <p>Ändere deine Suche oder lege einen neuen Spieler an.</p>
      </div>`;
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
  const view = event.target.closest('[data-view]');

  if (view) {
    showView(view.dataset.view);
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

document.getElementById('playerSearch')
  .addEventListener('input', renderPlayers);

document.getElementById('adminUserSearch')
  .addEventListener('input', loadAdminUsers);
document.getElementById('refreshAdminButton')
  .addEventListener('click', loadAdminUsers);

document.getElementById('positionFilter')
  .addEventListener('change', renderPlayers);

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

document.getElementById('menuToggle')
  .addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

renderDashboard();

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

function showAuthenticatedApp(user, profile) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('pendingScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  document.getElementById('accountEmail').textContent =
    profile.username || user.email || 'PFSS Nutzer';

  document.querySelector('.profile-mini small').textContent =
    profile.role === 'admin' ? 'Administrator' : profile.role === 'scout' ? 'Scout' : 'Mitglied';

  const adminNav = document.getElementById('adminNavItem');
  if (adminNav) adminNav.hidden = profile.role !== 'admin';
  window.pfssCurrentUserId = user.id;
  window.pfssCurrentRole = profile.role;

  document.getElementById('accountStatus').textContent =
    'Freigegeben';

  renderDashboard();
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
    const query = (document.getElementById('adminUserSearch').value || '').trim().toLowerCase();
    const filtered = users.filter(x => (x.username || '').toLowerCase().includes(query) || x.id.toLowerCase().includes(query));
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
let signupMode = false;

document.getElementById('signupButton')
  .addEventListener('click', async () => {
    const form = document.getElementById('authForm');
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const username = (form.elements.username.value || '').trim();
    const message = document.getElementById('authMessage');
    const button = document.getElementById('signupButton');

    if (!signupMode) {
      signupMode = true;
      signupUsernameField.hidden = false;
      form.elements.username.required = true;
      document.getElementById('loginButton').textContent = 'Zur Anmeldung';
      button.textContent = 'Registrierung starten';
      document.getElementById('emailFieldLabel').textContent = 'E-Mail-Adresse';
      message.textContent = 'Bitte Benutzername, E-Mail und Passwort eingeben.';
      form.elements.username.focus();
      return;
    }

    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) {
      message.textContent = 'Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt, _ oder -.';
      return;
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || password.length < 8) {
      message.textContent = 'Bitte gültige E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.';
      return;
    }

    button.disabled = true;
    message.textContent = 'Konto wird erstellt …';

    try {
      const { data, error } = await pfssSupabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });

      if (error) throw error;

      if (data.session && data.user) {
        await checkPfssAccess(data.user);
      } else {
        message.textContent =
          'Registrierung vorgemerkt. Bitte bestätige deine E-Mail-Adresse. Dein Benutzername wird mit dem Profil verknüpft, sobald die Datenbankmigration eingespielt ist.';
      }
    } catch (error) {
      message.textContent = 'Registrierung fehlgeschlagen. Bitte prüfe deine Angaben oder versuche es später erneut.';
    } finally {
      button.disabled = false;
    }
  });

document.getElementById('loginButton')
  .addEventListener('click', event => {
    if (!signupMode) return;
    event.preventDefault();
    signupMode = false;
    signupUsernameField.hidden = true;
    document.getElementById('authForm').elements.username.required = false;
    document.getElementById('loginButton').textContent = 'Anmelden';
    document.getElementById('signupButton').textContent = 'Konto erstellen';
    document.getElementById('authMessage').textContent = 'Anmeldung mit E-Mail-Adresse und Passwort.';
  });

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

