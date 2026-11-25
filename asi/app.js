const config = window.ASI_CONFIG;
const clientFactory = window.supabase?.createClient;
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const authMessage = document.getElementById("authMessage");
const globalMessage = document.getElementById("globalMessage");
let db = null;
let currentUser = null;
let playerRows = [];
let candidateRows = [];
let activeSection = "overview";

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
  $("userEmail").textContent = user.email || "ASI-Nutzer";
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
  const titles = {overview:"Übersicht",players:"Spielerdatenbank",candidates:"Kandidaten",observations:"Beobachtungen"};
  $("pageTitle").textContent = titles[section] || "ASI";
  if (section === "players") loadPlayers();
  if (section === "candidates") loadCandidates();
  if (section === "observations") populateObservationPlayers();
}
async function loadWorkspace() {
  await Promise.all([loadPlayers(),loadCandidates()]);
  $("statPlayers").textContent = playerRows.length.toLocaleString("de-DE");
  $("statCandidates").textContent = candidateRows.length.toLocaleString("de-DE");
  $("statObservations").textContent = "—";
}
async function loadPlayers() {
  if (!db || !currentUser) return;
  const {data,error} = await db.from("players")
    .select("player_id,name,club,year,positions")
    .order("name",{ascending:true}).limit(500);
  if (error) { message(globalMessage,"Spielerdaten konnten nicht geladen werden: "+error.message,true); return; }
  playerRows = data || [];
  renderPlayers();
  populateObservationPlayers();
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
  host.textContent = "Wikidata-Identitätshinweise werden geladen …";
  const literal = candidate.player_name.replaceAll("\\","\\\\").replaceAll('"','\\"').replace(/[\\r\\n]/g," ");
  const query = 'SELECT ?item ?itemLabel ?birthDate ?nationalityLabel WHERE { ?item wdt:P106 wd:Q937857; rdfs:label ?label. FILTER(LANG(?label) = "en") FILTER(LCASE(STR(?label)) = LCASE("'+literal+'")) OPTIONAL { ?item wdt:P569 ?birthDate. } OPTIONAL { ?item wdt:P27 ?nationality. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de". } } LIMIT 8';
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
  if ((sourceUrl || sourceTitle || sourceText) && (!/^https:\/\//i.test(sourceUrl) || !sourceTitle || !sourceText)) { message(globalMessage,"Für einen Quellenbeleg werden HTTPS-URL, Titel und Belegtext benötigt.",true); return; }
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
    player_id:playerId, owner_id:currentUser.id, created_by:currentUser.id,
    ratings, observation:$("observationText").value.trim() || null, source_type:"internal_scout"
  });
  if (error) { message(globalMessage,"Beobachtung nicht gespeichert: "+error.message,true); return; }
  $("observationForm").reset();
  message(globalMessage,"Scout-Beobachtung wurde gespeichert.");
}
async function initialize() {
  if (!config || !config.url || !config.key || !clientFactory) {
    showAuth("ASI ist noch nicht mit einer freigegebenen Staging-Konfiguration verbunden.");
    $("loginForm").querySelector("button").disabled = true;
    return;
  }
  if (config.projectRef !== "vxtybjaabtfhxfwctnyj") {
    showAuth("Sicherheitsstopp: Die ASI-Konfiguration verweist nicht auf das freigegebene ASI-Projekt.");
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
$("playerSearch").addEventListener("input",renderPlayers);
initialize();
