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
- Automatisierte statische Qualitätsprüfungen laufen bei Pushes und Pull Requests; CodeQL prüft JavaScript/TypeScript.

## Selbstständig erledigte Repository-Arbeiten – Durchgang 1 (12.11.2026)

Diese Punkte wurden in diesem Durchgang direkt im Arbeitsbranch bearbeitet und anhand des abgerufenen Quelltexts geprüft. Sie sind bewusst eng abgegrenzt: Ein Quelltext-Check ist kein Live- oder Sicherheitstest.

- [x] Statische JavaScript-Prüfung auf alle fünf zentralen Frontend-Dateien erweitert: `app.js`, `scout-workspace.js`, `workspace-ui.js`, `pfss-finance.js`, `pfss-i18n.js`.
- [x] Inline-JavaScript in `index.html` in die statische Syntaxprüfung aufgenommen.
- [x] Prüfung auf doppelte HTML-IDs in `index.html` durchgeführt: 141 IDs, keine Duplikate zum Prüfzeitpunkt.
- [x] Lokale HTML-Ressourcenprüfung im Validator beibehalten.
- [x] Warnhinweis zur noch offenen CSP-/SRI-Prüfung im Validator ergänzt.
- [x] Vorschaucharakter der generierten Workspace- und Finanzmodule im Quelltext bestätigt; diese Module werden nicht als produktiv angebunden ausgegeben.

### Übergreifende Prüf- und Freigabepunkte
- [x] GitHub-Actions-Lauf des Validators und der PFSS-Sicherheitsregeln auf dem aktuellen Sicherheitsstand erfolgreich geprüft (Commit `8d04f8a34dfb9cd5f9bd0ded5df56cc51d62e106`; beide Prüfungen erfolgreich).
- [x] Vollständigen Validator auf einem vollständigen GitHub-Runner-Checkout ausgeführt; JavaScript-/HTML-Prüfungen und ergänzende PFSS-Sicherheitsregeln bestanden. Ein separater lokaler Rechnerlauf bleibt nicht zwingend erforderlich.
- [ ] Browser-/Gerätetests und Ende-zu-Ende-Funktionstests durchführen.
- [ ] Live-Supabase-Schema, RLS, Grants, Trigger, Funktionen und Storage-Policies anhand des Preflight-Exports verifizieren.
- [~] Edge-Functions im Branch technisch gehärtet (Login: CORS-Allowlist, JSON-/Größenlimits, generische Fehler und vorbereitetes DB-Rate-Limit; R2: JWT und explizite Admin-UUID-Allowlist). Deployment, Supabase-Secrets, Testmigration und Live-Tests fehlen.
- [ ] Backup-Workflow, R2-Zugang und Restore praktisch prüfen.


## Selbstständig erledigte Repository-Arbeiten – Durchgang 2 (12.11.2026)

- [x] Username-Login-Edge-Function im Entwicklungsbranch gehärtet: nur POST, JSON-Pflicht, 8-KiB-Body-Limit (auch anhand der tatsächlichen Bytes), Passwortlängenbegrenzung, konfigurierbare CORS-Origin-Allowlist, generische Anmeldefehler und `Cache-Control: no-store`.
- [x] Verteiltes Username-Login-Rate-Limit im Code vorbereitet: atomare Datenbankzähler für Client-IP (30/15 Min.) und Username/IP-Paar (8/15 Min.), HMAC-SHA-256 mit serverseitigem Pepper statt ungesalzener IP-Hashes; fail-closed bei fehlender RPC oder fehlendem Secret. Die separate Migration ist noch nicht auf Supabase ausgeführt und muss zuerst im Testprojekt geprüft werden.
- [x] R2-Diagnosefunktion auf POST, Supabase-JWT-Validierung und explizite Admin-UUID-Allowlist umgestellt; `verify_jwt = true` in `supabase/config.toml` gesetzt. Ohne die erforderlichen Function-Secrets ist der Zugriff standardmäßig geschlossen.
- [x] Private Scout-Workspace-Migration überarbeitet: Eigentümer-only RLS für Spieler, Berichte und Medienmetadaten; Report-/Medienreferenzen müssen auf Spieler desselben Eigentümers zeigen; Tabellenrechte für `anon` und `public` entzogen; privater Storage mit Owner-Ordner und MIME-/Größenlimits. UPDATE auf Storage-Objekten ist nicht gewährt.
- [x] Nicht belegte Behauptung angeblich bereits geprüfter Live-Voraussetzungen aus der Mandantenmigration entfernt und durch konkrete, noch auszuführende Preflight-Anforderungen ersetzt.
- [x] Statische PFSS-Sicherheitsregeln erstellt und in den GitHub-Qualitätsworkflow integriert. Der erfolgreiche Lauf für Commit `8d04f8a34dfb9cd5f9bd0ded5df56cc51d62e106` führte Static validation und PFSS security guardrails erfolgreich aus.
- [x] OWASP-Matrix mit PFSS-Kontrollen, konkreten Testideen, offenen Belegen und benötigten Function-Secrets erstellt.
- [x] Separates ASVS-5.0.0-Requirement-Mapping mit 67 PFSS-relevanten Anforderungs-IDs, Modulzuordnung und geplanten Abnahmetests erstellt (`docs/ASVS_5.0_PFSS_REQUIREMENT_MAP.md`). Anforderungen sind inventarisiert, aber noch nicht getestet oder als erfüllt bestätigt.
- [x] Restore-Handbuch für die reine Testwiederherstellung erstellt; Durchführung, Storage-Dateisicherung und Integritätsnachweis bleiben offen.
- [x] Manuellen passiven ZAP-Baseline-Workflow mit festem Staging-Ziel eingerichtet; Action ist auf einen verifizierten v0.15.0-Commit gepinnt, Issue-Erstellung deaktiviert und Scan-Fehler sind zunächst nicht CI-blockierend. Workflow wurde noch nicht gestartet.
- [x] Atomaren Datenbank-Rate-Limit-RPC für IP und Username/IP-Paar vorbereitet, mit HMAC-SHA-256-Schlüsseln und `service_role`-geschützter Funktion; Migration noch nicht auf Supabase ausgeführt oder live getestet.
- [x] CodeQL-Workflow (JavaScript/TypeScript, `security-extended` und `security-and-quality`) und wöchentliche Dependabot-Updates für GitHub Actions eingerichtet. CodeQL-Analyse auf Commit `8d04f8a34dfb9cd5f9bd0ded5df56cc51d62e106` erfolgreich.
- [x] Sicherheitsbericht um den Status der neuen Branch-Änderungen ergänzt.

### Neue Konfigurations-/Abnahmeaufgaben vor einem Edge-Function-Deployment
- [ ] Supabase Function Secret `PFSS_ALLOWED_ORIGINS` im jeweiligen Projekt setzen (für Browser-Calls nur exakte, tatsächlich verwendete HTTPS-Origins eintragen).
- [ ] Supabase Function Secret `PFSS_R2_ADMIN_USER_IDS` mit den freigegebenen Supabase-Auth-UUIDs der zuständigen Admins setzen.
- [ ] Supabase Function Secret `PFSS_RATE_LIMIT_HASH_SECRET` als zufälligen Wert mit mindestens 32 Zeichen im Username-Login-Projekt setzen; nicht in GitHub committen.
- [ ] Nach Secret-Konfiguration die beiden Edge Functions auf einer Testumgebung deployen und Login/R2 mit 200/401/403/413/415/Origin-Negativfällen testen.
- [~] Verteiltes Rate-Limit für Username-Login ist durch Edge-Function-Code und separate SQL-Migration vorbereitet; auf Testprojekt anwenden, die vertrauenswürdige IP-Quelle bestätigen und parallele Requests testen.

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
- [x] Die Reihenfolge als verbindliche Projektpriorisierung in dieser Roadmap festgelegt.
- [ ] Kritische Bereiche vor dem produktiven Rollout vollständig prüfen und abnehmen.
- [ ] Abhängigkeiten berücksichtigen: Datenmodell, Mandantentrennung und Berechtigungen müssen stehen, bevor Fachmodule produktiv miteinander verbunden werden.
- [ ] Buchhaltungsfunktionen erst nach fachlicher, steuerlicher und rechtlicher Prüfung produktiv schalten.
- [ ] Backup erst nach einem erfolgreichen Wiederherstellungstest als belastbar einstufen.
- [ ] Fachmodule erst dann als funktional abgeschlossen markieren, wenn echte Datenbank- und Berechtigungsprüfungen sowie Ende-zu-Ende-Tests bestanden sind.

## Zusätzliche verbindliche OWASP-Aufgaben (10-Punkte-Übersicht)

Die folgenden zehn Arbeitspakete sind vollständig Teil der PFSS-To-do-Liste. Die detaillierten Prüfschritte stehen im Abschnitt „OWASP Security Baseline“ weiter unten.

- [x] **1. OWASP ASVS 5.0.0:** als technische Verifikationsbasis festgelegt; Zielniveau Level 2, risikobasierte Zusatzprüfungen. Ein separates Mapping mit 67 PFSS-relevanten Requirement-IDs und Testideen liegt unter `docs/ASVS_5.0_PFSS_REQUIREMENT_MAP.md`.
- [x] **2. OWASP Top 10:2025:** als Risiko-Orientierung in der PFSS-Sicherheitsmatrix festgelegt.
- [~] **3. OWASP Cheat Sheet Series:** als Umsetzungsreferenz für die PFSS-Kontrollbereiche aufgenommen; vollständige modulbezogene Ableitung und Review aller Maßnahmen offen.
- [~] **4. OWASP ZAP:** manuellen passiven Baseline-Workflow ausschließlich für Staging eingerichtet; Scan und Ergebnisprüfung stehen aus.
- [ ] **5. Manuelle Schwachstellentests:** unter anderem XSS, SQL-Injection, CSRF, IDOR/BOLA und SSRF prüfen.
- [~] **6. Authentifizierung und Sitzungen:** Login-Request-Prüfungen, sichere Fehlerantworten und datenbankgestütztes Rate-Limit vorbereitet; Migrationstest, IP-Header-Prüfung, MFA, Wiederherstellungstests und Session-Lifecycle-Tests offen.
- [~] **7. Rollen und Mandantentrennung:** Scout-Eigentümer-Policies und Cross-Reference-Prüfungen im Migrationsentwurf gehärtet; kanonisches Organisationsmodell und Live-Negativtests offen.
- [~] **8. APIs, Supabase und Datei-Uploads:** CORS-Allowlist, Methoden-/Body-/JSON-Prüfungen, JWT-/Admin-Prüfung, vorbereitete verteilte Login-Rate-Limits und private Storage-Policy-Entwürfe umgesetzt; Testmigration, vollständige Uploadvalidierung und Live-Tests offen.
- [ ] **9. Datenschutz, Verschlüsselung und Audit:** Datenminimierung, Schlüsselverwaltung, sichere Protokolle und Schutz minderjähriger Spieler umsetzen.
- [ ] **10. Sicherheitsfreigabe:** Befunde beheben und erneut testen, Ergebnisse dokumentieren und vor Produktivstart einen unabhängigen Penetrationstest einplanen.

## Reihenfolge der verbleibenden Arbeiten

### 1. Sicherheits- und Berechtigungskonzept

- [ ] Live-Schema-Inventar ausführen und tatsächliche Tabellen, Policies, Grants, Trigger und Funktionen sichern.
- [ ] Kanonisches Organisationsmodell bestimmen; parallele Modelle nicht ohne Datenabgleich löschen.
- [~] Die private Scout-Workspace-Migration ist von `public.is_admin()` entkoppelt; Definition und Nutzung der Funktion in übrigen Migrationen/RPCs bleiben live zu prüfen.
- [ ] Einladungscodes auf Ablauf, Einmalverwendung, Widerruf und Rollenbegrenzung testen.
- [ ] Negativtests: Scout A darf weder Spieler, Berichte, Medien noch Organisationsdaten von Scout/Verein B lesen oder ändern.
- [~] Username-Login hat Request-Limits, generische Fehler und atomare, datenbankgestützte Limits für Client-IP und Username/IP-Paar samt Migration im Branch. Migration auf Testprojekt, Verifizierung des `CF-Connecting-IP`-Headers in der konkreten Supabase-Edge-Umgebung und Parallel-Request-Test fehlen.
- [~] Beide Edge Functions nutzen `PFSS_ALLOWED_ORIGINS`; die exakten Origins müssen vor Deployment als Supabase Function Secret gesetzt und live geprüft werden.
- [~] R2-Diagnose verlangt im Branch ein gültiges Supabase-JWT und eine `PFSS_R2_ADMIN_USER_IDS`-UUID-Allowlist; Secret-Konfiguration, Deployment und Laufzeittest stehen aus.
- [~] Private Storage-Migrationsentwürfe erlauben ownergebundenes SELECT/INSERT/DELETE; UPDATE ist absichtlich nicht freigegeben. Live-Policy-Nebenwirkungen und tatsächliche Bucket-Konfiguration noch testen.
- [ ] Minderjährigendaten: Zweckbindung, minimale Erhebung, Freigaben, Lösch- und Aufbewahrungsregeln rechtlich prüfen.

### 2. Technische Grundfunktionen und Systemüberwachung

- [ ] Healthchecks für Frontend, Auth, Datenbank und Storage getrennt definieren.
- [~] Neue Edge-Function-Fehlerantworten und Logs geben keine Passwörter, Tokens oder Provider-Fehlerdetails aus; eine zentrale, überwachte Logpipeline ist offen.
- [ ] Einheitliche Lade-, Fehler-, Leer- und Erfolgszustände für alle Module.
- [ ] Wiederholbare Smoke-Tests für Anmeldung, Abmeldung, Navigation und Kernabfragen.
- [~] CodeQL-Analyse und wöchentliche Dependabot-Updates für GitHub Actions eingerichtet; der initiale CodeQL-Lauf war erfolgreich. Supabase-CDN-Version, CSP und SRI sind weiterhin offen.

### 3. Workspace-Bereiche vereinheitlichen

- [x] Workspace- und Finance-Vorschauen sind im Quelltext als visuelle Vorschau/sample data gekennzeichnet; die Vorschau darf nicht als produktive Datenbankfunktion gewertet werden.
- [ ] Gemeinsame Komponenten für Tabellen, Filter, Dialoge, Formulare und Statusanzeigen.
- [ ] Einheitliche Rechteprüfung vor jeder Aktion.
- [x] Die generierten Workspace- und Finance-Screens verwenden klar erkennbare Beispiel-/Demodaten und kennzeichnen ihre Vorschau-Funktion.

### 4. Scouting und Datenqualität

- [ ] Spieler-Dublettenprüfung mit manueller Zusammenführung statt automatischem Löschen.
- [ ] Einheitliche Bewertungs-Skala und dokumentierte Kriterien.
- [ ] Historie je Spieler mit Datum, Scout und Bericht.
- [~] Spielerfilter sind in der bestehenden Oberfläche vorhanden/erweitert; ein vollständiger Spieler-Vergleich mit Datenbank- und Berechtigungsanbindung ist noch offen.
- [ ] Export nur für berechtigte Nutzer und mit Datenschutzprüfung.

### 5. Administration und Benachrichtigungen

- [ ] Rollen-/Rechteübersicht aus der tatsächlichen serverseitigen Berechtigungsquelle; noch nicht umgesetzt, da das kanonische Rollenmodell nicht feststeht.
- [~] Einladungs-/Mitgliedschaftsgrundlagen und RPCs sind im Repository vorbereitet; Statusdarstellung und Ende-zu-Ende-Tests der Abläufe sind offen.
- [~] `audit_log`-Struktur ist vorhanden; Vollständigkeit, Zugriffsschutz, Manipulationsschutz und tatsächliche Event-Abdeckung sind nicht abgenommen.
- [ ] Benachrichtigungen mit Präferenzen und nachvollziehbarem Status.

### 6. Datenschutz, Backup und Wiederherstellung

- [ ] Prüfen, ob alle benötigten GitHub Secrets eingerichtet sind.
- [ ] Manuellen Backup-Lauf durchführen und Upload verifizieren.
- [x] Restore-Anleitung für ein isoliertes Testprojekt ergänzt (`docs/BACKUP_RESTORE_RUNBOOK.md`); es ist ausdrücklich kein Restore-Test durchgeführt.
- [ ] Wiederherstellung in einer separaten Testdatenbank tatsächlich durchführen.
- [ ] Supabase-Storage-Dateiobjekte zusätzlich zum Datenbank-Dump sichern; aktuell enthält das Backup nur die Datenbank, nicht die hochgeladenen Dateien.
- [~] Restore-Handbuch nennt die offenen Punkte; konkrete Aufbewahrungsfristen, Schlüsselrotation und Zugriffskonzept noch verbindlich festlegen.
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
- [x] OWASP ASVS 5.0.0 als technische Anforderungs- und Abnahme-Checkliste mit Zielniveau Level 2 festgelegt; PFSS-relevante Anforderungen sind in einem Mapping dokumentiert.
- [x] OWASP Top 10:2025 als wiederkehrende Risiko-Orientierung in Architektur- und Code-Reviews festgelegt.
- [~] OWASP Cheat Sheet Series als Umsetzungsreferenz für Authentifizierung, Session Management, Zugriffskontrolle, Eingabevalidierung, Uploads, Kryptografie, Fehlerbehandlung und Logging aufgenommen; vollständige modulbezogene Ableitung und Review offen.
- [~] Für die PFSS-Sicherheitsbereiche eine Kontrollmatrix sowie ein Mapping von 67 ASVS-5.0.0-Anforderungs-IDs mit PFSS-Zuordnung und Testideen angelegt; tatsächliche Testergebnisse, Requirement-Einzelnachweise und Abweichungsbehebung bleiben offen.
- [x] Sicherheitsanforderungen als Release-Gate dokumentiert; kritische und hohe offene Befunde verhindern eine Produktionsfreigabe.

### Automatisierte und manuelle Sicherheitstests
- [~] Manuellen OWASP-ZAP-Baseline-Workflow nur für Staging eingerichtet; passiven Scan manuell starten, Report prüfen und Befunde triagieren.
- [ ] Aktive ZAP-Scans nur gegen ausdrücklich freigegebene Staging-Ziele mit Testdaten durchführen; niemals ungefragt gegen Produktion.
- [ ] Authentifizierte Tests für Rollen und Mandantentrennung ergänzen; nicht nur öffentlich erreichbare Seiten scannen.
- [ ] Manuelle Tests auf IDOR/BOLA, CSRF, XSS, SQL-/Command-Injection, SSRF, unsichere Uploads, Session-Fixation, Fehlkonfigurationen und unzureichende Zugriffskontrollen durchführen.
- [ ] Negativtests für Mandantentrennung: Scout, Verein und Agentur dürfen fremde Datensätze auch durch manipulierte IDs, API-Aufrufe, Exporte und Dateipfade nicht abrufen oder verändern.
- [ ] Ergebnisse triagieren, beheben, erneut testen und mit Datum/Commit dokumentieren; False Positives nachvollziehbar begründen.
- [~] CodeQL-Workflow für JavaScript/TypeScript und Dependabot für GitHub-Actions-Abhängigkeiten eingerichtet; initiale CodeQL-Analyse erfolgreich. Vollständiges Dependency-Audit, Supabase-CDN-Version, CSP/SRI und Deployment-Kette noch prüfen.
- [x] Statische PFSS-Sicherheitsregeln in den Qualitätsworkflow integriert und auf GitHub erfolgreich ausgeführt; dynamische/autorisierten Negativtests sind davon getrennt.

### PFSS-spezifische Sicherheitsprüfungen
- [~] Authentifizierung: Username-/Passwort-Request-Validierung und IP-/Username-IP-Rate-Limit mit HMAC-Pepper vorbereitet; Migration, Header-Verifikation, MFA für privilegierte Rollen, Wiederherstellung und Session-Lifecycle noch testen.
- [ ] Autorisierung: serverseitige RBAC-/Mandantenprüfung bei jeder Datenoperation; UI-Ausblendung gilt nicht als Zugriffsschutz.
- [ ] Daten und Datenschutz: Datenminimierung, Verschlüsselung bei Übertragung und Speicherung, sichere Schlüsselverwaltung/Rotation, Protokollierung ohne Geheimnisse.
- [~] API und Edge Functions: Methoden-/CORS-Allowlist, Authentifizierung/Autorisierung, vorbereitete verteilte Rate-Limits, Größen-/JSON-Prüfungen und sichere Fehlerantworten im Branch; Live-Konfiguration und -Tests offen.
- [~] Storage und Uploads: privater Bucket mit Owner-basierten SELECT/INSERT/DELETE-Policies und MIME-/Größenlimits als Migration vorbereitet; UPDATE nicht gewährt. Live-RLS, Datei-Inhaltsprüfung, Malware-Scan, Dateinamen und Downloadberechtigungen offen.
- [ ] Audit und Betrieb: manipulationsgeschützte sicherheitsrelevante Protokolle, Alarmierung, Incident-Response-Ablauf und regelmäßige Rechteprüfung.
- [ ] Minderjährige Spieler: besonders restriktive Zugriffe, Zweckbindung, Einwilligungs-/Freigabeprozesse sowie rechtlich geprüfte Aufbewahrungs- und Löschregeln.

### Abnahme und Grenzen
- [ ] Sicherheitsreview vor jedem größeren Release und nach Änderungen an Auth, Rollen, Datenbank-Policies, APIs oder Uploads wiederholen.
- [ ] Externen Penetrationstest vor produktivem Rollout und danach risikobasiert einplanen.
- [ ] Sicherheitsnachweise und Restrisiken im Release-Protokoll festhalten.
- [x] In der Sicherheitsmatrix ausdrücklich festgehalten: ZAP/ASVS sind keine Zertifizierung, kein vollständiger Penetrationstest und keine Sicherheitsgarantie.
- [x] Sicherheitsgrenze dokumentiert: Scans und Tests ausschließlich lokal oder auf ausdrücklich freigegebenem Staging; Produktion und produktive Datenbanken bleiben ohne Freigabe unangetastet.
