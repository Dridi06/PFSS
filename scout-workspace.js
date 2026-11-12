/* PFSS Scout Workspace – grafische Vorschau ohne Datenbankanbindung */
(() => {
  const sections = ['overview','database','reports','photos','videos'];
  const labels = {overview:'Übersicht',database:'Spielerdatenbank',reports:'Scoutingberichte',photos:'Fotos',videos:'Videos'};
  let active = 'overview';
  let demoPlayers = [
    {id:'p1',name:'Luca Hartmann',club:'Berliner SC',position:'Mittelfeld',birth:'2007-04-12',foot:'Rechts',rating:'3.8',status:'Top-Potenzial'},
    {id:'p2',name:'Yassin Benali',club:'VfB Lübeck',position:'Sturm',birth:'2006-09-03',foot:'Links',rating:'3.6',status:'Weiter beobachten'},
    {id:'p3',name:'Noah Schneider',club:'SV Babelsberg 03',position:'Abwehr',birth:'2008-01-22',foot:'Rechts',rating:'3.4',status:'Erstbeobachtung'}
  ];
  const demoReports = [
    {player:'Luca Hartmann',date:'10.11.2026',rating:'3.8',text:'Sehr gute Übersicht und saubere Entscheidungsfindung im Zentrum.'},
    {player:'Yassin Benali',date:'08.11.2026',rating:'3.6',text:'Dynamischer Tiefenläufer mit starkem linken Fuß.'}
  ];
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function addNav(){
    const nav=document.querySelector('.nav-list');
    if(!nav||el('scoutWorkspaceNav'))return;
    const group=document.createElement('div');group.id='scoutWorkspaceNav';group.className='scout-workspace-nav';
    group.innerHTML='<div class="nav-section-label">SCOUT WORKSPACE</div>'+sections.map(k=>'<button type="button" class="nav-item scout-private-nav" data-scout-section="'+k+'"><span class="nav-icon">'+({overview:'⌂',database:'▦',reports:'▤',photos:'▧',videos:'▷'}[k])+'</span><span class="nav-label">'+labels[k]+'</span></button>').join('');
    nav.appendChild(group);
  }
  function addView(){
    const main=document.querySelector('.main-area');if(!main||el('view-scout-workspace'))return;
    const view=document.createElement('section');view.id='view-scout-workspace';view.className='view scout-shell';
    view.innerHTML=`
      <div class="scout-topline"><span class="scout-live-dot"></span> PERSÖNLICHER SCOUT-BEREICH <span class="scout-preview-tag">DESIGNVORSCHAU</span></div>
      <header class="scout-hero"><div><p class="scout-kicker">PERFORMANCE · TALENT · ANALYSE</p><h1 id="scoutHeading">Dein Scouting. Dein Überblick.</h1><p class="scout-lead">Alle Beobachtungen, Spielerprofile und Analysen an einem Ort.</p></div><div class="scout-hero-mark">PF<span>SS</span><small>SCOUTING</small></div></header>
      <div class="scout-private-note">🔒 Persönlicher Arbeitsbereich – die endgültige Datenanbindung folgt im nächsten Schritt.</div>
      <div class="scout-section-tabs" id="scoutSectionTabs">${sections.map(k=>'<button type="button" data-scout-section="'+k+'">'+labels[k]+'</button>').join('')}</div>
      <div id="scoutWorkspaceMessage" class="scout-workspace-message">Du siehst aktuell eine grafische Vorschau mit Beispieldaten.</div>
      <div class="scout-workspace-view active" id="scout-section-overview">
        <div class="scout-kpi-grid">
          <article class="scout-kpi"><span>SPIELER IM FOKUS</span><strong id="scoutKpiPlayers">03</strong><small>In deiner Beobachtung</small><i>♙</i></article>
          <article class="scout-kpi"><span>SCOUTINGBERICHTE</span><strong>02</strong><small>Dokumentierte Analysen</small><i>▤</i></article>
          <article class="scout-kpi"><span>TOP-BEWERTUNG</span><strong>3.8<span>/4</span></strong><small>Aktuelles Spielerprofil</small><i>✦</i></article>
          <article class="scout-kpi"><span>OFFENE BEOBACHTUNGEN</span><strong>04</strong><small>Für die nächste Sichtung</small><i>◎</i></article>
        </div>
        <div class="scout-overview-grid">
          <section class="scout-panel scout-focus-panel"><div class="scout-panel-head"><div><span class="scout-kicker">DEIN FOKUS</span><h2>Spieler im Blick</h2></div><button class="scout-text-action" data-scout-section="database">Alle Spieler →</button></div><div id="scoutOverviewPlayers"></div></section>
          <section class="scout-panel"><div class="scout-panel-head"><div><span class="scout-kicker">LETZTE AKTIVITÄTEN</span><h2>Scoutingberichte</h2></div><button class="scout-text-action" data-scout-section="reports">Alle Berichte →</button></div><div id="scoutOverviewReports"></div></section>
        </div>
        <section class="scout-panel scout-quick-panel"><div><span class="scout-kicker">DIREKT LOSLEGEN</span><h2>Was möchtest du erledigen?</h2></div><div class="scout-quick-actions"><button data-scout-section="database"><b>＋</b><span>Spielerprofil ansehen</span><small>Datenbank öffnen</small></button><button data-scout-section="reports"><b>▤</b><span>Analyse erstellen</span><small>Berichte aufrufen</small></button><button data-scout-section="photos"><b>▧</b><span>Medien verwalten</span><small>Fotobibliothek öffnen</small></button></div></section>
      </div>
      <div class="scout-workspace-view" id="scout-section-database">
        <div class="scout-page-head"><div><span class="scout-kicker">TALENTÜBERSICHT</span><h2>Meine Spielerdatenbank</h2><p>Finde und vergleiche deine beobachteten Spieler.</p></div><button class="btn btn-primary" id="scoutDemoAdd">＋ Spieler vormerken</button></div>
        <section class="scout-panel"><div class="scout-form-grid"><label class="field">Nachname<input id="scoutFilterName" type="search" placeholder="Spieler suchen …"></label><label class="field">Position<select id="scoutFilterPosition"><option value="">Alle Positionen</option><option>Torwart</option><option>Abwehr</option><option>Mittelfeld</option><option>Sturm</option></select></label><label class="field">Jahrgang von<input id="scoutFilterFrom" type="number" placeholder="z. B. 2006"></label><label class="field">Jahrgang bis<input id="scoutFilterTo" type="number" placeholder="z. B. 2008"></label></div></section>
        <div class="scout-results-line"><span id="scoutPlayerCount">3 Spieler</span><span>BEISPIELPROFILE</span></div><div id="scoutPlayerGrid" class="scout-data-grid"></div>
      </div>
      <div class="scout-workspace-view" id="scout-section-reports">
        <div class="scout-page-head"><div><span class="scout-kicker">LEISTUNGSANALYSE</span><h2>Meine Scoutingberichte</h2><p>Beobachtungen strukturiert dokumentieren und bewerten.</p></div><span class="scout-preview-tag">VORSCHAU</span></div><div id="scoutReportList" class="scout-report-list"></div>
      </div>
      <div class="scout-workspace-view" id="scout-section-photos"><div class="scout-page-head"><div><span class="scout-kicker">MEDIENBIBLIOTHEK</span><h2>Meine Fotos</h2><p>Spielerbilder und Eindrücke zentral sammeln.</p></div></div><div class="scout-placeholder-grid"><div>▧<b>Spielerporträts</b><small>Profilbilder und Aufnahmen</small></div><div>▧<b>Spieltag</b><small>Beobachtungen vom Spielfeld</small></div><div>＋<b>Upload-Bereich</b><small>Anbindung folgt im nächsten Schritt</small></div></div></div>
      <div class="scout-workspace-view" id="scout-section-videos"><div class="scout-page-head"><div><span class="scout-kicker">VIDEOANALYSE</span><h2>Meine Videos</h2><p>Spielsequenzen für die spätere Analyse vorbereiten.</p></div></div><div class="scout-video-placeholder"><div class="scout-play">▷</div><h3>Deine Video-Bibliothek</h3><p>Hier erscheinen später hochgeladene Spiel- und Trainingssequenzen.</p><span class="scout-preview-tag">TECHNISCHE ANBINDUNG FOLGT</span></div></div>
    `;
    main.appendChild(view);
  }
  function playerCard(p){
    const initials=p.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    return '<article class="scout-player-card"><div class="scout-player-avatar">'+esc(initials)+'</div><div class="scout-player-main"><div class="scout-player-top"><h3>'+esc(p.name)+'</h3><span class="scout-rating">'+esc(p.rating)+'/4</span></div><p>'+esc(p.club)+' · '+esc(p.position)+'</p><div class="scout-player-tags"><span>'+esc(p.birth.slice(0,4))+'</span><span>'+esc(p.foot)+' Fuß</span><span>'+esc(p.status)+'</span></div></div></article>';
  }
  function renderPlayers(){
    const q=(el('scoutFilterName')?.value||'').toLocaleLowerCase('de-DE'),pos=el('scoutFilterPosition')?.value||'',from=Number(el('scoutFilterFrom')?.value||0),to=Number(el('scoutFilterTo')?.value||0);
    const list=demoPlayers.filter(p=>p.name.toLocaleLowerCase('de-DE').includes(q)&&(!pos||p.position===pos)&&(!from||Number(p.birth.slice(0,4))>=from)&&(!to||Number(p.birth.slice(0,4))<=to));
    el('scoutPlayerCount').textContent=list.length+' Spieler gefunden';
    el('scoutPlayerGrid').innerHTML=list.map(playerCard).join('')||'<div class="empty-state">Keine passenden Spieler gefunden.</div>';
  }
  function renderReports(){
    el('scoutReportList').innerHTML=demoReports.map(r=>'<article class="scout-report-card"><div class="scout-report-score">'+esc(r.rating)+'</div><div><span class="scout-kicker">'+esc(r.date)+'</span><h3>'+esc(r.player)+'</h3><p>'+esc(r.text)+'</p></div></article>').join('');
  }
  function renderOverview(){
    el('scoutOverviewPlayers').innerHTML=demoPlayers.slice(0,3).map(p=>'<div class="scout-mini-player"><span class="scout-mini-avatar">'+esc(p.name.split(' ').map(x=>x[0]).join(''))+'</span><span><b>'+esc(p.name)+'</b><small>'+esc(p.club)+' · '+esc(p.position)+'</small></span><strong>'+esc(p.rating)+'</strong></div>').join('');
    el('scoutOverviewReports').innerHTML=demoReports.map(r=>'<div class="scout-mini-report"><span class="scout-mini-report-icon">▤</span><span><b>'+esc(r.player)+'</b><small>'+esc(r.date)+' · Bewertung '+esc(r.rating)+'/4</small></span></div>').join('');
  }
  function switchTo(key){
    if(!sections.includes(key))return;active=key;
    el('scoutHeading').textContent=key==='overview'?'Dein Scouting. Dein Überblick.':'Meine '+labels[key];
    sections.forEach(k=>{el('scout-section-'+k)?.classList.toggle('active',k===key);});
    document.querySelectorAll('[data-scout-section]').forEach(b=>b.classList.toggle('active',b.dataset.scoutSection===key));
    if(key==='database')renderPlayers();if(key==='reports')renderReports();
    const title=el('pageTitle');if(title)title.textContent='Scout · '+labels[key];
  }
  function activate(){
    const role=String(window.pfssCurrentRole||'').toLowerCase();
    if(!role.includes('scout')||window.pfssIsRealAdmin)return;
    addNav();addView();
    document.querySelectorAll('.sidebar [data-view]').forEach(n=>n.hidden=true);
    el('scoutWorkspaceNav').hidden=false;
    document.querySelectorAll('.sidebar .scout-private-nav').forEach(n=>n.hidden=false);
    document.querySelectorAll('.view').forEach(n=>n.classList.toggle('active',n.id==='view-scout-workspace'));
    renderOverview();renderPlayers();renderReports();switchTo(active);
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-scout-section]');if(b){e.preventDefault();e.stopImmediatePropagation();if(!el('view-scout-workspace'))return;window.showView?.('scout-workspace',b);switchTo(b.dataset.scoutSection);}});
  document.addEventListener('input',e=>{if(['scoutFilterName','scoutFilterFrom','scoutFilterTo'].includes(e.target.id))renderPlayers();});
  document.addEventListener('change',e=>{if(e.target.id==='scoutFilterPosition')renderPlayers();});
  document.addEventListener('click',e=>{if(e.target.closest('#scoutDemoAdd')){document.getElementById('scoutWorkspaceMessage').textContent='Die Spieleranlage wird nach der grafischen Fertigstellung technisch angebunden.';}});
  function boot(){addNav();addView();const shell=el('appShell');if(shell)new MutationObserver(activate).observe(shell,{attributes:true,attributeFilter:['class']});setInterval(activate,1000);activate();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();