/* PFSS Finance & Administration — visual foundation only.
   No accounting entries, payroll calculations, bank transfers or tax submissions are performed. */
(() => {
  'use strict';
  const groups = [
    {name:'FINANCE CORE',items:[
      ['finance-dashboard','Finance-Dashboard','◈','Finanzstatus, Liquidität und offene Vorgänge'],
      ['finance-income','Einnahmen & Beiträge','＋','Mitgliedsbeiträge, Sponsoring, Spenden und Erlöse'],
      ['finance-expenses','Ausgaben & Kosten','−','Ausgaben, Lieferanten und Kostenstellen'],
      ['finance-invoices','Rechnungen','▤','Ausgangs- und Eingangsrechnungen'],
      ['finance-payments','Zahlungen & Offene Posten','⇄','Forderungen, Verbindlichkeiten und Mahnwesen'],
      ['finance-bank','Bank & Zahlungsverkehr','▣','Konten, Bankumsätze und Zahlungsabgleich'],
      ['finance-budgets','Budgets & Kostenstellen','▦','Planung nach Abteilung, Mannschaft und Projekt']
    ]},
    {name:'PERSONAL & SPORT',items:[
      ['finance-employees','Mitarbeiterverwaltung','♟','Personalstammdaten, Verträge und Beschäftigung'],
      ['finance-payroll','Lohn & Gehalt','€','Vergütungsübersicht und Payroll-Übergabe'],
      ['finance-coaches','Trainer & Übungsleiter','⚽','Trainerverträge, Honorare und Pauschalen'],
      ['finance-expenses-travel','Spesen & Reisekosten','⌁','Kilometer, Reisen, Belege und Erstattungen'],
      ['finance-membership','Mitglieder & Beiträge','♙','Beitragsgruppen, Forderungen und SEPA-Vorbereitung']
    ]},
    {name:'BUCHHALTUNG & STEUERN',items:[
      ['finance-journal','Buchungsjournal','≡','Buchungssätze, Soll und Haben'],
      ['finance-accounts','Konten & Kontenrahmen','▦','Sachkonten, Debitoren und Kreditoren'],
      ['finance-tax','Steuern & Tax Compliance','⚖','Steuerprofile, Fristen und Prüfhinweise'],
      ['finance-npo','Verein: Steuerliche Sphären','◇','Ideeller Bereich, Vermögensverwaltung, Zweckbetrieb und Geschäftsbetrieb'],
      ['finance-documents','Belege & Dokumente','▧','Digitale Belegablage und Dokumentenprüfung'],
      ['finance-reports','Finanzberichte & DATEV','▥','Auswertungen, Exporte und Steuerberaterzugang'],
      ['finance-approvals','Freigaben & Prüfprotokoll','✓','Vier-Augen-Prinzip und nachvollziehbare Vorgänge']
    ]}
  ];
  const demo = {
    'finance-income':[['Mitgliedsbeiträge','Beiträge','12.450,00 €','Monatlich','Beispieldaten'],['Hauptsponsor','Sponsoring','8.000,00 €','Saison 2026/27','Beispieldaten'],['Fördermittel','Zuschuss','3.500,00 €','Projekt','Beispieldaten']],
    'finance-expenses':[['Sportausrüstung','Material','2.480,00 €','Jugend','Beispieldaten'],['Platzpflege','Betrieb','1.250,00 €','Sportanlage','Beispieldaten'],['Trainerhonorare','Personal','4.200,00 €','U19','Beispieldaten']],
    'finance-invoices':[['RE-2026-001','Sportbedarf GmbH','2.480,00 €','15.11.2026','Entwurf'],['RE-2026-002','Stadtwerke','680,00 €','20.11.2026','Offen']],
    'finance-payments':[['Mitglied Familie M.','Forderung','240,00 €','10.11.2026','Offen'],['Ausrüster GmbH','Verbindlichkeit','1.200,00 €','14.11.2026','Prüfung']],
    'finance-bank':[['Vereinskonto','DEMO ·•• 4821','28.450,00 €','12.11.2026','Nicht verbunden'],['Rücklagenkonto','DEMO ·•• 1055','12.000,00 €','12.11.2026','Nicht verbunden']],
    'finance-budgets':[['1. Herren','Sportbetrieb','35.000,00 €','21.400,00 €','61 %'],['Jugend','Nachwuchs','48.000,00 €','29.200,00 €','61 %'],['Geschäftsstelle','Verwaltung','18.000,00 €','9.600,00 €','53 %']],
    'finance-employees':[['Max Beispiel','Geschäftsstelle','Teilzeit','01.03.2024','Personalvorschau'],['Nina Muster','Verwaltung','Vollzeit','01.07.2022','Personalvorschau']],
    'finance-payroll':[['11/2026','Personal A','3.200,00 €','Payroll-Anbindung offen','Vorschau'],['11/2026','Personal B','1.450,00 €','Payroll-Anbindung offen','Vorschau']],
    'finance-coaches':[['Trainer Beispiel','U19','Honorarvertrag','900,00 €','Prüfung erforderlich'],['Trainer Muster','U17','Übungsleiter','250,00 €','Voraussetzungen prüfen']],
    'finance-expenses-travel':[['Scout Beispiel','Auswärtsspiel','184 km','55,20 €','Beleg fehlt'],['Trainer Muster','Lehrgang','Hotel','125,00 €','Zur Freigabe']],
    'finance-membership':[['Mitglied Beispiel','Familie','240,00 €','SEPA vorgesehen','Offen'],['Mitglied Muster','Jugend','120,00 €','SEPA vorgesehen','Aktiv']],
    'finance-journal':[['B-2026-001','1200 Bank','8400 Beiträge','240,00 €','Entwurf'],['B-2026-002','4400 Aufwand','1200 Bank','125,00 €','Entwurf']],
    'finance-accounts':[['1200','Bank','Aktiv','Bilanzkonto','Kontenplan offen'],['8400','Mitgliedsbeiträge','Aktiv','Ertragskonto','Zuordnung prüfen']],
    'finance-tax':[['Umsatzsteuerprofil','Deutschland','Regelstatus offen','—','Prüfung erforderlich'],['Gemeinnützigkeit','Nicht hinterlegt','Nachweis offen','—','Nicht geprüft']],
    'finance-npo':[['Ideeller Bereich','Beiträge / echte Spenden','—','—','Zuordnung prüfen'],['Vermögensverwaltung','Zinsen / Vermietung','—','—','Zuordnung prüfen'],['Zweckbetrieb','Begünstigter Sportbetrieb','—','—','Zuordnung prüfen'],['Wirtschaftlicher Geschäftsbetrieb','Werbung / Verkauf','—','—','Zuordnung prüfen']],
    'finance-documents':[['Eingangsrechnung','PDF / XML','12.11.2026','Nicht archiviert','Vorschau'],['Trainervertrag','PDF','05.11.2026','Personalakte','Vorschau']],
    'finance-reports':[['Monatsübersicht','Oktober 2026','PDF','Nicht erstellt','Vorschau'],['DATEV-Export','Zeitraum offen','CSV / DATEV','Nicht verfügbar','Nicht angebunden']],
    'finance-approvals':[['Trainerhonorar','900,00 €','Vorstand','12.11.2026','Ausstehend'],['Reisekosten','55,20 €','Finanzleitung','12.11.2026','Ausstehend']]
  };
  const translations = window.PFSS_I18N;
  const t = (key) => translations?.t(key) || key;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {
    'finance-dashboard':'Finance dashboard','finance-income':'Income & contributions','finance-expenses':'Expenses & costs','finance-invoices':'Invoices','finance-payments':'Payments & open items','finance-bank':'Bank & payments','finance-budgets':'Budgets & cost centres','finance-employees':'Employee management','finance-payroll':'Payroll & salary','finance-coaches':'Coaches & instructors','finance-expenses-travel':'Expenses & travel','finance-membership':'Members & dues','finance-journal':'Accounting journal','finance-accounts':'Accounts & chart of accounts','finance-tax':'Tax & compliance','finance-npo':'Association tax areas','finance-documents':'Receipts & documents','finance-reports':'Financial reports & DATEV','finance-approvals':'Approvals & audit log'
  };
  function table(id){
    const rows=demo[id]||[];
    const headers={
      'finance-income':['Source','Category','Amount','Period','Status'],
      'finance-expenses':['Expense','Category','Amount','Cost centre','Status'],
      'finance-invoices':['Invoice','Recipient / supplier','Amount','Due date','Status'],
      'finance-payments':['Party','Type','Amount','Due date','Status'],
      'finance-bank':['Account','Reference','Balance','As of','Connection'],
      'finance-budgets':['Department','Budget','Planned','Actual','Use'],
      'finance-employees':['Employee','Department','Employment','Start date','Status'],
      'finance-payroll':['Period','Employee','Gross reference','Processing','Status'],
      'finance-coaches':['Person','Team','Compensation type','Amount','Status'],
      'finance-expenses-travel':['Person','Purpose','Travel / expense','Amount','Status'],
      'finance-membership':['Member','Contribution group','Annual amount','Payment method','Status'],
      'finance-journal':['Entry','Debit','Credit','Amount','Status'],
      'finance-accounts':['Account','Name','State','Account type','Status'],
      'finance-tax':['Tax area','Jurisdiction','Profile','Due date','Status'],
      'finance-npo':['Tax area','Example','Income','Expenses','Status'],
      'finance-documents':['Document','Format','Date','Filing','Status'],
      'finance-reports':['Report','Period','Format','State','Status'],
      'finance-approvals':['Request','Amount','Approver','Date','Status']
    }[id]||['Name','Category','Amount','Date','Status'];
    return '<div class="pfss-fin-table-wrap"><table class="pfss-fin-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td>'+(i===row.length-1?'<span class="pfss-fin-status">'+esc(v)+'</span>':esc(v))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function panel(title,body){return '<section class="pfss-fin-panel"><h3>'+esc(title)+'</h3>'+body+'</section>';}
  function formFields(fields){return '<div class="pfss-fin-form">'+fields.map(([label,placeholder,type])=>'<label>'+esc(label)+(type==='select'?'<select><option>'+esc(placeholder)+'</option><option>Weitere Auswahl</option></select>':'<input '+(type==='date'?'type="date"':'')+' placeholder="'+esc(placeholder)+'">')+'</label>').join('')+'</div>';}
  function page(id,title,desc){
    if(id==='finance-dashboard'){
      const cards=[['LIQUIDITÄT','40.450 €','Beispielwert','◈'],['EINNAHMEN','23.950 €','Laufender Zeitraum','＋'],['AUSGABEN','12.380 €','Laufender Zeitraum','−'],['OFFENE POSTEN','4.820 €','Noch nicht ausgeglichen','◷']];
      return '<div class="pfss-fin-hero"><div><span class="pfss-fin-kicker">FINANCE & ADMINISTRATION</span><h2>Alle Finanzen. Ein Überblick.</h2><p>Finanzielle Vorgänge, Personalaufwand und Budgets zentral im Blick. Die angezeigten Werte sind ausschließlich Beispieldaten.</p><span class="pfss-fin-preview">DESIGNVORSCHAU · KEINE ECHTEN BUCHUNGEN</span></div><div class="pfss-fin-mark">PF<span>SS</span></div></div><div class="pfss-fin-stats">'+cards.map(c=>'<article><span>'+c[0]+'</span><b>'+c[1]+'</b><small>'+c[2]+'</small><i>'+c[3]+'</i></article>').join('')+'</div><div class="pfss-fin-columns">'+panel('Finanzübersicht','<div class="pfss-fin-bars"><div><span>Einnahmen</span><i style="--v:82%"></i><b>23.950 €</b></div><div><span>Ausgaben</span><i style="--v:48%"></i><b>12.380 €</b></div><div><span>Personalkosten</span><i style="--v:31%"></i><b>7.600 €</b></div></div>')+panel('Direktzugriff','<div class="pfss-fin-shortcuts">'+[['finance-invoices','Rechnung erstellen'],['finance-income','Einnahme erfassen'],['finance-expenses','Ausgabe erfassen'],['finance-coaches','Trainerabrechnung'],['finance-tax','Steuerübersicht'],['finance-reports','Finanzbericht']].map(x=>'<button type="button" data-finance-jump="'+x[0]+'">＋ '+x[1]+'</button>').join('')+'</div>')+'</div>'+panel('Offene Vorgänge',table('finance-approvals'));
    }
    let intro='<div class="pfss-fin-note">Grafische Vorschau mit Beispieldaten. Es werden keine Buchungen gespeichert, Zahlungen ausgelöst, Löhne berechnet oder Steuererklärungen übermittelt.</div>';
    const toolbar='<div class="pfss-fin-toolbar"><input type="search" placeholder="Suchen …" aria-label="Suchen"><select aria-label="Filter"><option>Alle Status</option><option>Offen</option><option>In Prüfung</option><option>Abgeschlossen</option></select><button type="button" data-finance-preview>＋ Neu erfassen</button></div>';
    const fieldsets={
      'finance-income':[['Einnahmeart','Bitte auswählen','select'],['Zahlungspflichtiger','Name / Organisation'],['Betrag','0,00 EUR'],['Fällig am','TT.MM.JJJJ','date'],['Kostenstelle','Abteilung / Mannschaft']],
      'finance-expenses':[['Ausgabenart','Bitte auswählen','select'],['Lieferant','Name'],['Betrag','0,00 EUR'],['Belegnummer','Referenz'],['Kostenstelle','Abteilung / Mannschaft']],
      'finance-invoices':[['Rechnungstyp','Ausgang / Eingang','select'],['Rechnungsempfänger','Name / Organisation'],['Rechnungsdatum','Datum','date'],['Fälligkeitsdatum','Datum','date'],['Betrag','0,00 EUR']],
      'finance-employees':[['Vorname','Vorname'],['Nachname','Nachname'],['Beschäftigungsart','Bitte auswählen','select'],['Eintrittsdatum','Datum','date'],['Kostenstelle','Abteilung']],
      'finance-coaches':[['Trainer','Name'],['Mannschaft','Team auswählen','select'],['Vertragsart','Arbeitsvertrag / Honorar','select'],['Vergütung','Betrag'],['Gültig ab','Datum','date']],
      'finance-expenses-travel':[['Person','Name'],['Reisezweck','Spiel / Lehrgang / Sichtung'],['Kilometer','0'],['Betrag','0,00 EUR'],['Beleg','Datei auswählen']],
      'finance-membership':[['Mitglied','Name'],['Beitragsgruppe','Bitte auswählen','select'],['Beitrag','Betrag'],['Intervall','Monat / Quartal / Jahr','select'],['SEPA-Status','Nicht verbunden','select']],
      'finance-tax':[['Land / Steuergebiet','Deutschland','select'],['Rechtsform','Bitte auswählen','select'],['Gemeinnützigkeit','Nicht hinterlegt','select'],['Umsatzsteuerstatus','Bitte prüfen','select'],['Steuerjahr','2026']],
      'finance-npo':[['Steuerliche Sphäre','Bitte auswählen','select'],['Vorgang','Beschreibung'],['Einnahme','0,00 EUR'],['Ausgabe','0,00 EUR'],['Belegreferenz','Referenz']]
    };
    let extra='';
    if(fieldsets[id]) extra=panel('Vorgang vorbereiten',formFields(fieldsets[id]));
    if(id==='finance-payroll') extra=panel('Payroll-Übersicht','<div class="pfss-fin-callout">Die Brutto-/Nettoabrechnung, Lohnsteuer, Sozialversicherung und Meldungen werden erst über eine geprüfte Payroll-Anbindung aktiviert. Diese Ansicht ist keine Lohnabrechnung.</div>');
    if(id==='finance-journal') extra=panel('Buchungssatz vorbereiten',formFields([['Buchungsdatum','Datum','date'],['Sollkonto','Sachkonto'],['Habenkonto','Sachkonto'],['Betrag','0,00 EUR'],['Belegreferenz','Referenz']]));
    if(id==='finance-accounts') extra=panel('Kontenrahmen','<div class="pfss-fin-callout">Kontenrahmen und steuerliche Zuordnung müssen je Organisation und Buchführungsart fachlich festgelegt werden. Noch keine Konten sind produktiv eingerichtet.</div>');
    if(id==='finance-documents') extra=panel('Beleg hinzufügen','<div class="pfss-fin-upload">＋<b>Beleg auswählen oder hier ablegen</b><small>PDF, XML, ZUGFeRD oder XRechnung · Vorschau ohne Upload-Funktion</small></div>');
    if(id==='finance-approvals') extra=panel('Freigabeprozess','<div class="pfss-fin-steps"><span>1 · Erfassen</span><span>2 · Fachprüfung</span><span>3 · Freigabe</span><span>4 · Buchung / Zahlung</span></div>');
    if(id==='finance-reports') extra=panel('Bericht konfigurieren',formFields([['Berichtstyp','Bitte auswählen','select'],['Zeitraum von','Datum','date'],['Zeitraum bis','Datum','date'],['Ausgabeformat','PDF / CSV / DATEV','select']]));
    return intro+toolbar+table(id)+extra;
  }
  function build(){
    const nav=document.querySelector('.nav-list'),main=document.querySelector('.main-area');
    if(!nav||!main||document.getElementById('pfssFinanceNav'))return;
    const group=document.createElement('div');group.id='pfssFinanceNav';group.className='pfss-ui-nav pfss-fin-nav';
    group.innerHTML='<div class="nav-section-label">FINANCE & ADMINISTRATION</div>'+groups.map(g=>'<div class="nav-section-label pfss-fin-subhead">'+esc(g.name)+'</div>'+g.items.map(([id,label,icon])=>'<button type="button" class="nav-item pfss-ui-nav-item" data-finance-view="'+id+'"><span class="nav-icon">'+icon+'</span><span class="nav-label">'+esc(label)+'</span></button>').join('')).join('');
    const workspaceNav=document.getElementById('pfssUiNav');
    if(workspaceNav?.nextSibling)nav.insertBefore(group,workspaceNav.nextSibling);else nav.appendChild(group);
    groups.flatMap(g=>g.items).forEach(([id,title,icon,desc])=>{
      const section=document.createElement('section');section.className='view pfss-ui-view pfss-fin-view';section.id='pfss-finance-'+id;
      section.innerHTML='<header class="pfss-page-heading"><div><span class="pfss-kicker">PFSS FINANCE / '+esc(title.toUpperCase())+'</span><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div><span class="pfss-preview">DESIGNVORSCHAU</span></header>'+page(id,title,desc);
      main.appendChild(section);
    });
    document.addEventListener('click',e=>{
      const navBtn=e.target.closest('[data-finance-view]'),jump=e.target.closest('[data-finance-jump]');
      if(navBtn||jump){
        const id=navBtn?.dataset.financeView||jump?.dataset.financeJump;
        activate(id);
        if(window.matchMedia('(max-width:760px)').matches){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('menuToggle')?.setAttribute('aria-expanded','false');}
      }
      const action=e.target.closest('[data-finance-preview]');
      if(action)action.insertAdjacentHTML('afterend','<span class="pfss-fin-preview-msg">Nur Vorschau – keine Daten wurden gespeichert.</span>');
    });
  }
  function activate(id){
    const pageEl=document.getElementById('pfss-finance-'+id);if(!pageEl)return;
    document.querySelectorAll('.main-area>.view').forEach(v=>v.classList.remove('active'));
    pageEl.classList.add('active');
    document.querySelectorAll('.nav-list .nav-item').forEach(n=>n.classList.toggle('active',n.dataset.financeView===id));
    const title=document.getElementById('pageTitle');if(title)title.textContent=pageEl.querySelector('h1')?.textContent||id;
    try{sessionStorage.setItem('pfss_last_page_v1',JSON.stringify({type:'finance',view:id,userId:window.pfssCurrentUserId||null}));}catch(e){}
    if(history.replaceState)history.replaceState({pfssFinanceView:id},'',location.pathname+'#'+id);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();