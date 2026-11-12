/* PFSS private scout workspace. Data is always read/written through RLS-protected Supabase tables. */
(() => {
  const sections = ['database','reports','photos','videos'];
  const labels = {database:'Datenbank',reports:'Scoutingberichte',photos:'Fotos',videos:'Videos'};
  let players = [], reports = [], media = [];
  let activeSection = 'database';
  let initializedFor = '';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el = id => document.getElementById(id);
  const say = message => { const target=el('scoutWorkspaceMessage'); if(target) target.textContent=message; };
  const supa = () => window.pfssSupabase || null;

  function addWorkspace() {
    const nav = document.querySelector('.nav-list');
    if (!nav || el('scoutWorkspaceNav')) return;
    const group = document.createElement('div');
    group.id = 'scoutWorkspaceNav';
    group.className = 'scout-workspace-nav';
    group.innerHTML = '<div class="nav-section-label">ABTEILUNG SCOUTS</div>' +
      sections.map(key => '<button type="button" class="nav-item scout-private-nav" data-scout-section="'+key+'"><span class="nav-icon">'+({database:'▦',reports:'▤',photos:'▧',videos:'▷'}[key])+'</span><span class="nav-label">'+labels[key]+'</span></button>').join('');
    const firstAdmin = nav.querySelector('.admin-nav-section');
    nav.insertBefore(group, firstAdmin || null);
  }

  function addView() {
    const main = document.querySelector('.main-area');
    if (!main || el('view-scout-workspace')) return;
    const view = document.createElement('section');
    view.id = 'view-scout-workspace';
    view.className = 'view';
    view.innerHTML = `
      <div class="page-heading"><div><div class="eyebrow">PERSÖNLICHER SCOUT-BEREICH</div><h1 id="scoutWorkspaceTitle">Meine Datenbank</h1><p>Deine Spieler, Berichte und Medien – ausschließlich deinem Scout-Konto zugeordnet.</p></div></div>
      <div class="scout-private-note">🔒 Privater Bereich: Deine Inhalte sind serverseitig von den Daten anderer Scouts getrennt.</div>
      <div class="scout-section-tabs" id="scoutSectionTabs">${sections.map(k=>'<button type="button" data-scout-section="'+k+'">'+labels[k]+'</button>').join('')}</div>
      <div id="scoutWorkspaceMessage" class="scout-workspace-message" role="status" aria-live="polite"></div>
      <section class="scout-workspace-view" id="scout-section-database">
        <div class="panel"><div class="panel-heading"><div><div class="eyebrow">SPIELERDATENBANK</div><h3>Spieler gezielt suchen</h3></div><button class="btn btn-primary" id="scoutAddPlayer">＋ Spieler hinzufügen</button></div>
          <form id="scoutSearchForm" class="scout-form-grid">
            <label class="field">Nachname<input id="scoutSearchSurname" type="search" placeholder="Nachname"></label>
            <label class="field">Verein<input id="scoutSearchClub" type="search" placeholder="Verein"></label>
            <label class="field">Position<select id="scoutSearchPosition"><option value="">Alle Positionen</option><option>Torwart</option><option>Abwehr</option><option>Mittelfeld</option><option>Sturm</option></select></label>
            <label class="field">Jahrgang von<input id="scoutSearchFrom" type="number" placeholder="z. B. 2005"></label>
            <label class="field">Jahrgang bis<input id="scoutSearchTo" type="number" placeholder="z. B. 2010"></label>
            <label class="field">Spielfuß<select id="scoutSearchFoot"><option value="">Beide / alle</option><option value="Links">LF · Linksfuß</option><option value="Rechts">RF · Rechtsfuß</option><option value="Beidfüßig">Beidfüßig</option></select></label>
            <label class="field">Beitrittsdatum<input id="scoutSearchJoinDate" type="date"></label>
            <label class="field">Sortieren nach<select id="scoutSort"><option value="surname">Nachname</option><option value="birth">Jahrgang</option><option value="position">Position</option><option value="join_date">Beitrittsdatum</option></select></label>
            <label class="field">Reihenfolge<select id="scoutDirection"><option value="asc">Aufsteigend</option><option value="desc">Absteigend</option></select></label>
            <div class="field full"><button class="btn btn-primary" type="submit">Suchen</button> <button class="btn btn-secondary" type="reset">Zurücksetzen</button></div>
          </form>
        </div>
        <p id="scoutPlayerCount" class="admin-message"></p><div id="scoutPlayerGrid" class="scout-data-grid"></div>
      </section>
      <section class="scout-workspace-view" id="scout-section-reports">
        <div class="page-heading"><div><div class="eyebrow">LEISTUNGSANALYSE</div><h2>Meine Scoutingberichte</h2><p>Bewerte Technik, Taktik, Athletik und Mentalität (Skala 1–4).</p></div><button class="btn btn-primary" id="scoutAddReport">＋ Bericht erstellen</button></div>
        <div id="scoutReportList" class="scout-data-grid"></div>
      </section>
      <section class="scout-workspace-view" id="scout-section-photos">
        <div class="page-heading"><div><div class="eyebrow">MEDIENBIBLIOTHEK</div><h2>Meine Fotos</h2></div><label class="btn btn-primary upload-button">＋ Fotos hochladen<input id="scoutPhotoInput" type="file" accept="image/*" multiple hidden></label></div>
        <div id="scoutPhotoGrid" class="scout-media-grid"></div>
      </section>
      <section class="scout-workspace-view" id="scout-section-videos">
        <div class="page-heading"><div><div class="eyebrow">MEDIENBIBLIOTHEK</div><h2>Meine Videos</h2></div><label class="btn btn-primary upload-button">＋ Videos hochladen<input id="scoutVideoInput" type="file" accept="video/mp4,video/quicktime,video/webm" multiple hidden></label></div>
        <div id="scoutVideoGrid" class="scout-media-grid"></div>
      </section>
      <dialog id="scoutPlayerDialog" class="modal"><form id="scoutPlayerForm">
        <div class="modal-head"><div><div class="eyebrow">MEINE DATENBANK</div><h2>Spieler anlegen</h2></div><button type="button" class="close-button" data-scout-close="scoutPlayerDialog">×</button></div>
        <div class="scout-form-grid">
          <label class="field full">Vollständiger Name<input name="name" required maxlength="160"></label>
          <label class="field">Nachname<input name="surname" maxlength="100"></label>
          <label class="field">Geburtsdatum<input name="birth" type="date"></label>
          <label class="field">Beitrittsdatum<input name="join_date" type="date"></label>
          <label class="field">Nationalität<input name="nationality" maxlength="80"></label>
          <label class="field">Position<select name="position"><option>Torwart</option><option>Abwehr</option><option selected>Mittelfeld</option><option>Sturm</option></select></label>
          <label class="field">Verein<input name="club" maxlength="120"></label>
          <label class="field">Größe (cm)<input name="height" type="number" min="100" max="230"></label>
          <label class="field">Spielfuß<select name="foot"><option value="">Nicht angegeben</option><option value="Rechts">RF · Rechtsfuß</option><option value="Links">LF · Linksfuß</option><option value="Beidfüßig">Beidfüßig</option></select></label>
          <label class="field full">Notizen<textarea name="notes" rows="3"></textarea></label>
        </div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-scout-close="scoutPlayerDialog">Abbrechen</button><button class="btn btn-primary">Spieler speichern</button></div>
      </form></dialog>
      <dialog id="scoutReportDialog" class="modal"><form id="scoutReportForm">
        <div class="modal-head"><div><div class="eyebrow">SPIELERBEWERTUNG</div><h2>Scoutingbericht erstellen</h2></div><button type="button" class="close-button" data-scout-close="scoutReportDialog">×</button></div>
        <div class="scout-form-grid"><label class="field full">Spieler<select name="player_id" id="scoutReportPlayer" required></select></label><label class="field">Beobachtungsdatum<input name="observation_date" type="date" required></label><label class="field">Gesamtbewertung<input name="overall_rating" type="number" min="1" max="4" step=".5"></label></div>
        <h3>Technik</h3><div class="scout-score-grid" id="scoutTechScores"></div><h3>Taktik</h3><div class="scout-score-grid" id="scoutTacticScores"></div><h3>Athletik</h3><div class="scout-score-grid" id="scoutAthleticScores"></div><h3>Mentalität</h3><div class="scout-score-grid" id="scoutMentalScores"></div>
        <label class="field full">Sonstige Bemerkungen<textarea name="notes" rows="4"></textarea></label>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-scout-close="scoutReportDialog">Abbrechen</button><button class="btn btn-primary">Bericht speichern</button></div>
      </form></dialog>`;
    main.appendChild(view);
  }

  const scoreGroups = {
    scoutTechScores:['Dribbling','Passspiel kurz','Passspiel lang','Beidfüßigkeit','Kopfballspiel','1:1 Offensiv','Ball An-/Mitnahme','Erster Kontakt','Repertoire Finten','Variabler Torschuss'],
    scoutTacticScores:['1:1 Defensiv','Kreativität','Raumverhalten','Spiel ohne Ball','Anspielbereitschaft','Zweikampf','Umschaltspiel','Handlungsschnelligkeit','Antizipationsfähigkeit','Lösen vom Gegner'],
    scoutAthleticScores:['Laufbild','Laufaktivität','Körperlichkeit','Antrittsschnelligkeit','Schnelligkeit Distanz','Bewegungsgeschicklichkeit'],
    scoutMentalScores:['Einstellung','Führungsspieler','Kommunikation','Risikofreude','Positive Körpersprache','Teamplayer','Spieleinfluss','Disziplin/Konzentration']
  };
  function buildScoreInputs(){
    Object.entries(scoreGroups).forEach(([id,names])=>{
      const host=el(id); if(!host || host.dataset.ready) return;
      host.innerHTML=names.map((name,i)=>'<label class="scout-score-item"><span>'+esc(name)+'</span><select name="score_'+id+'_'+i+'"><option value="">–</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>').join('');
      host.dataset.ready='1';
    });
  }

  function switchSection(section){
    if(!sections.includes(section)) section='database';
    activeSection=section;
    const title=el('scoutWorkspaceTitle'); if(title) title.textContent='Meine '+labels[section];
    document.querySelectorAll('[data-scout-section]').forEach(b=>b.classList.toggle('active',b.dataset.scoutSection===section));
    sections.forEach(k=>{const node=el('scout-section-'+k); if(node) node.classList.toggle('active',k===section);});
    const pageTitle=el('pageTitle'); if(pageTitle) pageTitle.textContent=labels[section];
    if(section==='database') renderPlayers();
    if(section==='reports') renderReports();
    if(section==='photos') renderMedia('photo');
    if(section==='videos') renderMedia('video');
  }

  async function loadAll(){
    if(!supa() || !window.pfssCurrentUserId) return;
    say('Eigene Daten werden geladen …');
    const [p,r,m]=await Promise.all([
      supa().from('pfss_scout_players').select('*').order('created_at',{ascending:false}),
      supa().from('pfss_scout_reports').select('*').order('created_at',{ascending:false}),
      supa().from('pfss_scout_media').select('*').order('created_at',{ascending:false})
    ]);
    if(p.error||r.error||m.error){say('Datenbank noch nicht eingerichtet. Bitte zuerst die PFSS-Scout-Migration in Supabase ausführen.');console.error(p.error||r.error||m.error);return;}
    players=p.data||[]; reports=r.data||[]; media=m.data||[];
    say('Deine Datenbank ist bereit.');
    renderPlayers(); renderReports();
  }

  function renderPlayers(){
    const host=el('scoutPlayerGrid'); if(!host)return;
    const val=id=>(el(id)?.value||'').trim().toLocaleLowerCase('de-DE');
    let list=players.filter(p=>{
      const surname=(p.surname||p.name.split(/\s+/).pop()).toLocaleLowerCase('de-DE');
      const year=Number(String(p.birth||'').slice(0,4))||0;
      return (!val('scoutSearchSurname')||surname.includes(val('scoutSearchSurname'))) &&
        (!val('scoutSearchClub')||(p.club||'').toLocaleLowerCase('de-DE').includes(val('scoutSearchClub'))) &&
        (!val('scoutSearchPosition')||p.position===val('scoutSearchPosition')) &&
        (!val('scoutSearchFoot')||p.foot===val('scoutSearchFoot')) &&
        (!el('scoutSearchFrom')?.value||year>=Number(el('scoutSearchFrom').value)) &&
        (!el('scoutSearchTo')?.value||year<=Number(el('scoutSearchTo').value)) &&
        (!el('scoutSearchJoinDate')?.value||p.join_date===el('scoutSearchJoinDate').value);
    });
    const key=el('scoutSort')?.value||'surname', dir=el('scoutDirection')?.value==='desc'?-1:1;
    list.sort((a,b)=>String(key==='surname'?(a.surname||a.name):(a[key]||'')).localeCompare(String(key==='surname'?(b.surname||b.name):(b[key]||'')),'de',{numeric:true,sensitivity:'base'})*dir);
    el('scoutPlayerCount').textContent=list.length+' Spieler in deiner Datenbank';
    host.innerHTML=list.length?list.map(p=>'<article class="scout-data-card"><h3>'+esc(p.name)+'</h3><p>'+esc(p.club||'Verein nicht angegeben')+' · '+esc(p.position)+'<br>Jahrgang: '+esc((p.birth||'').slice(0,4)||'–')+' · '+esc(p.foot||'Spielfuß offen')+'</p><button class="btn btn-secondary" data-scout-report-for="'+esc(p.id)+'">Bericht erstellen</button></article>').join(''):'<div class="empty-state"><b>Noch keine Spieler</b><p>Lege deinen ersten Spieler in deiner persönlichen Datenbank an.</p></div>';
  }

  function renderReports(){
    const host=el('scoutReportList'); if(!host)return;
    host.innerHTML=reports.length?reports.map(r=>{
      const p=players.find(x=>x.id===r.player_id);
      const scoreCount=Object.keys(r.scores||{}).length;
      return '<article class="scout-data-card"><h3>'+esc(p?.name||'Spieler')+'</h3><p>'+esc(r.observation_date)+' · Bewertung: '+esc(r.overall_rating??'–')+'/4<br>'+scoreCount+' Einzelkriterien bewertet</p><p>'+esc(r.notes)+'</p></article>';
    }).join(''):'<div class="empty-state"><b>Noch keine Berichte</b><p>Erstelle deinen ersten Scoutingbericht.</p></div>';
  }

  async function renderMedia(type){
    const host=el(type==='photo'?'scoutPhotoGrid':'scoutVideoGrid'); if(!host)return;
    const items=media.filter(x=>x.media_type===type);
    if(!items.length){host.innerHTML='<div class="empty-state"><b>Noch keine '+(type==='photo'?'Fotos':'Videos')+'</b><p>Lade deine ersten Dateien hoch.</p></div>';return;}
    host.innerHTML='';
    for(const item of items){
      const {data,error}=await supa().storage.from('pfss-scout-private').createSignedUrl(item.storage_path,3600);
      if(error)continue;
      const card=document.createElement('article');card.className='scout-media-card';
      const mediaEl=document.createElement(type==='photo'?'img':'video');
      mediaEl.src=data.signedUrl; if(type==='video'){mediaEl.controls=true;mediaEl.playsInline=true;} else mediaEl.alt=item.file_name;
      const caption=document.createElement('p');caption.textContent=item.file_name;
      card.append(mediaEl,caption);host.appendChild(card);
    }
  }

  async function uploadFiles(files,type){
    if(!files?.length)return;
    say('Dateien werden sicher hochgeladen …');
    for(const file of files){
      const path=window.pfssCurrentUserId+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const {error:uploadError}=await supa().storage.from('pfss-scout-private').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError){say('Upload fehlgeschlagen: '+uploadError.message);return;}
      const {error:rowError}=await supa().from('pfss_scout_media').insert({owner_id:window.pfssCurrentUserId,media_type:type,file_name:file.name,storage_path:path,mime_type:file.type,file_size:file.size});
      if(rowError){await supa().storage.from('pfss-scout-private').remove([path]);say('Mediendatei konnte nicht registriert werden.');return;}
    }
    const {data,error}=await supa().from('pfss_scout_media').select('*').order('created_at',{ascending:false});
    if(error){say('Medien wurden hochgeladen, konnten aber nicht geladen werden.');return;}
    media=data||[];say('Upload abgeschlossen.');renderMedia(type);
  }

  function bind(){
    buildScoreInputs();
    el('scoutAddPlayer')?.addEventListener('click',()=>el('scoutPlayerDialog').showModal());
    el('scoutAddReport')?.addEventListener('click',()=>{if(!players.length){say('Bitte zuerst einen Spieler anlegen.');switchSection('database');return;}openReport();});
    el('scoutSearchForm')?.addEventListener('submit',e=>{e.preventDefault();renderPlayers();});
    el('scoutSearchForm')?.addEventListener('reset',()=>setTimeout(renderPlayers,0));
    el('scoutPlayerForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));
      data.height=data.height?Number(data.height):null;
      data.owner_id=window.pfssCurrentUserId;
      const {error}=await supa().from('pfss_scout_players').insert(data);
      if(error){say('Spieler konnte nicht gespeichert werden: '+error.message);return;}
      e.currentTarget.reset();el('scoutPlayerDialog').close();await loadAll();say('Spieler wurde in deiner Datenbank gespeichert.');
    });
    el('scoutReportForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));
      const scores={};
      form.querySelectorAll('select[name^="score_"]').forEach(s=>{if(s.value)scores[s.closest('.scout-score-item').querySelector('span').textContent]=Number(s.value);});
      const {error}=await supa().from('pfss_scout_reports').insert({
        owner_id:window.pfssCurrentUserId,player_id:data.player_id,observation_date:data.observation_date,
        overall_rating:data.overall_rating?Number(data.overall_rating):null,scores,notes:data.notes||''
      });
      if(error){say('Bericht konnte nicht gespeichert werden: '+error.message);return;}
      form.reset();el('scoutReportDialog').close();await loadAll();switchSection('reports');say('Scoutingbericht wurde gespeichert.');
    });
    el('scoutPhotoInput')?.addEventListener('change',e=>{uploadFiles(e.target.files,'photo');e.target.value='';});
    el('scoutVideoInput')?.addEventListener('change',e=>{uploadFiles(e.target.files,'video');e.target.value='';});
    document.addEventListener('click',e=>{
      const section=e.target.closest('[data-scout-section]');
      if(section){e.preventDefault();e.stopImmediatePropagation();if(el('view-scout-workspace')?.classList.contains('active'))switchSection(section.dataset.scoutSection);else{window.showView?.('scout-workspace',section);switchSection(section.dataset.scoutSection);}return;}
      const close=e.target.closest('[data-scout-close]');if(close){el(close.dataset.scoutClose)?.close();return;}
      const report=e.target.closest('[data-scout-report-for]');if(report){openReport(report.dataset.scoutReportFor);}
    },true);
  }

  function openReport(playerId=''){
    const select=el('scoutReportPlayer');
    select.innerHTML='<option value="">Spieler auswählen</option>'+players.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
    if(playerId)select.value=playerId;
    el('scoutReportDialog').showModal();
  }

  function activateScoutMode(){
    const role=String(window.pfssCurrentRole||'').toLowerCase();
    const isScout=role.includes('scout') && !window.pfssIsRealAdmin;
    if(!isScout)return;
    addWorkspace();addView();
    document.querySelectorAll('.sidebar [data-view]').forEach(node=>{node.hidden=true;});
    const group=el('scoutWorkspaceNav');group.hidden=false;
    document.querySelectorAll('.sidebar .scout-private-nav').forEach(node=>{node.hidden=false;});
    el('view-scout-workspace').classList.add('active');
    document.querySelectorAll('.view').forEach(node=>{if(node.id!=='view-scout-workspace')node.classList.remove('active');});
    switchSection(activeSection);
    if(initializedFor!==window.pfssCurrentUserId){initializedFor=window.pfssCurrentUserId;loadAll();}
  }

  function watch(){
    const shell=el('appShell');
    if(!shell)return;
    new MutationObserver(()=>{if(!shell.classList.contains('hidden')&&window.pfssCurrentUserId)activateScoutMode();}).observe(shell,{attributes:true,attributeFilter:['class']});
    const roleTimer=setInterval(()=>{if(window.pfssCurrentUserId)activateScoutMode();},700);
    setTimeout(()=>clearInterval(roleTimer),12000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{addWorkspace();addView();bind();watch();});
  else {addWorkspace();addView();bind();watch();}
})();
