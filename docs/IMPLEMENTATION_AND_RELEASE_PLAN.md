# PFSS – Umsetzung, Sicherheit und Freigabeplan

Stand: 12.11.2026  
Arbeitsbranch: `foundation/permissions-v1`

Dieses Dokument trennt erledigte Repository-Arbeiten von Aufgaben, die einen Zugriff auf die echte Supabase-/Render-Umgebung oder eine ausdrückliche Freigabe benötigen.

## Bereits im Repository vorbereitet

- Supabase Auth und geschützte Profilfreigabe sind vorhanden.
- Organisationsmitgliedschaften, Einladungen und Admin-RPCs sind bereits angelegt.
- Eine private Scout-Datenstruktur mit RLS ist als Migration vorhanden, aber nicht automatisch als produktiv aktiv anzusehen.
- Ein verschlüsselter täglicher Datenbank-Backup-Workflow nach Cloudflare R2 ist vorhanden.
- Ein statischer Sicherheitsbericht liegt unter `docs/SECURITY_AUDIT_2026-11-12.md`.
- Automatisierte statische Qualitätsprüfungen laufen künftig bei Pushes und Pull Requests.

## Reihenfolge der verbleibenden Arbeiten

### 1. Sicherheits- und Berechtigungskonzept

- [ ] Live-Schema-Inventar ausführen und tatsächliche Tabellen, Policies, Grants, Trigger und Funktionen sichern.
- [ ] Kanonisches Organisationsmodell bestimmen; parallele Modelle nicht ohne Datenabgleich löschen.
- [ ] Definition und Rechte von `is_admin()` verifizieren.
- [ ] Einladungscodes auf Ablauf, Einmalverwendung, Widerruf und Rollenbegrenzung testen.
- [ ] Negativtests: Scout A darf weder Spieler, Berichte, Medien noch Organisationsdaten von Scout/Verein B lesen oder ändern.
- [ ] Username-Login gegen Brute Force absichern; dafür einen verteilten Rate-Limit-Speicher verwenden, nicht nur In-Memory-Zähler.
- [ ] CORS-Origins auf die tatsächlich genutzten Domains begrenzen.
- [ ] R2-Diagnosefunktion nur für authentifizierte und autorisierte Administratoren erreichbar machen.
- [ ] Private Storage Policies für SELECT, INSERT, UPDATE und DELETE konsistent prüfen.
- [ ] Minderjährigendaten: Zweckbindung, minimale Erhebung, Freigaben, Lösch- und Aufbewahrungsregeln rechtlich prüfen.

### 2. Technische Grundfunktionen und Systemüberwachung

- [ ] Healthchecks für Frontend, Auth, Datenbank und Storage getrennt definieren.
- [ ] Fehler zentral erfassen, ohne Passwörter, Tokens, private Spieler- oder Gesundheitsdaten zu protokollieren.
- [ ] Einheitliche Lade-, Fehler-, Leer- und Erfolgszustände für alle Module.
- [ ] Wiederholbare Smoke-Tests für Anmeldung, Abmeldung, Navigation und Kernabfragen.
- [ ] Abhängigkeiten pinnen und Content-Security-Policy-/SRI-Strategie prüfen.

### 3. Workspace-Bereiche vereinheitlichen

- [ ] Jede Vorschau eindeutig als Vorschau kennzeichnen, solange keine echte Datenbankfunktion angeschlossen ist.
- [ ] Gemeinsame Komponenten für Tabellen, Filter, Dialoge, Formulare und Statusanzeigen.
- [ ] Einheitliche Rechteprüfung vor jeder Aktion.
- [ ] Keine Demo-Daten als echte Organisationsdaten darstellen.

### 4. Scouting und Datenqualität

- [ ] Spieler-Dublettenprüfung mit manueller Zusammenführung statt automatischem Löschen.
- [ ] Einheitliche Bewertungs-Skala und dokumentierte Kriterien.
- [ ] Historie je Spieler mit Datum, Scout und Bericht.
- [ ] Spieler-Vergleich und Filter.
- [ ] Export nur für berechtigte Nutzer und mit Datenschutzprüfung.

### 5. Administration und Benachrichtigungen

- [ ] Rollen-/Rechteübersicht aus der tatsächlichen serverseitigen Berechtigungsquelle.
- [ ] Einladungsverwaltung mit Status und Ablauf.
- [ ] Audit-Trail für sicherheitsrelevante Aktionen.
- [ ] Benachrichtigungen mit Präferenzen und nachvollziehbarem Status.

### 6. Datenschutz, Backup und Wiederherstellung

- [ ] Prüfen, ob alle benötigten GitHub Secrets eingerichtet sind.
- [ ] Manuellen Backup-Lauf durchführen und Upload verifizieren.
- [ ] Wiederherstellung in einer separaten Testdatenbank durchführen.
- [ ] Aufbewahrungsfristen, Verschlüsselungsschlüssel-Rotation und Zugriff auf Backups dokumentieren.
- [ ] Export-/Löschprozesse und Datenschutzinformationen prüfen.

### 7. Geräte- und Browserprüfung (späteres To-do)

- [ ] Desktop und Laptop
- [ ] iPhone und iPad (Safari)
- [ ] Android-Smartphones und Tablets
- [ ] Chrome, Firefox, Safari und Edge
- [ ] Navigation, Touch, Formulare, Tabellen, Dialoge und Uploads

## Sicherheitsgrenzen und Freigaberegeln

- Keine produktive Supabase-Migration ohne Live-Inventar, Test auf separatem Projekt, Review und ausdrückliche Freigabe.
- Keine echten Spieler- oder Mitgliederdaten in Testläufe kopieren, sofern nicht rechtlich und technisch abgesichert.
- Keine Secret Keys in Browsercode, Repository, Issues oder Logs.
- Ein erfolgreicher GitHub-Workflow ist ein statischer Qualitätsnachweis, kein Penetrationstest und keine Bestätigung der Live-Konfiguration.
- Ein Backup gilt erst nach erfolgreichem Restore-Test als belastbar.


## PFSS Finance & Internationalization (added 2026-11-12)

### Visual foundation delivered on `foundation/permissions-v1`
- Added a dedicated Finance & Administration navigation group and 19 visual module views.
- Covers finance dashboard, income/contributions, expenses, invoices, open items, banking, budgets/cost centres, employees, payroll handoff, coaches/instructors, travel expenses, membership dues, journal, chart of accounts, tax/compliance, non-profit tax areas, documents, reports/DATEV and approvals/audit.
- All figures and records in the new screens are explicitly sample data. No accounting, payment, payroll, bank or tax submission actions are active.
- Added central language preference foundation for German, English and French, including selectors in login and workspace.
- Added initial translations for finance navigation, module headings, key descriptions and common finance form labels.
- Spanish, Turkish and Arabic remain future language packs.

### Not yet production-ready
- Complete translation coverage of every legacy screen, email, PDF, validation message and generated document.
- Tenant isolation and role/permission enforcement for each club, agency and independent scout.
- Accounting model, chart-of-accounts configuration, posting validation, period closing, reversals and audit-grade immutability.
- Tax rule engine with effective dates and expert validation for each legal entity and activity.
- German payroll provider integration, bank connectivity, SEPA execution, DATEV/ELSTER workflows and E-invoice processing.
- GoBD procedure documentation, retention/deletion rules, privacy review, security testing and external tax/accounting review.
- Automated tests and real device/browser verification before release.

### Safety boundary
Do not run migrations, connect live bank accounts, submit tax/payroll filings, initiate payments, or expose personal/financial records as part of the visual foundation. Production remains out of scope until explicit approval and a separate release plan.
