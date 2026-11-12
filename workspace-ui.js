/* PFSS Workspace UI Foundation — visual-only scaffold.
   No database writes, authentication changes, or business actions are performed here. */
(() => {
  'use strict';
  const modules = [
    {group:'SCOUTING',items:[
      ['scout-dashboard','Scouting-Dashboard','⌂','Kennzahlen, Beobachtungen und nächste Schritte'],
      ['players','Spielerdatenbank','♙','Spieler suchen, filtern und vergleichen'],
      ['player-profile','Spielerprofile','▣','Stammdaten, Leistungsdaten und Historie'],
      ['reports','Scouting-Berichte','▤','Bewertungen, Notizen und Empfehlungen'],
      ['shortlists','Shortlists','☆','Spielerlisten und Beobachtungsgruppen'],
      ['video-analysis','Videoanalyse','▷','Videos, Szenen und Markierungen'],
      ['media-library','Medienbibliothek','▧','Fotos, Dokumente und Videos']
    ]},
    {group:'VEREIN & MANNSCHAFT',items:[
      ['club-dashboard','Vereins-Dashboard','⌂','Vereinsstatus und zentrale Kennzahlen'],
      ['teams','Mannschaften & Kader','⚽','Teams, Spielerkader und Staff'],
      ['team-planning','Teamplanung','▦','Training, Aufstellungen und Saisonplanung'],
      ['members','Mitglieder & Rollen','♟','Mitglieder, Einladungen und Zuständigkeiten'],
      ['club-calendar','Vereinskalender','▦','Termine, Spiele und Veranstaltungen']
    ]},
    {group:'AGENTUR',items:[
      ['agency-dashboard','Agentur-Dashboard','◇','Portfolio, Pipeline und Aktivitäten'],
      ['contacts','Kontakte & Netzwerk','◎','Vereine, Ansprechpartner und Beziehungen'],
      ['transfers','Transfermanagement','⇄','Transferfälle, Status und Verhandlungen'],
      ['contracts','Verträge & Fristen','▤','Vertragsdaten und Wiedervorlagen']
    ]},
    {group:'ORGANISATION',items:[
      ['tasks','Aufgaben & Projekte','☑','Aufgaben, Verantwortliche und Fortschritt'],
      ['calendar','Kalender','▦','Persönliche und gemeinsame Termine'],
      ['notifications','Benachrichtigungen','♧','Hinweise und Systemmeldungen'],
      ['settings','Einstellungen','⚙','Organisation, Profil und Präferenzen'],
      ['audit','Aktivitätsprotokoll','≡','Nachvollziehbare Änderungen']
    ]}
  ];
  const demoRows = {
    players:[['Milan Beispiel','2006','ST','Rechts','FC Beispielstadt','Beobachtung'],['Noah Muster','2005','ZM','Links','SV Nord','In Prüfung'],['Elias Demo','2007','IV','Rechts','Academy West','Shortlist']],
    teams:[['1. Herren','Herren','Landesliga','24','Aktiv'],['U19','Junioren','A-Junioren','21','Aktiv'],['U17','Junioren','B-Junioren','19','Aktiv']],
    reports:[['Milan Beispiel','Stürmer','3,8 / 4','12.11.2026','Entwurf'],['Noah Muster','Mittelfeld','3,5 / 4','10.11.2026','Freigegeben']],
    contacts:[['FC Beispielstadt','Verein','Max Mustermann','Sportdirektor'],['Next Level Agency','Agentur','Alex Demo','Berater']],
    transfers:[['PF-2026-014','Milan Beispiel','Leistungsprüfung','Offen'],['PF-2026-009','Noah Muster','Kontaktaufnahme','In Bearbeitung']],
    contracts:[['Milan Beispiel','Spielervertrag','30.06.2027','230 Tage'],['Noah Muster','Beratervertrag','31.12.2026','49 Tage']],
    tasks:[['Spielerbericht finalisieren','Scout-Team','Heute','Offen'],['U19-Kader prüfen','Sportliche Leitung','14.11.2026','In Arbeit']]
  };
  const $ = (id,root=document) => root.querySelector('#'+id);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function tableFor(key, rows) {
    const headers = ({players:['Spieler','Jahrgang','Position','Spielfuß','Verein','Status'],teams:['Mannschaft','Kategorie','Liga','Kader','Status'],reports:['Spieler','Position','Bewertung','Datum','Status'],contacts:['Organisation','Typ','Kontakt','Funktion'],transfers:['Vorgang','Spieler','Phase','Status'],contracts:['Person','Vertrag','Laufzeit bis','Restlaufzeit'],tasks:['Aufgabe','Verantwortlich','Fällig','Status']})[key] || ['Name','Kategorie','Zuständig','Status'];
    return '<div class="pfss-table-wrap"><table class="pfss-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td>'+(i===row.length-1?'<span class="pfss-status">'+esc(v)+'</span>':esc(v))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function stat(label,value,detail,icon){return '<article class="pfss-stat"><span>'+label+'</span><b>'+value+'</b><small>'+detail+'</small><i>'+icon+'</i></article>';}
  function pageContent(key,title,desc) {
    const rows=demoRows[key];
    const controls='<div class="pfss-toolbar"><label class="pfss-search">⌕ <input type="search" placeholder="Suchen …" aria-label="Suchen"></label><select aria-label="Statusfilter"><option>Alle Status</option><option>Aktiv</option><option>In Bearbeitung</option><option>Offen</option></select><button class="pfss-action" type="button" data-ui-preview-action>＋ Neu anlegen</button></div>';
    if(key.endsWith('dashboard') || key==='scout-dashboard') return '<div class="pfss-hero"><div><span class="pfss-kicker">PROFESSIONAL FOOTBALL MANAGEMENT</span><h2>'+title+'</h2><p>'+desc+'. Alle relevanten Informationen in einer klaren Arbeitsübersicht.</p><button class="pfss-action" data-ui-jump="players">Spielerdatenbank öffnen →</button></div><div class="pfss-hero-emblem">PF<span>SS</span></div></div><div class="pfss-stats">'+stat('SPIELER IM SYSTEM','248','Demo-Kennzahl','♙')+stat('AKTIVE VORGÄNGE','18','Demo-Kennzahl','⇄')+stat('OFFENE AUFGABEN','07','Demo-Kennzahl','☑')+stat('BERICHTE','36','Demo-Kennzahl','▤')+'</div><div class="pfss-columns"><section class="pfss-panel"><div class="pfss-panel-head"><div><span class="pfss-kicker">ARBEITSÜBERSICHT</span><h3>Zuletzt bearbeitet</h3></div><span class="pfss-preview">BEISPIELDATEN</span></div>'+tableFor('reports',demoRows.reports)+'</section><section class="pfss-panel"><span class="pfss-kicker">SCHNELLZUGRIFF</span><h3>Direkt zu deinen Aufgaben</h3><div class="pfss-shortcuts"><button data-ui-jump="players">♙<span>Spieler suchen</span></button><button data-ui-jump="reports">▤<span>Bericht erstellen</span></button><button data-ui-jump="tasks">☑<span>Aufgaben ansehen</span></button><button data-ui-jump="calendar">▦<span>Kalender öffnen</span></button></div></section></div>';
    if(key==='players') return '<div class="pfss-filter-grid"><label>Nachname<input placeholder="Spielername"></label><label>Jahrgang von<input type="number" placeholder="2004"></label><label>Jahrgang bis<input type="number" placeholder="2008"></label><label>Position<select><option>Alle Positionen</option><option>Torwart</option><option>Abwehr</option><option>Mittelfeld</option><option>Sturm</option></select></label><label>Spielfuß<select><option>Alle</option><option>Linksfuß (LF)</option><option>Rechtsfuß (RF)</option><option>Beidfüßig</option></select></label></div>'+controls+tableFor(key,rows);
    if(rows) return controls+tableFor(key,rows);
    if(key==='player-profile') return '<div class="pfss-profile-preview"><div class="pfss-player-portrait">PF</div><div><span class="pfss-kicker">SPIELERPROFIL · BEISPIEL</span><h2>Spielername Beispiel</h2><p>Mittelfeld · Jahrgang 2006 · Rechtsfuß</p><div class="pfss-tags"><span>Technik 3,8</span><span>Taktik 3,6</span><span>Physis 3,4</span><span>Mentalität 3,9</span></div></div></div><div class="pfss-tabs"><button>Übersicht</button><button>Leistungsdaten</button><button>Berichte</button><button>Historie</button><button>Medien</button></div><div class="pfss-columns"><section class="pfss-panel"><h3>Spielerinformationen</h3><div class="pfss-detail-grid"><span>Geburtsdatum</span><b>01.01.2006</b><span>Aktueller Verein</span><b>FC Beispielstadt</b><span>Vertragsstatus</span><b>Beispiel – ungeprüft</b></div></section><section class="pfss-panel"><h3>Scouting-Einschätzung</h3><p class="pfss-muted">Hier werden künftig Bewertungen, Potenzial und Empfehlungen dargestellt.</p></section></div>';
    if(key==='shortlists') return '<div class="pfss-shortlist-grid"><article><span>☆</span><h3>Top-Talente U21</h3><b>12 Spieler</b><small>Zuletzt aktualisiert: heute</small></article><article><span>☆</span><h3>Regionale Beobachtung</h3><b>08 Spieler</b><small>Zuletzt aktualisiert: gestern</small></article><article><span>＋</span><h3>Neue Shortlist</h3><b>Liste erstellen</b><small>Eigene Beobachtungsgruppe</small></article></div>';
    if(key==='video-analysis'||key==='media-library') return '<div class="pfss-media-grid"><article><span>▷</span><h3>Spielsequenzen</h3><p>Videos und Spielszenen strukturiert sammeln.</p></article><article><span>▧</span><h3>Spielerbilder</h3><p>Porträts und Bildmaterial zuordnen.</p></article><article><span>＋</span><h3>Datei hinzufügen</h3><p>Upload-Funktion wird später technisch verbunden.</p></article></div>';
    if(key==='team-planning'||key==='club-calendar'||key==='calendar') return '<div class="pfss-calendar"><div class="pfss-calendar-head"><button>‹</button><b>November 2026</b><button>›</button></div><div class="pfss-calendar-grid">'+['Mo','Di','Mi','Do','Fr','Sa','So',...Array.from({length:35},(_,i)=>String(i+1))].map(x=>'<span>'+x+'</span>').join('')+'</div></div><section class="pfss-panel"><h3>Bevorstehende Termine</h3><p class="pfss-muted">Training · Spieltage · Besprechungen · Fristen</p></section>';
    if(key==='members') return '<div class="pfss-role-cards"><article><b>Owner</b><p>Vollständige Organisationsverwaltung</p></article><article><b>Administrator</b><p>Mitglieder, Einstellungen und Freigaben</p></article><article><b>Scout / Mitarbeiter</b><p>Modulzugriff nach zugewiesenen Rechten</p></article></div>'+controls;
    if(key==='settings') return '<div class="pfss-settings-grid"><section class="pfss-panel"><h3>Organisation</h3><label>Organisationsname<input placeholder="Name der Organisation"></label><label>Zeitzone<select><option>Europe/Berlin</option></select></label></section><section class="pfss-panel"><h3>Persönliches Profil</h3><label>Anzeigename<input placeholder="Vor- und Nachname"></label><label>Sprache<select><option>Deutsch</option><option>English</option></select></label></section></div>';
    if(key==='notifications'||key==='audit') return '<section class="pfss-panel pfss-empty"><span>✧</span><h3>'+ (key==='audit'?'Aktivitäten werden hier protokolliert':'Du bist auf dem neuesten Stand')+'</h3><p>Die echte Daten- und Ereignisanbindung wird in einem späteren Schritt ergänzt.</p></section>';
    return '<div class="pfss-placeholder"><span>✦</span><h3>'+title+'</h3><p>'+desc+'</p><small>GRAFISCHE GRUNDSTRUKTUR · TECHNISCHE ANBINDUNG FOLGT</small></div>';
  }
  function build() {
    const nav=document.querySelector('.nav-list'),main=document.querySelector('.main-area');
    if(!nav||!main||$('pfssUiNav')) return;
    const home=nav.querySelector('[data-view="dashboard"]');
    const group=document.createElement('div');group.id='pfssUiNav';group.className='pfss-ui-nav';
    group.innerHTML=modules.map(g=>'<div class="nav-section-label">'+g.group+'</div>'+g.items.map(([id,label,icon])=>'<button class="nav-item pfss-ui-nav-item" type="button" data-ui-view="'+id+'"><span class="nav-icon">'+icon+'</span><span class="nav-label">'+label+'</span></button>').join('')).join('');
    if(home?.nextSibling) nav.insertBefore(group,home.nextSibling); else nav.appendChild(group);
    const pages=modules.flatMap(g=>g.items);
    pages.forEach(([id,title,icon,desc])=>{
      const section=document.createElement('section');section.className='view pfss-ui-view';section.id='pfss-view-'+id;section.dataset.uiPage=id;
      section.innerHTML='<header class="pfss-page-heading"><div><span class="pfss-kicker">PFSS WORKSPACE / '+esc(title.toUpperCase())+'</span><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div><span class="pfss-preview">GRAFIKVORSCHAU</span></header>'+pageContent(id,title,desc);
      main.appendChild(section);
    });
    document.addEventListener('click',e=>{
      const navBtn=e.target.closest('[data-ui-view]'),jump=e.target.closest('[data-ui-jump]');
      if(navBtn||jump){const id=navBtn?.dataset.uiView||jump?.dataset.uiJump;activate(id);if(window.matchMedia('(max-width:760px)').matches){$('sidebar')?.classList.remove('open');$('menuToggle')?.setAttribute('aria-expanded','false');}}
      const action=e.target.closest('[data-ui-preview-action]');
      if(action){const note=action.closest('.view')?.querySelector('.pfss-preview-note');if(note)note.textContent='Dies ist eine grafische Vorschau. Speichern und Datenbankaktionen sind noch nicht aktiviert.';else action.insertAdjacentHTML('afterend','<span class="pfss-preview-note">Nur Vorschau – noch keine Datenbankaktion.</span>');}
    });
  }
  function activate(id){
    const page=$('pfss-view-'+id);if(!page)return;
    document.querySelectorAll('.main-area>.view').forEach(v=>v.classList.remove('active'));
    page.classList.add('active');
    document.querySelectorAll('.nav-list .nav-item').forEach(n=>n.classList.toggle('active',n.dataset.uiView===id));
    const title=$('pageTitle');if(title)title.textContent=page.querySelector('h1')?.textContent||id;
    if(history.replaceState)history.replaceState({pfssUiView:id},'',location.pathname+'#'+id);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();