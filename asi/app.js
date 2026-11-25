import { rankRecruitmentCandidates } from "../asi-core/recruitment-engine.mjs";
import { comparePlayers, forecastTalent, assessTransferOpportunity, generateScoutingReport, analyzeVideoEvents, evaluateScoutCalibration, proposeLearningUpdate } from "../asi-core/intelligence-suite.mjs";
const config = window.MYSCOUTINGDATABASE_CONFIG;
const clientFactory = window.supabase?.createClient;
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const authMessage = document.getElementById("authMessage");
const globalMessage = document.getElementById("globalMessage");
let db = null;
let currentUser = null;
let playerRows = [];
let candidateRows = [];
let observationRows = [];
let videoEventRows = [];
let currentRole = "scout";
let activeSection = "overview";
let lastWikidataResearchAt = 0;

const $ = (id) => document.getElementById(id);
const message = (node, text, isError = false) => {
  node.textContent = text || "";
  node.style.color = isError ? "var(--red)" : "var(--gold2)";
};
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[char]);
const yearNow = new Date().getFullYear();

function showApp(user) {
  currentUser = user;
  authView.hidden = true;
  appView.hidden = false;
  $("userEmail").textContent = user.email || "myScoutingDatabase-Nutzer";
  message(globalMessage, "");
  loadWorkspace();
}
function showAuth(text = "") {
  currentUser = null;
  appView.hidden = true;
  authView.hidden = false;
  message(authMessage, text);
}
function setSection(section) {
  activeSection = section;
  document.querySelectorAll(".section-view").forEach((node) => {
    node.hidden = node.id !== "section-" + section;
  });
  document.querySelectorAll(".nav-item").forEach((node) => {
    node.classList.toggle("active", node.dataset.section === section);
  });
  const titles = {overview:"Übersicht",players:"Spielerdatenbank",candidates:"Kandidaten",observations:"Beobachtungen",intelligence:"KI-Labor"};
  $("pageTitle").textContent = titles[section] || "ASI";
  if (section === "players") loadPlayers();
  if (section === "candidates") loadCandidates();
  if (section === "observations") populateObservationPlayers();
  if (section === "intelligence") loadIntelligenceWorkspace();
}
async function loadWorkspace() {
  await Promise.all([loadPlayers(),loadCandidates(),loadObservationRows(),loadUserRole()]);
  $("statPlayers").textContent = playerRows.length.toLocaleString("de-DE");
  $("statCandidates").textContent = candidateRows.length.toLocaleString("de-DE");
  $("statObservations").textContent = observationRows.length.toLocaleString("de-DE");
}
async function loadPlayers() {
  if (!db || !currentUser) return;
  const {data,error} = await db.from("players")
    .select("player_id,owner_id,name,club,year,positions,foot,ratings")
    .order("name",{ascending:true}).limit(500);
  if (error) { message(globalMessage,"Spielerdaten konnten nicht geladen werden: "+error.message,true); return; }
  playerRows = data || [];
  renderPlayers();
  populateObservationPlayers();
  populateIntelligencePlayers();
  $("statPlayers").textContent = playerRows.length.toLocaleString("de-DE");
}
function renderPlayers() {
  const term = ($("playerSearch")?.value || "").trim().toLocaleLowerCase("de");
  const rows = playerRows.filter((row) => [row.name,row.club,row.year,(row.positions || []).join(" ")].join(" ").toLocaleLowerCase("de").includes(term));
  $("playersBody").innerHTML = rows.length ? rows.map((row) =>
    `<tr><td><strong>${safe(row.name)}</strong></td><td>${safe(row.club || "—")}</td><td>${safe(row.year || "—")}</td><td>${safe((row.positions || []).join(", ") || "—")}</td></tr>`
  ).join("") : '<tr><td colspan="4" class="empty">Keine zugänglichen Spieler gefunden.</td></tr>';
}
async function loadCandidates() {
  if (!db || !currentUser) return;
  const {data,error} = await db.from("asi_player_candidates")
    .select("id,player_name,birth_year,nationality,current_club,positions,recommendation,status,created_at")
    .order("created_at",{ascending:false}).limit(200);
  if (error) { message(globalMessage,"Kandidaten konnten nicht geladen werden: "+error.message,true); return; }
  candidateRows = data || [];
  renderCandidates();
  $("statCandidates").textContent = candidateRows.length.toLocaleString("de-DE");
}
function renderCandidates() {
  $("candidateList").innerHTML = candidateRows.length ? candidateRows.map((row) =>
    `<article class="candidate-card"><div class="candidate-main"><h3>${safe(row.player_name)}</h3><p>${safe([row.birth_year,row.nationality,row.current_club,(row.positions || []).join(", ")].filter(Boolean).join(" · ") || "Noch keine ergänzenden Angaben")}</p><button class="text-button" type="button" data-research-id="${safe(row.id)}">Wikidata-Identität prüfen ↗</button><div id="research-${safe(row.id)}" class="research-result" aria-live="polite"></div></div><span class="candidate-status">${safe(row.status.toUpperCase())} · ${safe(row.recommendation.toUpperCase())}</span></article>`
  ).join("") : '<div class="content-card empty">Noch keine Kandidaten gespeichert.</div>';
  document.querySelectorAll("[data-research-id]").forEach((button)=>button.addEventListener("click",()=>researchCandidate(button.dataset.researchId)));
}
async function researchCandidate(candidateId) {
  const candidate = candidateRows.find((row)=>row.id===candidateId);
  const host = $("research-"+candidateId);
  if (!candidate || !host) return;
  const cooldown = 12000 - (Date.now() - lastWikidataResearchAt);
  if (cooldown > 0) { host.textContent = "Bitte warte " + Math.ceil(cooldown/1000) + " Sekunden bis zur nächsten Recherche."; return; }
  lastWikidataResearchAt = Date.now();
  host.textContent = "Wikidata-Identitätshinweise werden geladen …";
  const literal = candidate.player_name.replaceAll("\\","\\\\").replaceAll('"','\\"').replace(/[\\r\\n]/g," ");
  const query = 'SELECT ?item ?itemLabel ?birthDate ?nationalityLabel WHERE { ?item wdt:P106 wd:Q937857; rdfs:label ?label. FILTER(LANG(?label) IN ("en","de")) FILTER(LCASE(STR(?label)) = LCASE("'+literal+'")) OPTIONAL { ?item wdt:P569 ?birthDate. } OPTIONAL { ?item wdt:P27 ?nationality. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de". } } LIMIT 8';
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query",query); url.searchParams.set("format","json");
  try {
    const response = await fetch(url.toString(),{headers:{Accept:"application/sparql-results+json"},signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error("provider_unavailable");
    const rows = (await response.json())?.results?.bindings || [];
    if (!rows.length) { host.textContent = "Keine exakte Wikidata-Übereinstimmung. Das beweist nicht, dass der Spieler nicht existiert."; return; }
    const norm = (v)=>String(v||"").normalize("NFKC").toLocaleLowerCase("en").replace(/[^\\p{L}\\p{N}]+/gu," ").trim();
    host.innerHTML = '<p class="research-disclaimer">Unbestätigte Hinweise · CC0 · keine automatische Zuordnung oder Speicherung</p>'+rows.map((row)=>{
      const label=row.itemLabel?.value||candidate.player_name; const exact=norm(label)===norm(candidate.player_name);
      const birth=row.birthDate?.value?new Date(row.birthDate.value).toLocaleDateString("de-DE"):"Geburtsdatum unbekannt";
      const nation=row.nationalityLabel?.value||"Nationalität unbekannt"; const entity=row.item?.value||"https://www.wikidata.org/";
      return '<div class="research-hit"><div><strong>'+safe(label)+'</strong><small>'+safe(birth)+' · '+safe(nation)+'</small><small>'+(exact?"Namensgleichheit – Identität nicht bestätigt":"Mehrdeutiger Treffer")+'</small></div><a href="'+safe(entity)+'" target="_blank" rel="noopener noreferrer">Quelle ↗</a></div>';
    }).join("");
  } catch { host.textContent = "Wikidata-Recherche aktuell nicht verfügbar. Bitte später erneut versuchen."; }
}
async function addCandidate(event) {
  event.preventDefault();
  const name = $("candidateName").value.trim();
  const yearValue = $("candidateYear").value;
  const birthYear = yearValue ? Number(yearValue) : null;
  if (!name || (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > yearNow))) {
    message(globalMessage,"Bitte Spielername und ein gültiges Geburtsjahr prüfen.",true); return;
  }
  const positions = $("candidatePositions").value.split(/[,;/]+/).map((item)=>item.trim()).filter(Boolean).slice(0,6);
  const note = $("candidateNotes").value.trim();
  const sourceUrl = $("candidateSourceUrl").value.trim();
  const sourceTitle = $("candidateSourceTitle").value.trim();
  const sourceText = $("candidateSourceText").value.trim();
  if (sourceUrl || sourceTitle || sourceText) {
    let validHttps = false;
    try { validHttps = new URL(sourceUrl).protocol === "https:"; } catch { validHttps = false; }
    if (!validHttps || !sourceTitle || !sourceText) { message(globalMessage,"Für einen Quellenbeleg werden eine gültige HTTPS-URL, ein Titel und Belegtext benötigt.",true); return; }
  }
  const payload = {
    owner_id: currentUser.id, created_by: currentUser.id, player_name: name,
    birth_year: birthYear, nationality: $("candidateNationality").value.trim() || null,
    current_club: $("candidateClub").value.trim() || null, positions,
    search_query: note || null, analysis: {entry_method:"manual",note,methodology:"candidate_intake_v1"},
    sources: sourceUrl ? [{url:sourceUrl,title:sourceTitle,status:"pending_review"}] : [], recommendation:"review", status:"saved"
  };
  const {data:saved,error} = await db.from("asi_player_candidates").insert(payload).select("id").single();
  if (error) { message(globalMessage,"Kandidat nicht gespeichert: "+error.message,true); return; }
  let evidenceWarning = "";
  if (sourceUrl) {
    const {error:evidenceError} = await db.from("asi_candidate_evidence").insert({candidate_id:saved.id,owner_id:currentUser.id,created_by:currentUser.id,source_name:new URL(sourceUrl).hostname,source_type:"external_reference",source_url:sourceUrl,claim_type:"identity_reference",claim_title:sourceTitle,claim_text:sourceText,evidence_excerpt:sourceText.slice(0,1200),identity_status:"pending",verification_status:"unconfirmed",data_classification:"ordinary",legal_review_status:"not_approved",review_status:"pending"});
    if (evidenceError) evidenceWarning = " Kandidat gespeichert, Quellenbeleg aber nicht. Die ASI-Evidence-Migration muss zuerst bereitgestellt werden.";
  }
  $("candidateForm").reset();
  message(globalMessage,"Kandidat wurde im geschützten Arbeitsbereich gespeichert."+evidenceWarning,Boolean(evidenceWarning));
  await loadCandidates();
}
function populateObservationPlayers() {
  const select = $("observationPlayer");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Spieler auswählen …</option>' + playerRows.map((row) =>
    `<option value="${safe(row.player_id)}">${safe(row.name)} · ${safe(row.club || "ohne Verein")}</option>`
  ).join("");
  if (current && playerRows.some((row)=>String(row.player_id)===current)) select.value = current;
}
async function addObservation(event) {
  event.preventDefault();
  const playerId = Number($("observationPlayer").value);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) { message(globalMessage,"Bitte einen Spieler auswählen.",true); return; }
  const selected=selectedPlayer(playerId);
  if(!selected){message(globalMessage,"Spieler ist im zugänglichen Bestand nicht verfügbar.",true);return;}
  const ratings = {};
  for (const [field,key] of [["ratingTechnical","technical"],["ratingTactical","tactical"],["ratingPhysical","physical"],["ratingMental","mental"]]) {
    const raw = $(field).value;
    if (raw !== "") {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1 || value > 10) { message(globalMessage,"Bewertungen müssen zwischen 1 und 10 liegen.",true); return; }
      ratings[key] = value;
    }
  }
  const {error} = await db.from("asi_player_observations").insert({
    player_id:playerId, owner_id:selected.owner_id, created_by:currentUser.id,
    ratings, observation:$("observationText").value.trim() || null, source_type:"internal_scout"
  });
  if (error) { message(globalMessage,"Beobachtung nicht gespeichert: "+error.message,true); return; }
  $("observationForm").reset();
  await loadObservationRows();
  message(globalMessage,"Scout-Beobachtung wurde gespeichert.");
}

async function loadUserRole() {
  if (!db || !currentUser) return;
  const {data} = await db.from("profiles").select("role").eq("id",currentUser.id).maybeSingle();
  currentRole = data?.role === "admin" ? "admin" : "scout";
}
async function loadObservationRows() {
  if (!db || !currentUser) return;
  const {data,error} = await db.from("asi_player_observations")
    .select("id,player_id,owner_id,created_by,observed_on,ratings,observation")
    .order("observed_on",{ascending:true}).limit(3000);
  if (error) { message(globalMessage,"Beobachtungen konnten nicht geladen werden: "+error.message,true); return; }
  observationRows = data || [];
  if ($("statObservations")) $("statObservations").textContent = observationRows.length.toLocaleString("de-DE");
}
function populateIntelligencePlayers() {
  for (const id of ["intelligencePlayer","comparePlayerA","comparePlayerB","videoPlayer","calibrationPlayer"]) {
    const select=$(id); if(!select) continue;
    const previous=select.value;
    select.innerHTML='<option value="">Spieler auswählen …</option>'+playerRows.map(p=>'<option value="'+safe(p.player_id)+'">'+safe(p.name)+' · '+safe(p.club||"ohne Verein")+'</option>').join("");
    if(previous && playerRows.some(p=>String(p.player_id)===previous)) select.value=previous;
  }
}
function average(values) {
  const valid=values.filter(v=>Number.isFinite(v)&&v>=1&&v<=10);
  return valid.length ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length*10*10)/10 : null;
}
function playerSignal(player) {
  const rows=observationRows.filter(o=>Number(o.player_id)===Number(player.player_id));
  const dims={};
  const tech=average(rows.map(o=>Number(o.ratings?.technical)));
  const tact=average(rows.map(o=>Number(o.ratings?.tactical)));
  const phys=average(rows.map(o=>Number(o.ratings?.physical)));
  if(tech!==null) dims.performance=tech;
  if(tact!==null) dims.tacticalFit=tact;
  if(phys!==null) dims.physicalFit=phys;
  return {
    id:player.player_id,name:player.name,sourceScope:"internal",
    age:/^\d{4}$/.test(String(player.year||""))?yearNow-Number(player.year):undefined,
    positions:player.positions||[],preferredFoot:player.foot||null,dimensions:dims,
    scoutAssessments:rows.map(o=>({scoutId:o.created_by,rating:null,observedAt:o.observed_on,note:o.observation||null})),
    evidenceQuality:{sampleAdequacy:Math.min(100,rows.length*15)},
    observations:rows
  };
}
function selectedPlayer(id) { return playerRows.find(p=>String(p.player_id)===String(id)); }
async function loadIntelligenceWorkspace() {
  if(!db||!currentUser) return;
  await Promise.all([loadObservationRows(),loadVideoEvents()]);
  populateIntelligencePlayers();
  renderIntelligenceOverview();
  await loadPredictionOptions();
  await loadCalibrationQueue();
}
function renderIntelligenceOverview() {
  const target=$("intelligenceOverview");
  if(!target) return;
  const withSignals=playerRows.map(playerSignal).filter(p=>Object.keys(p.dimensions).length);
  const ranked=rankRecruitmentCandidates(withSignals);
  target.innerHTML='<div class="intel-metrics"><div><strong>'+withSignals.length+'</strong><small>Spieler mit bewertbaren Beobachtungen</small></div><div><strong>'+observationRows.length+'</strong><small>Geladene Beobachtungen</small></div><div><strong>'+videoEventRows.length+'</strong><small>Getaggte Videoereignisse</small></div></div>'+
    (ranked.length?'<div class="table-wrap"><table><thead><tr><th>RANG</th><th>SPIELER</th><th>EIGNUNG</th><th>DATENABDECKUNG</th><th>HINWEIS</th></tr></thead><tbody>'+ranked.slice(0,12).map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+safe(r.playerName)+'</td><td>'+(r.suitabilityScore===null?"—":r.suitabilityScore.toFixed(1)+"/100")+'</td><td>'+r.dataCoverage+'%</td><td>'+safe(r.warnings.join(" · ")||"Aus vorhandenen Scout-Beobachtungen berechnet")+'</td></tr>').join("")+'</tbody></table></div>':'<p class="empty">Noch keine bewertbaren Beobachtungen vorhanden. Fehlende Werte werden nicht ergänzt.</p>');
}
async function runPlayerAnalysis() {
  const player=selectedPlayer($("intelligencePlayer").value);
  if(!player){message(globalMessage,"Bitte zuerst einen Spieler auswählen.",true);return;}
  const signal=playerSignal(player);
  if(!Object.keys(signal.dimensions).length){message(globalMessage,"Für diesen Spieler liegen noch keine auswertbaren Technik-, Taktik- oder Physis-Beobachtungen vor.",true);return;}
  const ranked=rankRecruitmentCandidates([signal])[0];
  const scores=signal.observations.map(o=>{
    const values=["technical","tactical","physical"].map(k=>Number(o.ratings?.[k])).filter(v=>Number.isFinite(v)&&v>=1&&v<=10);
    return values.length?{score:values.reduce((a,b)=>a+b,0)/values.length*10,observedAt:o.observed_on}:null;
  }).filter(Boolean);
  const development=forecastTalent(scores);
  let predictionId=null,predictionWarning="";
  if(development.available){
    const horizonDays=Math.max(1,Math.round(development.horizonMonths*30.4375));
    const {data:prediction,error:predictionError}=await db.from("asi_prediction_records").insert({
      player_id:player.player_id,owner_id:player.owner_id,created_by:currentUser.id,
      target_metric:"development_score_0_100",prediction_horizon_days:horizonDays,
      predicted_value:development.projectedScore,
      prediction_interval_low:Math.max(0,development.projectedScore-development.errorBand),
      prediction_interval_high:Math.min(100,development.projectedScore+development.errorBand),
      model_version:"myscouting-trend-v1",input_cutoff_at:new Date().toISOString(),status:"pending",
      explanation:{method:development.method,features:signal.dimensions,sampleSize:development.sampleSize,periodMonths:development.periodMonths,confidence:development.confidence,horizonMonths:development.horizonMonths}
    }).select("id").single();
    if(predictionError) predictionWarning=" Prognose wurde berechnet, konnte aber nicht gespeichert werden: "+predictionError.message;
    else predictionId=prediction.id;
  }
  const report=generateScoutingReport({id:player.player_id,name:player.name,age:signal.age,positions:player.positions||[],dimensions:signal.dimensions,suitabilityScore:ranked.suitabilityScore,risks:ranked.warnings},{development:[development],evidence:signal.observations.map(o=>({title:"Scout-Beobachtung "+o.observed_on,sourceUrl:null,status:"intern dokumentiert",claim:o.observation||"Bewertungseintrag"}))});
  const costRaw=$("transferCost").value,budgetRaw=$("transferBudget").value;
  const transfer=costRaw?assessTransferOpportunity({suitabilityScore:ranked.suitabilityScore,estimatedCost:Number(costRaw),evidenceConfidence:ranked.evidenceConfidence.score??0},{budget:budgetRaw?Number(budgetRaw):undefined,currency:"EUR"}):{available:false,reason:"Keine Kostenschätzung eingetragen."};
  const payload={analysis_type:"intelligence_suite_v1",model_version:"myscouting-intelligence-suite-v1",analysis_json:{ranking:ranked,development,transfer,report,predictionId},input_snapshot:{player:{player_id:player.player_id,name:player.name,year:player.year,positions:player.positions},observation_ids:signal.observations.map(o=>o.id),observation_count:signal.observations.length}};
  const {error}=await db.from("asi_player_analyses").insert({...payload,player_id:player.player_id,owner_id:player.owner_id,created_by:currentUser.id});
  if(error){message(globalMessage,"Analyse berechnet, aber Snapshot nicht gespeichert: "+error.message+predictionWarning,true);}else{message(globalMessage,"KI-Analyse als Snapshot gespeichert."+(predictionId?" Prognose-ID: "+predictionId+".":"")+predictionWarning,Boolean(predictionWarning));}
  $("intelligenceResult").innerHTML='<div class="content-card"><div class="card-heading"><h3>'+safe(player.name)+'</h3><span class="pill">ENTSCHEIDUNGSUNTERSTÜTZUNG</span></div><div class="intel-metrics"><div><strong>'+(ranked.suitabilityScore===null?"—":ranked.suitabilityScore.toFixed(1))+'</strong><small>Eignung / 100</small></div><div><strong>'+ranked.dataCoverage+'%</strong><small>Datenabdeckung</small></div><div><strong>'+(development.available?development.projectedScore.toFixed(1):"—")+'</strong><small>Trendprojektion'+(development.available?" · "+development.horizonMonths+" Monate":"")+'</small></div></div><p class="muted">'+safe(report.executiveSummary)+'</p><p class="muted">'+safe(development.available?development.method+"; Konfidenz: "+development.confidence:development.reason)+'</p><p class="muted">'+safe(transfer.available?transfer.recommendation+" · "+transfer.opportunityScore+"/100":transfer.reason)+'</p><h4>Beobachtete Dimensionen</h4><ul>'+Object.entries(signal.dimensions).map(([k,v])=>'<li>'+safe(k)+': '+v+'/100</li>').join("")+'</ul><h4>Hinweise</h4><ul>'+ranked.warnings.map(w=>'<li>'+safe(w)+'</li>').join("")+'</ul><p class="tiny-note">Projektion ist keine Karrieregarantie. Nur vorhandene Scout-Daten wurden ausgewertet.</p></div>';
  await loadPredictionOptions();
}
function runPlayerComparison() {
  const a=selectedPlayer($("comparePlayerA").value),b=selectedPlayer($("comparePlayerB").value);
  if(!a||!b){message(globalMessage,"Bitte zwei Spieler auswählen.",true);return;}
  const result=comparePlayers(playerSignal(a),playerSignal(b),["performance","tacticalFit","physicalFit"]);
  $("comparisonResult").innerHTML='<div class="content-card"><h3>'+safe(a.name)+' vs. '+safe(b.name)+'</h3><p class="muted">Datenabdeckung: '+result.coverage+'% · Ergebnis: '+safe(result.winnerByAvailableDimensions)+'</p><div class="table-wrap"><table><thead><tr><th>DIMENSION</th><th>'+safe(a.name)+'</th><th>'+safe(b.name)+'</th><th>DIFFERENZ</th></tr></thead><tbody>'+result.comparisons.map(x=>'<tr><td>'+safe(x.dimension)+'</td><td>'+(x.left??"—")+'</td><td>'+(x.right??"—")+'</td><td>'+(x.difference===null?"—":x.difference)+'</td></tr>').join("")+'</tbody></table></div><p class="tiny-note">Nur gemeinsame, vorhandene Beobachtungsdimensionen werden verglichen. Ein Ergebnis ist keine absolute Spielerqualität.</p></div>';
}
async function loadPredictionOptions() {
  const select=$("outcomePrediction");if(!select||!db)return;
  const playerId=Number($("intelligencePlayer").value);
  select.innerHTML='<option value="">Prognose auswählen …</option>';
  if(!Number.isSafeInteger(playerId)||playerId<=0)return;
  const {data:predictions,error}=await db.from("asi_prediction_records").select("id,target_metric,predicted_value,prediction_horizon_days,created_at").eq("player_id",playerId).order("created_at",{ascending:false}).limit(100);
  if(error){message(globalMessage,"Prognosen konnten nicht geladen werden: "+error.message,true);return;}
  const ids=(predictions||[]).map(p=>p.id);
  const {data:outcomes}=ids.length?await db.from("asi_prediction_outcomes").select("prediction_id").in("prediction_id",ids):{data:[]};
  const used=new Set((outcomes||[]).map(o=>o.prediction_id));
  const available=(predictions||[]).filter(p=>!used.has(p.id));
  select.innerHTML='<option value="">Prognose auswählen …</option>'+available.map(p=>'<option value="'+safe(p.id)+'" data-metric="'+safe(p.target_metric)+'">'+safe(p.target_metric)+' · Prognose '+safe(p.predicted_value)+' · '+p.prediction_horizon_days+' Tage</option>').join("");
}
async function addPredictionOutcome(event) {
  event.preventDefault();
  const predictionId=$("outcomePrediction").value,option=$("outcomePrediction").selectedOptions[0],metric=option?.dataset.metric;
  const value=Number($("outcomeValue").value),date=$("outcomeDate").value,source=$("outcomeSource").value.trim();
  if(!predictionId||!metric||!Number.isFinite(value)||value<0||value>100||!date||!source){message(globalMessage,"Prognose, Ergebniswert (0–100), Datum und Quellenbezeichnung sind erforderlich.",true);return;}
  const {data:prediction,error:predictionError}=await db.from("asi_prediction_records").select("player_id,owner_id").eq("id",predictionId).single();
  if(predictionError||!prediction){message(globalMessage,"Zugehörige Prognose konnte nicht geladen werden.",true);return;}
  const {error}=await db.from("asi_prediction_outcomes").insert({prediction_id:predictionId,player_id:prediction.player_id,owner_id:prediction.owner_id,observed_metric:metric,observed_value:value,observed_on:date,outcome_source:source,notes:$("outcomeNotes").value.trim()||null,recorded_by:currentUser.id});
  if(error){message(globalMessage,"Ergebnis konnte nicht gespeichert werden: "+error.message,true);return;}
  $("outcomeForm").reset();await loadPredictionOptions();message(globalMessage,"Ergebnis gespeichert und wartet auf administrative Quellenprüfung.");
}
async function loadVideoEvents() {
  if(!db||!currentUser) return;
  const {data,error}=await db.from("asi_video_event_tags").select("id,player_id,minute,event_type,zone,outcome,verification_status,match_date,opponent").order("created_at",{ascending:false}).limit(500);
  if(error){message(globalMessage,"Videoereignisse konnten nicht geladen werden: "+error.message,true);return;}
  videoEventRows=data||[];
  if($("videoEventList")) renderVideoEvents();
}
function renderVideoEvents() {
  const host=$("videoEventList");if(!host)return;
  const analysis=analyzeVideoEvents(videoEventRows.map(e=>({minute:Number(e.minute),type:e.event_type,playerId:e.player_id,zone:e.zone,outcome:e.outcome,verified:e.verification_status==="verified"})));
  const summary=Object.entries(analysis.eventCounts).map(([key,value])=>key+": "+value).join(" · ");
  host.innerHTML='<p class="tiny-note">Auswertung: '+analysis.eventCount+' gültige Ereignisse · '+analysis.verifiedEventCoverage+'% bestätigt · '+safe(summary||"Noch keine Ereignistypen")+'</p>'+
    (videoEventRows.length?videoEventRows.slice(0,30).map(e=>{const p=selectedPlayer(e.player_id);const review=currentRole==="admin"&&e.verification_status==="pending"?'<input type="text" maxlength="500" placeholder="Prüfgrund (mind. 10 Zeichen)" data-video-reason="'+safe(e.id)+'"><button class="text-button" type="button" data-video-review="'+safe(e.id)+'">Als geprüft markieren</button>':"";return '<div class="research-hit"><div><strong>'+safe(p?.name||("Spieler #"+e.player_id))+' · '+safe(e.event_type)+'</strong><small>'+safe(e.match_date||"Datum offen")+' · '+safe(e.opponent||"Gegner offen")+' · '+e.minute+'′ · '+safe(e.zone||"Zone offen")+'</small></div><span class="candidate-status">'+safe(e.verification_status)+'</span></div>'+review;}).join(""):'<p class="empty">Noch keine Videoereignisse erfasst.</p>');
  host.querySelectorAll("[data-video-review]").forEach(button=>button.addEventListener("click",async()=>{
    const id=button.dataset.videoReview,reason=host.querySelector('[data-video-reason="'+id+'"]')?.value;
    if(!reason||reason.trim().length<10){message(globalMessage,"Prüfgrund mit mindestens 10 Zeichen erforderlich.",true);return;}
    const {error}=await db.rpc("asi_review_video_event",{p_event_id:id,p_decision:"verify",p_reason:reason});
    if(error){message(globalMessage,"Videoereignis-Prüfung fehlgeschlagen: "+error.message,true);return;}
    message(globalMessage,"Videoereignis wurde verifiziert.");await loadVideoEvents();
  }));
}
async function addVideoEvent(event) {
  event.preventDefault();
  const playerId=Number($("videoPlayer").value),minute=Number($("videoMinute").value),source=$("videoSourceUrl").value.trim();
  const player=selectedPlayer(playerId);
  if(!Number.isSafeInteger(playerId)||playerId<=0||!player||!Number.isFinite(minute)||minute<0||minute>150){message(globalMessage,"Spieler und Spielminute prüfen.",true);return;}
  if(source){try{if(new URL(source).protocol!=="https:")throw new Error();}catch{message(globalMessage,"Quellenlink muss HTTPS verwenden.",true);return;}}
  const {error}=await db.from("asi_video_event_tags").insert({player_id:playerId,owner_id:player.owner_id,created_by:currentUser.id,match_date:$("videoDate").value||null,competition:$("videoCompetition").value.trim()||null,opponent:$("videoOpponent").value.trim()||null,minute,event_type:$("videoEventType").value,zone:$("videoZone").value.trim()||null,outcome:$("videoOutcome").value.trim()||null,source_url:source||null,notes:$("videoNotes").value.trim()||null,verification_status:"pending"});
  if(error){message(globalMessage,"Videoereignis konnte nicht gespeichert werden: "+error.message,true);return;}
  $("videoEventForm").reset();await loadVideoEvents();message(globalMessage,"Spielereignis gespeichert. Es bleibt bis zur Prüfung unbestätigt.");
}
async function addCalibrationRecord(event) {
  event.preventDefault();
  const playerId=Number($("calibrationPlayer").value),rating=Number($("calibrationRating").value),metric=$("calibrationMetric").value.trim();
  const player=selectedPlayer(playerId);
  if(!Number.isSafeInteger(playerId)||playerId<=0||!player||!Number.isFinite(rating)||rating<0||rating>100||!metric){message(globalMessage,"Spieler, Scout-Bewertung (0–100) und Ergebniskennzahl angeben.",true);return;}
  const {error}=await db.from("asi_scout_calibration_records").insert({player_id:playerId,owner_id:player.owner_id,scout_id:currentUser.id,created_by:currentUser.id,scout_rating:rating,outcome_metric:metric,verification_status:"pending"});
  if(error){message(globalMessage,"Kalibrierungsdatensatz nicht gespeichert: "+error.message,true);return;}
  $("calibrationForm").reset();message(globalMessage,"Scout-Einschätzung gespeichert. Ein Administrator muss das spätere Ergebnis mit Quelle verifizieren.");await loadCalibrationQueue();
}
async function loadCalibrationQueue() {
  const host=$("calibrationQueue");if(!host||!db||!currentUser)return;
  const {data,error}=await db.from("asi_scout_calibration_records").select("id,player_id,scout_id,scout_rating,verified_outcome,outcome_metric,verification_status,created_at").order("created_at",{ascending:false}).limit(100);
  if(error){host.textContent="Kalibrierungsdaten nicht verfügbar.";return;}
  const rows=data||[];
  const calibration=evaluateScoutCalibration(rows.map(r=>({scoutId:r.scout_id,rating:Number(r.scout_rating),verifiedOutcome:r.verified_outcome===null?null:Number(r.verified_outcome),outcomeVerified:r.verification_status==="verified"})));
  const scoreMarkup=calibration.filter(x=>x.evaluable).map(x=>'<p class="tiny-note">Scout '+safe(x.scoutId)+': Kalibrierung '+x.calibrationScore+'/100 · '+safe(x.tendency)+' · '+x.sampleSize+' verifizierte Fälle</p>').join("");
  if(currentRole!=="admin"){host.innerHTML=scoreMarkup+'<p class="tiny-note">Deine Einträge werden erst nach einer Admin-Verifizierung für die Kalibrierung berücksichtigt.</p>';return;}
  host.innerHTML=scoreMarkup+rows.filter(r=>r.verification_status==="pending").map(r=>'<div class="calibration-review"><strong>'+safe(selectedPlayer(r.player_id)?.name||("Spieler #"+r.player_id))+'</strong><small>Scout-Bewertung '+r.scout_rating+'/100 · '+safe(r.outcome_metric)+'</small><input type="number" min="0" max="100" step="0.1" placeholder="Verifiziertes Ergebnis" data-outcome="'+safe(r.id)+'"><input type="date" data-date="'+safe(r.id)+'"><input type="url" placeholder="HTTPS-Quellenlink" data-source="'+safe(r.id)+'"><input type="text" placeholder="Prüfgrund (mind. 10 Zeichen)" data-reason="'+safe(r.id)+'"><button class="text-button" type="button" data-verify="'+safe(r.id)+'">Ergebnis verifizieren</button></div>').join("")||'<p class="empty">Keine offenen Kalibrierungsprüfungen.</p>';
  host.querySelectorAll("[data-verify]").forEach(button=>button.addEventListener("click",async()=>{
    const id=button.dataset.verify,read=(selector)=>host.querySelector(selector)?.value;
    const outcome=Number(read('[data-outcome="'+id+'"]')),date=read('[data-date="'+id+'"]'),source=read('[data-source="'+id+'"]'),reason=read('[data-reason="'+id+'"]');
    if(!Number.isFinite(outcome)||!date||!source||!reason||reason.trim().length<10){message(globalMessage,"Ergebnis, Datum, HTTPS-Quelle und Prüfgrund (mind. 10 Zeichen) erforderlich.",true);return;}
    const {error}=await db.rpc("asi_review_scout_calibration",{p_record_id:id,p_decision:"verify",p_reason:reason,p_verified_outcome:outcome,p_observed_on:date,p_source_url:source});
    if(error){message(globalMessage,"Verifizierung fehlgeschlagen: "+error.message,true);return;}
    message(globalMessage,"Kalibrierungsergebnis wurde verifiziert.");await loadCalibrationQueue();
  }));
}

async function renderPendingOutcomeReviews() {
  const {data,error}=await db.from("asi_prediction_outcomes").select("id,prediction_id,observed_metric,observed_value,observed_on,outcome_source").eq("verification_status","pending").limit(50);
  if(error||!data?.length)return '<p class="tiny-note">Keine offenen Ergebnisprüfungen.</p>';
  return '<h4>Offene Ergebnisverifizierungen</h4>'+data.map(o=>'<div class="calibration-review"><strong>'+safe(o.observed_metric)+' · '+safe(o.outcome_source)+'</strong><small>Beobachtet: '+safe(o.observed_value)+' am '+safe(o.observed_on)+'</small><input type="url" placeholder="HTTPS-Quellenlink" data-outcome-source="'+safe(o.id)+'"><input type="text" placeholder="Prüfgrund (mind. 10 Zeichen)" data-outcome-reason="'+safe(o.id)+'"><button class="text-button" type="button" data-outcome-verify="'+safe(o.id)+'">Ergebnis verifizieren</button></div>').join("");
}

async function showLearningPreview() {
  const host=$("learningPreview");if(!host||!db)return;
  const {data:predictions,error:pError}=await db.from("asi_prediction_records").select("id,target_metric,predicted_value,explanation,status").limit(1000);
  const {data:outcomes,error:oError}=await db.from("asi_prediction_outcomes").select("id,prediction_id,observed_metric,observed_value,outcome_source,verification_status").limit(1000);
  if(pError||oError){host.textContent="Lerndaten konnten nicht geladen werden.";return;}
  const pairs=(predictions||[]).flatMap(p=>(outcomes||[]).filter(o=>o.prediction_id===p.id&&o.observed_metric===p.target_metric&&Number.isFinite(Number(o.observed_value))&&Number.isFinite(Number(p.predicted_value))).map(o=>({predicted:Number(p.predicted_value),observed:Number(o.observed_value),outcomeObserved:o.verification_status==="verified",features:p.explanation?.features||{}})));
  const current={performance:.24,tacticalFit:.26,potential:.18,scoutAssessment:.14,economicFit:.10,physicalFit:.08};
  const proposal=proposeLearningUpdate(pairs,current);
  host.innerHTML='<p class="muted">Verifizierte Prognose-/Ergebnispaare: '+pairs.filter(x=>x.outcomeObserved).length+'</p><p class="muted">'+safe(proposal.available?"Lernvorschlag verfügbar – Freigabe erforderlich.":proposal.reason)+'</p><p class="tiny-note">Es wird kein Modell automatisch geändert. Nur administrativ verifizierte Ergebnisse dürfen in den Lernvorschlag eingehen.</p>'+
    (currentRole==="admin"?await renderPendingOutcomeReviews():"");
  host.querySelectorAll("[data-outcome-verify]").forEach(button=>button.addEventListener("click",async()=>{
    const id=button.dataset.outcomeVerify,source=host.querySelector('[data-outcome-source="'+id+'"]')?.value,reason=host.querySelector('[data-outcome-reason="'+id+'"]')?.value;
    if(!source||!reason||reason.trim().length<10){message(globalMessage,"HTTPS-Quelle und Prüfgrund (mind. 10 Zeichen) erforderlich.",true);return;}
    const {error}=await db.rpc("asi_review_prediction_outcome",{p_outcome_id:id,p_decision:"verify",p_reason:reason,p_source_url:source});
    if(error){message(globalMessage,"Ergebnisverifizierung fehlgeschlagen: "+error.message,true);return;}
    message(globalMessage,"Prognoseergebnis wurde verifiziert.");await showLearningPreview();
  }));
}
async function initialize() {
  if (!config || !config.url || !config.key || !clientFactory) {
    showAuth("myScoutingDatabase ist noch nicht mit einer freigegebenen Staging-Konfiguration verbunden.");
    $("loginForm").querySelector("button").disabled = true;
    return;
  }
  if (config.projectRef !== "vxtybjaabtfhxfwctnyj") {
    showAuth("Sicherheitsstopp: Die myScoutingDatabase-Konfiguration verweist nicht auf das freigegebene myScoutingDatabase-Projekt.");
    $("loginForm").querySelector("button").disabled = true;
    return;
  }
  db = clientFactory(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error} = await db.auth.getSession();
  if (error) { showAuth("Sitzung konnte nicht geprüft werden."); return; }
  if (data.session?.user) showApp(data.session.user); else showAuth();
  db.auth.onAuthStateChange((_event,session) => {
    if (session?.user) showApp(session.user); else showAuth();
  });
}
$("loginForm").addEventListener("submit",async(event)=>{
  event.preventDefault();
  if (!db) return;
  const {error} = await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if (error) message(authMessage,"Anmeldung fehlgeschlagen. Zugangsdaten oder Kontofreigabe prüfen.",true);
});
$("forgotPassword").addEventListener("click",async()=>{
  if (!db) return;
  const email = $("email").value.trim();
  if (!email) { message(authMessage,"Bitte zuerst deine E-Mail-Adresse eintragen.",true); return; }
  const redirectTo = new URL("./",window.location.href).toString();
  const {error} = await db.auth.resetPasswordForEmail(email,{redirectTo});
  message(authMessage,error ? "Die Anfrage konnte nicht gesendet werden." : "Falls ein Konto existiert, wurde eine Anleitung zum Zurücksetzen angefordert.",Boolean(error));
});
$("logoutButton").addEventListener("click",async()=>{ if(db) await db.auth.signOut(); });
document.querySelectorAll(".nav-item").forEach((node)=>node.addEventListener("click",()=>setSection(node.dataset.section)));
$("candidateForm").addEventListener("submit",addCandidate);
$("observationForm").addEventListener("submit",addObservation);
$("intelligenceRun")?.addEventListener("click",runPlayerAnalysis);
$("compareRun")?.addEventListener("click",runPlayerComparison);
$("videoEventForm")?.addEventListener("submit",addVideoEvent);
$("calibrationForm")?.addEventListener("submit",addCalibrationRecord);
$("learningRefresh")?.addEventListener("click",showLearningPreview);
$("intelligencePlayer")?.addEventListener("change",loadPredictionOptions);
$("outcomeForm")?.addEventListener("submit",addPredictionOutcome);
$("playerSearch").addEventListener("input",renderPlayers);
initialize();
