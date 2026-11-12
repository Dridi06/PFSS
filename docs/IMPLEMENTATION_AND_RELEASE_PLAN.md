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

## Selbstständig erledigte Repository-Arbeiten – Durchgang 1 (12.11.2026)

Diese Punkte wurden in diesem Durchgang direkt im Arbeitsbranch bearbeitet und anhand des abgerufenen Quelltexts geprüft. Sie sind bewusst eng abgegrenzt: Ein Quelltext-Check ist kein Live- oder Sicherheitstest.

- [x] Statische JavaScript-Prüfung auf alle fünf zentralen Frontend-Dateien erweitert: `app.js`, `scout-workspace.js`, `workspace-ui.js`, `pfss-finance.js`, `pfss-i18n.js`.
- [x] Inline-JavaScript in `index.html` in die statische Syntaxprüfung aufgenommen.
- [x] Prüfung auf doppelte HTML-IDs in `index.html` durchgeführt: 141 IDs, keine Duplikate zum Prüfzeitpunkt.
- [x] Lokale HTML-Ressourcenprüfung im Validator beibehalten.
- [x] Warnhinweis zur noch offenen CSP-/SRI-Prüfung im Validator ergänzt.
- [x] Vorschaucharakter der generierten Workspace- und Finanzmodule im Quelltext bestätigt; diese Module werden nicht als produktiv angebunden ausgegeben.

### Noch nicht als erledigt bestätigt
- [ ] GitHub-Actions-Lauf des erweiterten Validators erfolgreich abwarten und Ergebnis prüfen.
- [ ] Validator in einer vollständigen lokalen Repository-Kopie ausführen; der Quelltext wurde hier syntaktisch geprüft, aber kein vollständiger Runner mit allen Repository-Dateien ausgeführt.
- [ ] Browser-/Gerätetests und Ende-zu-Ende-Funktionstests durchführen.
- [ ] Live-Supabase-Schema, RLS, Grants, Trigger, Funktionen und Storage-Policies anhand des Preflight-Exports verifizieren.
- [ ] Edge-Function-Härtung erst nach Festlegung der echten Frontend-Origin-Allowlist und des autoritativen Admin-Rollenmodells umsetzen.
- [ ] Backup-Workflow, R2-Zugang und Restore praktisch prüfen.

## Verbindliche Entwicklungsreihenfolge – Gesamtprojekt PFSS

Diese Prioritäten bilden die übergeordnete Reihenfolge für die weitere Entwicklung. Die OWASP-Aufgaben darunter sind Bestandteil insbesondere von Punkt 2 und ergänzen ihn technisch.

| Reihenfolge | Entwicklungsbereich | Bedeutung |
|---:|---|---|
| 1 | Mandantentrennung und Berechtigungen | **Kritisch** |
| 2 | Datenschutz und IT-Sicherheit | **Kritisch** |
| 3 | Datenmodell und Datenintegrität | **Kritisch** |
| 4 | Buchhaltung und rechtliche Anforderungen | **Hoch** |
| 5 | Backup und Wiederherstellung | **Kritisch** |
| 6 | Alle Fachmodule funktional verbinden | **Hoch** |
| 7 | Automatisierung und Benachrichtigungen | **Hoch** |

### Umsetzungshinweis
- [ ] Die Reihenfolge als verbindliche Projektpriorisierung verwenden.
- [ ] Kritische Bereiche vor dem produktiven Rollout vollständig prüfen und abnehmen.
- [ ] Abhängigkeiten berücksichtigen: Datenmodell, Mandantentrennung und Berechtigungen müssen stehen, bevor Fachmodule produktiv miteinander verbunden werden.
- [ ] Buchhaltungsfunktionen erst nach fachlicher, steuerlicher und rechtlicher Prüfung produktiv schalten.
- [ ] Backup erst nach einem erfolgreichen Wiederherstellungstest als belastbar einstufen.
- [ ] Fachmodule erst dann als funktional abgeschlossen markieren, wenn echte Datenbank- und Berechtigungsprüfungen sowie Ende-zu-Ende-Tests bestanden sind.

## Zusätzliche verbindliche OWASP-Aufgaben (10-Punkte-Übersicht)

Die folgenden zehn Arbeitspakete sind vollständig Teil der PFSS-To-do-Liste. Die detaillierten Prüfschritte stehen im Abschnitt „OWASP Security Baseline“ weiter unten.

- [ ] **1. OWASP ASVS 5.0:** als technische Sicherheits- und Abnahmecheckliste einführen.
- [ ] **2. OWASP Top 10:** als Grundlage für regelmäßige Risiko- und Code-Reviews verwenden.
- [ ] **3. OWASP Cheat Sheets:** konkrete sichere Implementierungen für Login, Sessions, Berechtigungen, Eingaben, Uploads, Kryptografie und Logging ableiten.
- [ ] **4. OWASP ZAP:** automatisierte Sicherheitsscans in einer isolierten Test-/Staging-Umgebung einrichten.
- [ ] **5. Manuelle Schwachstellentests:** unter anderem XSS, SQL-Injection, CSRF, IDOR/BOLA und SSRF prüfen.
- [ ] **6. Authentifizierung und Sitzungen:** Login, Brute-Force-Schutz, MFA für privilegierte Rollen und Session-Lebenszyklus absichern.
- [ ] **7. Rollen und Mandantentrennung:** sicherstellen, dass Scouts, Vereine und Agenturen ausschließlich berechtigte Daten sehen und ändern können.
- [ ] **8. APIs, Supabase und Datei-Uploads:** Edge Functions, CORS, Rate Limits, Eingabe- und Dateiprüfung sowie Storage-Policies absichern.
- [ ] **9. Datenschutz, Verschlüsselung und Audit:** Datenminimierung, Schlüsselverwaltung, sichere Protokolle und Schutz minderjähriger Spieler umsetzen.
- [ ] **10. Sicherheitsfreigabe:** Befunde beheben und erneut testen, Ergebnisse dokumentieren und vor Produktivstart einen unabhängigen Penetrationstest einplanen.

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


## OWASP Security Baseline (added 2026-11-12)

OWASP wird als kostenlos nutzbarer, fachlicher Sicherheitsmaßstab in die PFSS-Entwicklung aufgenommen. Die Verwendung von OWASP ist weder eine Zertifizierung noch ein automatischer Sicherheitsnachweis. Anforderungen müssen implementiert, getestet und dokumentiert werden.

### Standards und verbindliche Prüfbasis
- [ ] OWASP ASVS 5.0 als technische Anforderungs- und Abnahme-Checkliste für die Webanwendung festlegen; passende Anforderungsebenen je Risiko auswählen.
- [ ] OWASP Top 10 als wiederkehrende Risiko-Orientierung in Architektur- und Code-Reviews verwenden.
- [ ] OWASP Cheat Sheet Series für konkrete Implementierungsentscheidungen zu Authentifizierung, Session Management, Zugriffskontrolle, Eingabevalidierung, Datei-Uploads, Kryptografie, Fehlerbehandlung und Logging heranziehen.
- [ ] Für jede relevante ASVS-Anforderung dokumentieren: betroffenes PFSS-Modul, Umsetzung, Testfall, Ergebnis und offene Abweichung.
- [ ] Sicherheitsanforderungen als Release-Gate definieren; kritische und hohe offene Befunde verhindern eine Produktionsfreigabe.

### Automatisierte und manuelle Sicherheitstests
- [ ] OWASP ZAP in einer isolierten Test-/Staging-Umgebung einrichten und zunächst einen passiven Baseline-Scan durchführen.
- [ ] Aktive ZAP-Scans nur gegen ausdrücklich freigegebene Staging-Ziele mit Testdaten durchführen; niemals ungefragt gegen Produktion.
- [ ] Authentifizierte Tests für Rollen und Mandantentrennung ergänzen; nicht nur öffentlich erreichbare Seiten scannen.
- [ ] Manuelle Tests auf IDOR/BOLA, CSRF, XSS, SQL-/Command-Injection, SSRF, unsichere Uploads, Session-Fixation, Fehlkonfigurationen und unzureichende Zugriffskontrollen durchführen.
- [ ] Negativtests für Mandantentrennung: Scout, Verein und Agentur dürfen fremde Datensätze auch durch manipulierte IDs, API-Aufrufe, Exporte und Dateipfade nicht abrufen oder verändern.
- [ ] Ergebnisse triagieren, beheben, erneut testen und mit Datum/Commit dokumentieren; False Positives nachvollziehbar begründen.
- [ ] Abhängigkeiten und Build-/Deployment-Kette regelmäßig auf bekannte Schwachstellen prüfen; Updates kontrolliert testen und versionieren.
- [ ] Sicherheitsrelevante Tests in CI integrieren, ohne Secrets oder echte personenbezogene Daten offenzulegen.

### PFSS-spezifische Sicherheitsprüfungen
- [ ] Authentifizierung: sichere Passwort-/Username-Flows, Brute-Force-Schutz, MFA-Option für privilegierte Rollen, sichere Wiederherstellung und Session-Lebenszyklus.
- [ ] Autorisierung: serverseitige RBAC-/Mandantenprüfung bei jeder Datenoperation; UI-Ausblendung gilt nicht als Zugriffsschutz.
- [ ] Daten und Datenschutz: Datenminimierung, Verschlüsselung bei Übertragung und Speicherung, sichere Schlüsselverwaltung/Rotation, Protokollierung ohne Geheimnisse.
- [ ] API und Edge Functions: Methoden-Allowlist, CORS-Allowlist, Authentifizierung/Autorisierung, Rate Limits, Größenlimits, Schema-Validierung und sichere Fehlerantworten.
- [ ] Storage und Uploads: private Buckets, konsistente SELECT/INSERT/UPDATE/DELETE-Policies, MIME-/Dateitypprüfung, Größenlimits, sichere Dateinamen und Downloadberechtigungen.
- [ ] Audit und Betrieb: manipulationsgeschützte sicherheitsrelevante Protokolle, Alarmierung, Incident-Response-Ablauf und regelmäßige Rechteprüfung.
- [ ] Minderjährige Spieler: besonders restriktive Zugriffe, Zweckbindung, Einwilligungs-/Freigabeprozesse sowie rechtlich geprüfte Aufbewahrungs- und Löschregeln.

### Abnahme und Grenzen
- [ ] Sicherheitsreview vor jedem größeren Release und nach Änderungen an Auth, Rollen, Datenbank-Policies, APIs oder Uploads wiederholen.
- [ ] Externen Penetrationstest vor produktivem Rollout und danach risikobasiert einplanen.
- [ ] Sicherheitsnachweise und Restrisiken im Release-Protokoll festhalten.
- [ ] OWASP ZAP oder ein bestandener ASVS-Abgleich allein wird nicht als Zertifizierung, vollständiger Penetrationstest oder Garantie der Sicherheit dargestellt.
- [ ] Alle Scans und Tests bleiben auf lokale Testumgebung oder freigegebene Staging-Systeme begrenzt; Produktion und produktive Datenbanken bleiben ohne ausdrückliche Freigabe unangetastet.
