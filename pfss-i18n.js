/* PFSS Internationalization — German, English, French foundation.
   Language preference is local to the user profile/browser. */
(() => {
  'use strict';
  const dictionaries = {
    de:{'language.label':'Sprache','language.de':'Deutsch','language.en':'English','language.fr':'Français'},
    en:{'language.label':'Language','language.de':'German','language.en':'English','language.fr':'French'},
    fr:{'language.label':'Langue','language.de':'Allemand','language.en':'Anglais','language.fr':'Français'}
  };
  const textTranslations = {
    'Finance-Dashboard':['Finance dashboard','Tableau de bord financier'],
    'Einnahmen & Beiträge':['Income & contributions','Recettes et cotisations'],
    'Ausgaben & Kosten':['Expenses & costs','Dépenses et coûts'],
    'Rechnungen':['Invoices','Factures'],
    'Zahlungen & Offene Posten':['Payments & open items','Paiements et postes ouverts'],
    'Bank & Zahlungsverkehr':['Banking & payments','Banque et paiements'],
    'Budgets & Kostenstellen':['Budgets & cost centres','Budgets et centres de coûts'],
    'Mitarbeiterverwaltung':['Employee management','Gestion du personnel'],
    'Lohn & Gehalt':['Payroll & salaries','Paie et salaires'],
    'Trainer & Übungsleiter':['Coaches & instructors','Entraîneurs et éducateurs'],
    'Spesen & Reisekosten':['Expenses & travel','Frais et déplacements'],
    'Mitglieder & Beiträge':['Members & contributions','Membres et cotisations'],
    'Buchungsjournal':['Accounting journal','Journal comptable'],
    'Konten & Kontenrahmen':['Accounts & chart of accounts','Comptes et plan comptable'],
    'Steuern & Tax Compliance':['Tax & compliance','Fiscalité et conformité'],
    'Verein: Steuerliche Sphären':['Association tax areas','Régimes fiscaux associatifs'],
    'Belege & Dokumente':['Receipts & documents','Justificatifs et documents'],
    'Finanzberichte & DATEV':['Financial reports & DATEV','Rapports financiers et DATEV'],
    'Freigaben & Prüfprotokoll':['Approvals & audit log','Validations et journal d’audit'],
    'FINANCE CORE':['FINANCE CORE','CŒUR FINANCIER'],
    'PERSONAL & SPORT':['PEOPLE & SPORT','PERSONNEL & SPORT'],
    'BUCHHALTUNG & STEUERN':['ACCOUNTING & TAX','COMPTABILITÉ & FISCALITÉ'],
    'FINANCE & ADMINISTRATION':['FINANCE & ADMINISTRATION','FINANCES ET ADMINISTRATION'],
    'Finanzstatus, Liquidität und offene Vorgänge':['Financial status, liquidity and open items','Situation financière, liquidités et opérations ouvertes'],
    'Mitgliedsbeiträge, Sponsoring, Spenden und Erlöse':['Membership fees, sponsorship, donations and revenue','Cotisations, sponsoring, dons et recettes'],
    'Ausgaben, Lieferanten und Kostenstellen':['Expenses, suppliers and cost centres','Dépenses, fournisseurs et centres de coûts'],
    'Ausgangs- und Eingangsrechnungen':['Sales and purchase invoices','Factures clients et fournisseurs'],
    'Forderungen, Verbindlichkeiten und Mahnwesen':['Receivables, payables and reminders','Créances, dettes et relances'],
    'Konten, Bankumsätze und Zahlungsabgleich':['Accounts, bank transactions and reconciliation','Comptes, opérations bancaires et rapprochement'],
    'Planung nach Abteilung, Mannschaft und Projekt':['Planning by department, team and project','Planification par service, équipe et projet'],
    'Personalstammdaten, Verträge und Beschäftigung':['Employee records, contracts and employment','Dossiers du personnel, contrats et emploi'],
    'Vergütungsübersicht und Payroll-Übergabe':['Compensation overview and payroll handoff','Aperçu des rémunérations et transmission de la paie'],
    'Trainerverträge, Honorare und Pauschalen':['Coach contracts, fees and allowances','Contrats des entraîneurs, honoraires et indemnités'],
    'Kilometer, Reisen, Belege und Erstattungen':['Mileage, travel, receipts and reimbursements','Kilométrage, déplacements, justificatifs et remboursements'],
    'Beitragsgruppen, Forderungen und SEPA-Vorbereitung':['Contribution groups, receivables and SEPA preparation','Groupes de cotisation, créances et préparation SEPA'],
    'Buchungssätze, Soll und Haben':['Journal entries, debit and credit','Écritures comptables, débit et crédit'],
    'Sachkonten, Debitoren und Kreditoren':['General ledger, receivables and payables','Comptes généraux, débiteurs et créanciers'],
    'Steuerprofile, Fristen und Prüfhinweise':['Tax profiles, deadlines and review notices','Profils fiscaux, échéances et alertes de contrôle'],
    'Digitale Belegablage und Dokumentenprüfung':['Digital receipt storage and document review','Archivage numérique des justificatifs et contrôle des documents'],
    'Auswertungen, Exporte und Steuerberaterzugang':['Reports, exports and tax adviser access','Rapports, exports et accès au conseiller fiscal'],
    'Vier-Augen-Prinzip und nachvollziehbare Vorgänge':['Four-eyes principle and traceable processes','Principe des quatre yeux et opérations traçables'],
    'Alle Finanzen. Ein Überblick.':['All finances. One overview.','Toutes les finances. Une vue d’ensemble.'],
    'Finanzielle Vorgänge, Personalaufwand und Budgets zentral im Blick. Die angezeigten Werte sind ausschließlich Beispieldaten.':['Track financial activity, personnel costs and budgets in one place. All displayed figures are sample data only.','Suivez les opérations financières, les coûts du personnel et les budgets au même endroit. Toutes les valeurs affichées sont fictives.'],
    'DESIGNVORSCHAU':['DESIGN PREVIEW','APERÇU VISUEL'],
    'Grafische Vorschau mit Beispieldaten. Es werden keine Buchungen gespeichert, Zahlungen ausgelöst, Löhne berechnet oder Steuererklärungen übermittelt.':['Visual preview with sample data. No entries are saved, payments initiated, payroll calculated or tax returns submitted.','Aperçu visuel avec données fictives. Aucune écriture n’est enregistrée, aucun paiement n’est déclenché, aucune paie n’est calculée et aucune déclaration fiscale n’est transmise.'],
    'Suchen …':['Search …','Rechercher …'],
    'Alle Status':['All statuses','Tous les statuts'],
    'Offen':['Open','Ouvert'],
    'In Prüfung':['Under review','En cours de vérification'],
    'Abgeschlossen':['Completed','Terminé'],
    '＋ Neu erfassen':['＋ Create new','＋ Créer'],
    'Vorgang vorbereiten':['Prepare transaction','Préparer une opération'],
    'Finanzübersicht':['Financial overview','Aperçu financier'],
    'Direktzugriff':['Quick access','Accès rapide'],
    'Offene Vorgänge':['Open items','Opérations en attente'],
    'Mitarbeiter':['Employees','Employés'],
    'Beispieldaten':['Sample data','Données fictives'],
    'Prüfung erforderlich':['Review required','Vérification requise'],
    'Nicht verbunden':['Not connected','Non connecté'],
    'Steuerprofil':['Tax profile','Profil fiscal']
  };
  Object.assign(textTranslations, {

    'Einnahmeart':['Income type','Type de recette'],
    'Zahlungspflichtiger':['Payer','Payeur'],
    'Fällig am':['Due date','Échéance'],
    'Kostenstelle':['Cost centre','Centre de coûts'],
    'Ausgabenart':['Expense type','Type de dépense'],
    'Lieferant':['Supplier','Fournisseur'],
    'Belegnummer':['Receipt number','Numéro de justificatif'],
    'Rechnungstyp':['Invoice type','Type de facture'],
    'Rechnungsempfänger':['Invoice recipient','Destinataire de la facture'],
    'Rechnungsdatum':['Invoice date','Date de facture'],
    'Fälligkeitsdatum':['Due date','Date d’échéance'],
    'Vorname':['First name','Prénom'],
    'Nachname':['Last name','Nom'],
    'Beschäftigungsart':['Employment type','Type d’emploi'],
    'Eintrittsdatum':['Start date','Date d’entrée'],
    'Abteilung':['Department','Service'],
    'Trainer':['Coach','Entraîneur'],
    'Mannschaft':['Team','Équipe'],
    'Vertragsart':['Contract type','Type de contrat'],
    'Vergütung':['Compensation','Rémunération'],
    'Gültig ab':['Valid from','Valable à partir du'],
    'Reisezweck':['Travel purpose','Motif du déplacement'],
    'Kilometer':['Kilometres','Kilomètres'],
    'Beleg':['Receipt','Justificatif'],
    'Beitragsgruppe':['Contribution group','Groupe de cotisation'],
    'Beitrag':['Contribution','Cotisation'],
    'Intervall':['Interval','Périodicité'],
    'SEPA-Status':['SEPA status','Statut SEPA'],
    'Steuerliche Sphäre':['Tax area','Régime fiscal'],
    'Vorgang':['Transaction','Opération'],
    'Einnahme':['Income','Recette'],
    'Ausgabe':['Expense','Dépense'],
    'Belegreferenz':['Receipt reference','Référence du justificatif'],
    'Buchungsdatum':['Posting date','Date de comptabilisation'],
    'Sollkonto':['Debit account','Compte débité'],
    'Habenkonto':['Credit account','Compte crédité'],
    'Bericht konfigurieren':['Configure report','Configurer le rapport'],
    'Berichtstyp':['Report type','Type de rapport'],
    'Zeitraum von':['Period from','Période du'],
    'Zeitraum bis':['Period to','Période au'],
    'Ausgabeformat':['Output format','Format de sortie'],
    'Eingangsrechnung':['Purchase invoice','Facture fournisseur'],
    'Trainervertrag':['Coach contract','Contrat d’entraîneur'],
    'Nicht archiviert':['Not archived','Non archivé'],
    'Zur Freigabe':['Awaiting approval','En attente de validation'],
    'Entwurf':['Draft','Brouillon'],
    'Offen':['Open','Ouvert'],
    'Aktiv':['Active','Actif'],
    'Prüfung':['Review','Vérification'],
    'Beispielwert':['Sample value','Valeur fictive'],
    'Laufender Zeitraum':['Current period','Période en cours'],
    'Noch nicht ausgeglichen':['Not yet reconciled','Pas encore rapproché'],
    'DESIGNVORSCHAU · KEINE ECHTEN BUCHUNGEN':['DESIGN PREVIEW · NO REAL ENTRIES','APERÇU VISUEL · AUCUNE ÉCRITURE RÉELLE'],
    'Finanzielle Vorgänge, Personalaufwand und Budgets zentral im Blick. Die angezeigten Werte sind ausschließlich Beispieldaten.':['Track financial activity, personnel costs and budgets in one place. All displayed figures are sample data only.','Suivez les opérations financières, les coûts du personnel et les budgets au même endroit. Toutes les valeurs affichées sont fictives.']

  });
  const supported=['de','en','fr'], storageKey='pfss_language_v1';
  let current='de';
  function t(key){return dictionaries[current]?.[key]||dictionaries.de[key]||key;}
  function translateTextNodes(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(!node.parentElement||['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement.tagName))return;
      if(node.__pfssOriginalText===undefined)node.__pfssOriginalText=node.nodeValue;
      const original=node.__pfssOriginalText.trim();
      const translated=textTranslations[original];
      if(!translated)return;
      const value=current==='de'?node.__pfssOriginalText:translated[current==='en'?0:1];
      if(node.nodeValue!==value)node.nodeValue=value;
    });
  }
  function apply(root=document){
    root.querySelectorAll?.('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
    root.querySelectorAll?.('[data-i18n-placeholder]').forEach(el=>el.setAttribute('placeholder',t(el.dataset.i18nPlaceholder)));
    translateTextNodes(root);
    document.documentElement.lang=current;
    document.documentElement.dataset.language=current;
    const label=document.querySelector('#pfssLanguageControl .pfss-language-label');if(label)label.textContent=t('language.label');
  }
  function setLanguage(lang){
    if(!supported.includes(lang))return;
    current=lang;try{localStorage.setItem(storageKey,lang);}catch(e){}
    apply();document.querySelectorAll('.pfss-language-select').forEach(selector=>selector.value=lang);
    document.dispatchEvent(new CustomEvent('pfss:languagechange',{detail:{language:lang}}));
  }
  function mount(){
    let saved='de';try{saved=localStorage.getItem(storageKey)||'de';}catch(e){}
    const mountSelector=(container,id,prepend)=>{
      if(!container||document.getElementById(id))return;
      const wrap=document.createElement('label');wrap.id=id;wrap.className='pfss-language-control';
      wrap.innerHTML='<span aria-hidden="true">◎</span><span class="pfss-language-label">Sprache</span><select class="pfss-language-select" aria-label="Language"><option value="de">🇩🇪 DE</option><option value="en">🇬🇧 EN</option><option value="fr">🇫🇷 FR</option></select>';
      if(prepend)container.prepend(wrap);else container.appendChild(wrap);
      wrap.querySelector('select').addEventListener('change',e=>setLanguage(e.target.value));
    };
    mountSelector(document.querySelector('.topbar-right'),'pfssLanguageControl',true);
    mountSelector(document.querySelector('.auth-brand'),'pfssAuthLanguageControl',false);
    setLanguage(supported.includes(saved)?saved:'de');
  }
  window.PFSS_I18N={t,setLanguage,getLanguage:()=>current,supported,apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)apply(n);else if(n.nodeType===3&&n.parentElement)translateTextNodes(n.parentElement);})));
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
})();