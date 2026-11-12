/* PFSS Internationalization — German, English, French foundation.
   Language is stored per browser profile; no personal or financial data is transmitted. */
(() => {
  'use strict';
  const dictionaries = {
    de:{'language.label':'Sprache','language.de':'Deutsch','language.en':'English','language.fr':'Français','nav.finance':'Finance & Administration','finance.dashboard':'Finance-Dashboard','finance.income':'Einnahmen & Beiträge','finance.expenses':'Ausgaben & Kosten','finance.invoices':'Rechnungen','finance.payments':'Zahlungen & Offene Posten','finance.bank':'Bank & Zahlungsverkehr','finance.budgets':'Budgets & Kostenstellen','finance.employees':'Mitarbeiterverwaltung','finance.payroll':'Lohn & Gehalt','finance.coaches':'Trainer & Übungsleiter','finance.travel':'Spesen & Reisekosten','finance.members':'Mitglieder & Beiträge','finance.journal':'Buchungsjournal','finance.accounts':'Konten & Kontenrahmen','finance.tax':'Steuern & Tax Compliance','finance.npo':'Verein: Steuerliche Sphären','finance.documents':'Belege & Dokumente','finance.reports':'Finanzberichte & DATEV','finance.approvals':'Freigaben & Prüfprotokoll','common.preview':'Grafische Vorschau','common.search':'Suchen','common.new':'Neu erfassen','common.open':'Öffnen','common.status':'Status','common.date':'Datum','common.amount':'Betrag','common.period':'Zeitraum','common.department':'Abteilung','common.notConnected':'Nicht verbunden','common.sampleData':'Beispieldaten'},
    en:{'language.label':'Language','language.de':'German','language.en':'English','language.fr':'French','nav.finance':'Finance & Administration','finance.dashboard':'Finance dashboard','finance.income':'Income & contributions','finance.expenses':'Expenses & costs','finance.invoices':'Invoices','finance.payments':'Payments & open items','finance.bank':'Banking & payments','finance.budgets':'Budgets & cost centres','finance.employees':'Employee management','finance.payroll':'Payroll & salaries','finance.coaches':'Coaches & instructors','finance.travel':'Expenses & travel','finance.members':'Members & contributions','finance.journal':'Accounting journal','finance.accounts':'Accounts & chart of accounts','finance.tax':'Tax & compliance','finance.npo':'Association tax areas','finance.documents':'Receipts & documents','finance.reports':'Financial reports & DATEV','finance.approvals':'Approvals & audit log','common.preview':'Visual preview','common.search':'Search','common.new':'Create new','common.open':'Open','common.status':'Status','common.date':'Date','common.amount':'Amount','common.period':'Period','common.department':'Department','common.notConnected':'Not connected','common.sampleData':'Sample data'},
    fr:{'language.label':'Langue','language.de':'Allemand','language.en':'Anglais','language.fr':'Français','nav.finance':'Finances et administration','finance.dashboard':'Tableau de bord financier','finance.income':'Recettes et cotisations','finance.expenses':'Dépenses et coûts','finance.invoices':'Factures','finance.payments':'Paiements et postes ouverts','finance.bank':'Banque et paiements','finance.budgets':'Budgets et centres de coûts','finance.employees':'Gestion du personnel','finance.payroll':'Paie et salaires','finance.coaches':'Entraîneurs et éducateurs','finance.travel':'Frais et déplacements','finance.members':'Membres et cotisations','finance.journal':'Journal comptable','finance.accounts':'Comptes et plan comptable','finance.tax':'Fiscalité et conformité','finance.npo':'Régimes fiscaux associatifs','finance.documents':'Justificatifs et documents','finance.reports':'Rapports financiers et DATEV','finance.approvals':'Validations et journal d’audit','common.preview':'Aperçu visuel','common.search':'Rechercher','common.new':'Créer','common.open':'Ouvrir','common.status':'Statut','common.date':'Date','common.amount':'Montant','common.period':'Période','common.department':'Service','common.notConnected':'Non connecté','common.sampleData':'Données fictives'}
  };
  const supported=['de','en','fr'], key='pfss_language_v1';
  let current='de';
  function t(k){return dictionaries[current]?.[k]||dictionaries.de[k]||k;}
  function apply(root=document){
    root.querySelectorAll('[data-i18n]').forEach(el=>{const v=t(el.dataset.i18n);if(v!==el.dataset.i18n)el.textContent=v;});
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.setAttribute('placeholder',t(el.dataset.i18nPlaceholder)));
    root.documentElement?.setAttribute('lang',current);
    document.documentElement.lang=current;
    document.documentElement.dataset.language=current;
  }
  function setLanguage(lang){
    if(!supported.includes(lang))return;
    current=lang;
    try{localStorage.setItem(key,lang);}catch(e){}
    apply();
    document.dispatchEvent(new CustomEvent('pfss:languagechange',{detail:{language:lang}}));
    const selector=document.getElementById('pfssLanguageSelect');if(selector&&selector.value!==lang)selector.value=lang;
  }
  function mount(){
    let saved='de';try{saved=localStorage.getItem(key)||'de';}catch(e){}
    const top=document.querySelector('.topbar-right');
    if(top&&!document.getElementById('pfssLanguageControl')){
      const wrap=document.createElement('label');wrap.id='pfssLanguageControl';wrap.className='pfss-language-control';
      wrap.innerHTML='<span aria-hidden="true">◎</span><span class="pfss-language-label">'+t('language.label')+'</span><select id="pfssLanguageSelect" aria-label="Language"><option value="de">🇩🇪 DE</option><option value="en">🇬🇧 EN</option><option value="fr">🇫🇷 FR</option></select>';
      top.prepend(wrap);
      wrap.querySelector('select').addEventListener('change',e=>setLanguage(e.target.value));
    }
    setLanguage(supported.includes(saved)?saved:'de');
  }
  window.PFSS_I18N={t,setLanguage,getLanguage:()=>current,supported,apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)apply(n);})));
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
})();