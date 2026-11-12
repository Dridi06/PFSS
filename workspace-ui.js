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
    const panel=(heading,body)=>'<section class="pfss-panel"><h3>'+heading+'</h3>'+body+'</section>';
    const fields=(arr)=>'<div class="pfss-form-grid">'+arr.map(x=>'<label>'+x[0]+(x[2]==='select'?'<select><option>'+x[1]+'</option><option>Weitere Auswahl</option></select>':'<input placeholder="'+x[1]+'">')+'</label>').join('')+'</div>';
    const actionNote='<p class="pfss-muted">Alle Eingaben sind derzeit eine grafische Vorschau. Es werden keine Daten gespeichert oder versendet.</p>';
    if(key.endsWith('dashboard')) {
      const flavor=key==='agency-dashboard'?'AGENTUR & TRANSFERPIPELINE':key==='club-dashboard'?'VEREINSFÜHRUNG & MANNSCHAFTEN':'SCOUTING · TALENT · ANALYSE';
      const metric=key==='agency-dashboard'?[['SPIELER IM PORTFOLIO','42','Aktive Profile','♙'],['OFFENE TRANSFERS','08','Vorgänge','⇄'],['KONTAKTE','126','Netzwerk','◎'],['FRISTEN','05','Demnächst fällig','◷']]:key==='club-dashboard'?[['MITGLIEDER','384','Organisationsübersicht','♟'],['MANNSCHAFTEN','12','Aktive Teams','⚽'],['SPIELER','248','Im Kader','♙'],['TERMINE','18','Diesen Monat','▦']]:[['SPIELER IM FOKUS','38','Beobachtete Profile','♙'],['BERICHTE','24','Dokumentierte Analysen','▤'],['SHORTLISTS','06','Aktive Listen','☆'],['AUFGABEN','07','Offen','☑']];
      return '<div class="pfss-hero"><div><span class="pfss-kicker">'+flavor+'</span><h2>'+title+'</h2><p>'+desc+'. Dein zentraler Arbeitsplatz mit Kennzahlen, aktuellen Vorgängen und direkten Aktionen.</p><button class="pfss-action" data-ui-jump="'+(key==='agency-dashboard'?'transfers':key==='club-dashboard'?'teams':'players')+'">Arbeitsbereich öffnen →</button></div><div class="pfss-hero-emblem">PF<span>SS</span></div></div><div class="pfss-stats">'+metric.map(m=>stat(m[0],m[1],m[2],m[3])).join('')+'</div><div class="pfss-columns">'+panel('Aktuelle Aktivitäten',tableFor(key==='agency-dashboard'?'transfers':key==='club-dashboard'?'teams':'reports',demoRows[key==='agency-dashboard'?'transfers':key==='club-dashboard'?'teams':'reports']))+panel('Schnellzugriff','<div class="pfss-shortcuts"><button data-ui-jump="players">♙<span>Spieler suchen</span></button><button data-ui-jump="reports">▤<span>Bericht erstellen</span></button><button data-ui-jump="tasks">☑<span>Aufgaben</span></button><button data-ui-jump="calendar">▦<span>Kalender</span></button><button data-ui-jump="members">♟<span>Mitglieder</span></button><button data-ui-jump="settings">⚙<span>Einstellungen</span></button></div>')+'</div>';
    }
    if(key==='players') return '<div class="pfss-filter-grid"><label>Nachname<input placeholder="Spielername"></label><label>Jahrgang von<input type="number" placeholder="2004"></label><label>Jahrgang bis<input type="number" placeholder="2008"></label><label>Position<select><option>Alle Positionen</option><option>Torwart</option><option>Abwehr</option><option>Mittelfeld</option><option>Sturm</option></select></label><label>Spielfuß<select><option>Alle</option><option>Linksfuß (LF)</option><option>Rechtsfuß (RF)</option><option>Beidfüßig</option></select></label><label>Verein<input placeholder="Vereinsname"></label><label>Beobachtungsstatus<select><option>Alle Status</option><option>Neu</option><option>In Beobachtung</option><option>Shortlist</option></select></label></div>'+controls+tableFor(key,rows);
    if(key==='player-profile') return '<div class="pfss-profile-preview"><div class="pfss-player-portrait">PF</div><div><span class="pfss-kicker">SPIELERPROFIL · BEISPIELDATEN</span><h2>Spielername Beispiel</h2><p>Mittelfeld · Jahrgang 2006 · Rechtsfuß · FC Beispielstadt</p><div class="pfss-tags"><span>Technik 3,8</span><span>Taktik 3,6</span><span>Physis 3,4</span><span>Mentalität 3,9</span></div></div></div><div class="pfss-tabs"><button>Profil</button><button>Leistungsdaten</button><button>Scoutingberichte</button><button>Vereinsstationen</button><button>Verträge</button><button>Medien</button></div><div class="pfss-columns">'+panel('Stammdaten','<div class="pfss-detail-grid"><span>Geburtsdatum</span><b>01.01.2006</b><span>Größe / Gewicht</span><b>178 cm / 70 kg</b><span>Position</span><b>Zentrales Mittelfeld</b><span>Spielfuß</span><b>Rechtsfuß</b><span>Aktueller Verein</span><b>FC Beispielstadt</b><span>Vertragsstatus</span><b>Nicht hinterlegt</b></div>')+panel('Scouting-Einschätzung','<div class="pfss-rating-list"><span>Technik <b>3,8 / 4</b></span><span>Taktik <b>3,6 / 4</b></span><span>Physis <b>3,4 / 4</b></span><span>Mentalität <b>3,9 / 4</b></span></div><p class="pfss-muted">Potenzial, Empfehlung und Entwicklungshinweise werden hier strukturiert dargestellt.</p>')+'</div>';
    if(key==='shortlists') return '<div class="pfss-shortlist-grid"><article><span>☆</span><h3>Top-Talente U21</h3><b>12 Spieler</b><small>Zuletzt aktualisiert: heute</small></article><article><span>☆</span><h3>Regionale Beobachtung</h3><b>08 Spieler</b><small>Zuletzt aktualisiert: gestern</small></article><article><span>☆</span><h3>Vertragsende 2027</h3><b>06 Spieler</b><small>Zuletzt aktualisiert: 10.11.2026</small></article><article><span>＋</span><h3>Neue Shortlist</h3><b>Liste erstellen</b><small>Eigene Beobachtungsgruppe</small></article></div>'+controls;
    if(key==='video-analysis'||key==='media-library') return '<div class="pfss-media-grid"><article><span>▷</span><h3>Spielsequenzen</h3><p>Videos und Spielszenen strukturiert sammeln.</p></article><article><span>▧</span><h3>Spielerbilder</h3><p>Porträts und Bildmaterial zuordnen.</p></article><article><span>▤</span><h3>Dokumente</h3><p>Berichte und ergänzende Unterlagen.</p></article><article><span>＋</span><h3>Datei hinzufügen</h3><p>Upload-Bereich – technische Anbindung folgt.</p></article></div>'+actionNote;
    if(key==='teams') return controls+tableFor(key,rows)+'<div class="pfss-columns">'+panel('Mannschaftsdetails',fields([['Mannschaftsname','z. B. U19'],['Altersklasse','A-Junioren','select'],['Liga','Liga auswählen','select'],['Saison','2026/27']]))+panel('Trainerteam',fields([['Cheftrainer','Name'],['Co-Trainer','Name'],['Betreuer','Name']]))+'</div>';
    if(key==='team-planning'||key==='club-calendar'||key==='calendar') {
      const monthStart=new Date(2026,10,1),daysInMonth=new Date(2026,11,0).getDate(),offset=(monthStart.getDay()+6)%7,cellCount=Math.ceil((offset+daysInMonth)/7)*7;
      const calendarCells=Array.from({length:cellCount},(_,i)=>{const day=i-offset+1;return day>0&&day<=daysInMonth?String(day):'';});
      return '<div class="pfss-calendar"><div class="pfss-calendar-head"><button type="button" aria-label="Vorheriger Monat">‹</button><b>November 2026</b><button type="button" aria-label="Nächster Monat">›</button></div><div class="pfss-calendar-grid">'+['Mo','Di','Mi','Do','Fr','Sa','So',...calendarCells].map(x=>'<span>'+x+'</span>').join('')+'</div></div>'+panel('Bevorstehende Termine','<div class="pfss-agenda"><p><b>13.11. · 18:30</b><span>Training – U19</span></p><p><b>15.11. · 14:00</b><span>Meisterschaftsspiel – 1. Herren</span></p><p><b>17.11. · 19:00</b><span>Trainerbesprechung</span></p></div>');
    }
    if(key==='members') return '<div class="pfss-role-cards"><article><b>Owner</b><p>Vollständige Organisationsverwaltung und Rechtevergabe.</p></article><article><b>Administrator</b><p>Mitglieder, Einstellungen und Freigaben.</p></article><article><b>Scout / Mitarbeiter</b><p>Modulzugriff nach zugewiesenen Rechten.</p></article></div>'+controls+tableFor('contacts',[['Max Mustermann','Administrator','Vereinsleitung','Aktiv'],['Alex Beispiel','Scout','Scouting','Einladung offen']]);
    if(key==='contacts') return controls+tableFor(key,rows)+panel('Kontakt anlegen',fields([['Organisation','Vereins- oder Agenturname'],['Kontaktperson','Vor- und Nachname'],['E-Mail','name@beispiel.de'],['Telefon','Telefonnummer'],['Kategorie','Verein / Agentur','select']]))+actionNote;
    if(key==='transfers') return '<div class="pfss-pipeline"><div><b>01</b><span>Identifiziert</span><strong>12</strong></div><div><b>02</b><span>Leistungsprüfung</span><strong>08</strong></div><div><b>03</b><span>Kontakt</span><strong>05</strong></div><div><b>04</b><span>Verhandlung</span><strong>03</strong></div><div><b>05</b><span>Abgeschlossen</span><strong>09</strong></div></div>'+controls+tableFor(key,rows)+panel('Transferfall vorbereiten',fields([['Spieler','Spieler suchen'],['Abgebender Verein','Verein'],['Aufnehmender Verein','Verein'],['Transferstatus','Phase auswählen','select']]));
    if(key==='contracts') return '<div class="pfss-stats">'+stat('AKTIVE VERTRÄGE','28','Demo-Kennzahl','▤')+stat('FRISTEN IN 60 TAGEN','05','Bitte prüfen','◷')+stat('ABGELAUFEN','02','Demo-Kennzahl','!')+stat('ENTWÜRFE','04','Noch nicht final','✎')+'</div>'+controls+tableFor(key,rows)+panel('Vertragsübersicht',fields([['Vertragspartner','Name'],['Vertragstyp','Spieler / Berater / Verein','select'],['Beginn','TT.MM.JJJJ'],['Laufzeit bis','TT.MM.JJJJ']]));
    if(key==='tasks') return '<div class="pfss-task-board"><article><h3>Offen <b>4</b></h3><p>Spielerbericht finalisieren</p><p>Kontaktaufnahme vorbereiten</p></article><article><h3>In Arbeit <b>3</b></h3><p>U19-Kader prüfen</p><p>Videoanalyse ergänzen</p></article><article><h3>Erledigt <b>8</b></h3><p>Scoutingtermin dokumentiert</p><p>Spielerprofil aktualisiert</p></article></div>'+controls+tableFor(key,rows)+panel('Aufgabe erstellen',fields([['Titel','Aufgabe'],['Verantwortlich','Person auswählen','select'],['Fällig am','TT.MM.JJJJ'],['Priorität','Normal / Hoch','select']]));
    if(key==='settings') return '<div class="pfss-settings-grid">'+panel('Organisation',fields([['Organisationsname','Name der Organisation'],['Zeitzone','Europe/Berlin','select'],['Kontakt-E-Mail','kontakt@beispiel.de']]))+panel('Persönliches Profil',fields([['Anzeigename','Vor- und Nachname'],['Sprache','Deutsch','select'],['Zeitzone','Europe/Berlin','select']]))+panel('Darstellung','<div class="pfss-theme-choice"><span>● Dunkel / Gold</span><span>○ Hell</span></div>')+panel('Sicherheit','<p class="pfss-muted">Passwort, Sitzungen und Sicherheitsoptionen werden hier später verwaltet.</p>')+'</div>'+actionNote;
    if(key==='notifications') return '<div class="pfss-notice-list"><article><b>Neue Aufgabe zugewiesen</b><p>Du wurdest einer Aufgabe im Bereich Scouting zugeordnet.</p><small>Heute · Beispielmeldung</small></article><article><b>Vertragsfrist nähert sich</b><p>Ein Vertragsdatum liegt innerhalb der nächsten 60 Tage.</p><small>Gestern · Beispielmeldung</small></article><article><b>Einladung angenommen</b><p>Ein Mitglied ist deiner Organisation beigetreten.</p><small>10.11.2026 · Beispielmeldung</small></article></div>';
    if(key==='audit') return controls+panel('Aktivitätsprotokoll','<div class="pfss-agenda"><p><b>12.11.2026 · 10:42</b><span>Spielerprofil aktualisiert · Beispielnutzer</span></p><p><b>12.11.2026 · 09:15</b><span>Scoutingbericht erstellt · Beispielnutzer</span></p><p><b>11.11.2026 · 16:08</b><span>Mitglied eingeladen · Beispielnutzer</span></p></div>')+actionNote;
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
    try {
      sessionStorage.setItem('pfss_last_page_v1', JSON.stringify({
        type:'workspace',view:id,userId:window.pfssCurrentUserId||null
      }));
    } catch(storageError) {}
    document.querySelectorAll('.main-area>.view').forEach(v=>v.classList.remove('active'));
    page.classList.add('active');
    document.querySelectorAll('.nav-list .nav-item').forEach(n=>n.classList.toggle('active',n.dataset.uiView===id));
    const title=$('pageTitle');if(title)title.textContent=page.querySelector('h1')?.textContent||id;
    if(history.replaceState)history.replaceState({pfssUiView:id},'',location.pathname+'#'+id);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();