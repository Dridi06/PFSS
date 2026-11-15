# Ergänzung 15.11.2026 – Sitzungsisolation der Plattformadministration

- Die administrativen Leseansichten binden ihre Antworten jetzt an Benutzer-ID, Auth-Generation und bestätigten Adminstatus. Antworten nach Logout, Kontowechsel oder Rollenentzug werden verworfen, statt alte Verwaltungsdaten in eine neue Sitzung einzublenden.
- Für Benutzer-, Mitgliedschafts-, Organisations-/Scout- und Systemereignislisten gilt zusätzlich „latest request wins“: Eine verspätete Antwort einer älteren Suche darf eine neuere Filterauswahl nicht überschreiben.
- Organisationsdetails, Einladungsantworten, globale Mitgliedschaftsänderungen und administrative Systemereignis-Aktionen werden ebenfalls gegen veraltete Sitzungen und Detailauswahlen abgesichert.
- Neue Regressionstests in `tests/auth-session-lifecycle-smoke.mjs` schützen diese Verträge. Die Änderung ersetzt keine serverseitige Autorisierung: Supabase-RPC-Prüfungen, RLS und Datenbankrechte bleiben zwingend.
- Implementierung: Commit `17acbdb4be5646ae63de06384273e4ec1740735b`; Detail-/Triage-Erweiterung: `e563bb8227bf3de1320182850b0328a2b72eaa04`; globale Mitgliedschaftsänderungen: `ac1eafa6fbb3c982977164ce13a774bc3fbd823a`; Regressionstests: `4fbae7f13f89150988eadc9c6daf3770801549a9`.
- Noch nicht durch einen neuen CI-Lauf bestätigt. Keine Datenbankmigration, kein Staging-/Produktionsdeployment und keine Änderung an `main` oder Produktivdaten.

---

# Ergänzung 15.11.2026 – Render-Staging-Blueprint durch Regressionstest abgesichert

- Der Build-Konfigurationstest prüft jetzt zusätzlich die Staging-Blueprint-Grenzen in `render.yaml`: genau ein Staging-Service, Static Runtime, ausschließlich der Feature-Branch, getesteter Build-/Publish-Pfad, explizites `staging`-Buildziel, private Render-Variablen, automatische Deployments erst nach erfolgreichen Checks sowie CSP und HSTS.
- Damit werden versehentliche Änderungen an der Render-Blueprint-Konfiguration frühzeitig erkannt, bevor ein Staging-Deploy gestartet wird. Es werden keine Render-Einstellungen oder externen Umgebungsvariablen durch diesen Test verändert.
- Der erste CI-Lauf machte einen veralteten Wortlaut in einem UI-Regressionstest sichtbar. Die Prüfung wurde auf die tatsächliche Modulübersicht angepasst; anschließend waren beide GitHub-Actions-Jobs erfolgreich: [GitHub Actions – Run 43710877349](https://github.com/Dridi06/PFSS/actions/runs/43710877349).
- Verifizierter Commit: `e02a5115db98f224a16796e664d94dcbd1343abb`.
- Die erfolgreiche CI ist ein Quellcode-/Build-Nachweis, keine echte Render- oder Supabase-Abnahme. Render-Blueprint wurde nicht im Konto angewendet; kein Deployment, keine Datenbankmigration und keine Änderung an `main` oder Produktionsdaten.

---

# Ergänzung 15.11.2026 – Navigationsschutz für Plattformadministration

- Administrationsseiten sind zusätzlich gegen direkte oder veraltete UI-/History-Navigation abgesichert. Konten ohne bestätigte Plattform-Adminrolle werden auf das Dashboard zurückgeführt.
- Die Navigation bleibt eine reine Oberflächenbarriere: Sie ersetzt weder RLS noch serverseitige RPC-Prüfungen und darf nicht als alleiniger Zugriffsschutz verstanden werden.
- Die Regressionstests für Authentifizierung und Sitzungslebenszyklus prüfen auch die Admin-Routen-Sperre. Die Staging-Abnahme muss zusätzlich den Versuch direkter Navigation mit einem Nicht-Admin-Testkonto enthalten.
- Ausschließlich Feature-Branch; keine Render-/Supabase-Änderung, keine Migration, keine Änderung an `main` oder Produktivdaten.

---

# Ergänzung 15.11.2026 – Authentifizierungs- und Sitzungslebenszyklus gehärtet

- Profilstatus und Plattformrolle werden bei Token-Erneuerung und Benutzeraktualisierung erneut serverseitig aus `profiles` gelesen. Die Supabase-Auth-Callbacks werden nicht durch synchrone Folgeabfragen blockiert.
- Bei Rückkehr in einen sichtbaren Browser-Tab erfolgt höchstens einmal pro Minute eine erneute Sitzungs-/Profilprüfung. Bei unverändertem Benutzer und unveränderter Rolle bleibt die aktuelle Ansicht erhalten; die Teamzuordnungen werden erneut über die geschützte RPC geladen.
- Parallele Profilprüfungen besitzen eine Generationssperre: verspätete Antworten dürfen einen neueren Login-/Logout-Zustand nicht überschreiben. Abgemeldete, nicht freigegebene oder in ihrer Plattformrolle geänderte Konten verlieren den bisherigen lokalen Authentifizierungszustand.
- Neue Regressionstests: `tests/auth-session-lifecycle-smoke.mjs`, eingebunden in `npm test` und GitHub Actions. Die Tests prüfen Request-Rennen, Freigabestatus, Rollenwechsel, Token-Erneuerung, Logout und Tab-Rückkehr.
- Dies ist ein Frontend-/CI-Sicherheitsnachweis. Reale Rollenwechsel, Sperrungen und Teamzuordnungsänderungen müssen zusätzlich mit getrennten Konten in der Staging-Datenbank abgenommen werden. Serverseitige RLS-/RPC-Prüfungen bleiben die maßgebliche Zugriffskontrolle.
- Ausschließlich Feature-Branch. Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung oder Migration, keine Änderung an `main` oder Produktivdaten.

---

# Ergänzung 15.11.2026 – RLS-Abdeckung aller Migrationstabellen automatisiert geprüft

- Die CI prüft jetzt jede durch eine Repository-Migration neu angelegte öffentliche Tabelle: Sie muss im Read-only-Staging-Audit enthalten sein und RLS aktiviert haben.
- FORCE RLS wird grundsätzlich verlangt. Eng begrenzte, geprüfte Ausnahmen sind dokumentiert: `organization_invitations`, `pfms_platform_owner` und `pfms_owner_bootstrap_requests` besitzen aktivierte RLS und widerrufene direkte Tabellenrechte für Browserrollen; die Legacy-Grundlagentabellen `pfms_organizations`, `pfms_memberships` und `pfms_scout_profiles` verwenden ihre expliziten authentifizierten SELECT-Policies ohne direkte Schreib-Policies. Die Tests schützen diese Ausnahmen gegen unbeabsichtigte Ausweitung.
- Es wurde bewusst keine FORCE-RLS-Migration auf diese Bestandsmodelle gelegt: Die Ausnahmen werden nicht durch pauschale Schemaänderungen „repariert“, bevor die tatsächlichen Security-Definer-/Trigger-Ausführungspfade und die externe Staging-Datenbank geprüft sind.
- Vollständiger GitHub-Actions-Lauf für Commit `0b06940b38e88405ce4ad92142e5d91b81c7588c` erfolgreich: Node-Projekt-/Build-/Smoke-/Backup-Prüfungen und Deno-Typprüfung. [GitHub Actions – Run 43660461337](https://github.com/Dridi06/PFSS/actions/runs/43660461337).
- Dies ist ein statischer Migrations-/CI-Nachweis, kein Laufzeitbeweis für die reale Datenbank. Die read-only Staging-Abnahme mit tatsächlichen Rollen, Policies und getrennten Testkonten bleibt erforderlich.
- Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung oder Migration, keine Änderung an `main` oder Produktivdaten.

---

# Ergänzung 15.11.2026 – Vollständigkeit des Staging-Audits automatisch abgesichert

- Der Migrationstest vergleicht jetzt jede in den Supabase-Migrationen neu angelegte Tabelle mit der expliziten Tabellenliste des Read-only-Staging-Audits. Fehlt künftig eine Tabelle im Audit, schlägt der CI-Test fehl, statt dass Schema-/RLS-/Policy-/Grant-Informationen unbemerkt fehlen.
- Die Prüfung ist bewusst additiv und read-only: Sie verändert keine Migration, kein Datenbankschema und keine Daten. Neue Tabellen müssen künftig entweder in den Audit aufgenommen oder mit einer dokumentierten, begründeten Ausnahme versehen werden.
- Vollständiger GitHub-Actions-Lauf für Commit `e1668a0166de23c7a1504e38a39198bb72e14055` erfolgreich: Node-Projekt-/Build-/Smoke-/Backup-Prüfungen und Deno-Typprüfung. [GitHub Actions – Run 43660208898](https://github.com/Dridi06/PFSS/actions/runs/43660208898).
- Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung oder Migration, keine Änderung an `main` oder Produktivdaten.

---

# Ergänzung 15.11.2026 – Read-only-Staging-Audit erweitert, CI vollständig grün

- Das Skript `supabase/STAGING_READ_ONLY_AUDIT.sql` inventarisiert jetzt **alle vorhandenen Storage-Buckets** statt ausschließlich `pfss-scout-private`. Dadurch werden unerwartete oder zusätzliche Buckets sichtbar, bevor ein Storage-Backup oder eine Migration geplant wird.
- Der Audit weist zusätzlich aus, ob die Supabase-Migrationshistorie unter `supabase_migrations.schema_migrations` vorhanden ist. Die konkreten Versionsstände werden weiterhin verbindlich mit `supabase migration list` und `supabase db push --dry-run` geprüft; das Audit ersetzt diese CLI-Prüfung nicht.
- `tests/migration-syntax-smoke.mjs` schützt jetzt die Audit-Grenzen: genau eine read-only SQL-Abfrage, keine DDL-/DML-/GRANT-/REVOKE-Anweisungen, vollständige Bucket-Inventarisierung und Prüfung der Migration-Ledger-Erkennung.
- Vollständiger GitHub-Actions-Lauf für Commit `163f8680e7ef7aeca4899001f646c071cc57fc43` erfolgreich: Node-Projekt-/Build-/Smoke-/Backup-Prüfungen und Deno-Typprüfung. [GitHub Actions – Run 43659970112](https://github.com/Dridi06/PFSS/actions/runs/43659970112).
- Ausschließlich Feature-Branch. Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung, keine Migration und keine Änderung an `main` oder Produktivdaten. Render bleibt bis zur vereinbarten späteren Staging-Runde unangetastet.

---

# Ergänzung 15.11.2026 – R2-Transport-Härtung und CI-Nachweis

- Der CI-Fehler im R2-Adapter-Smoke-Test wurde behoben: Die temporäre Backup-Datei bleibt während der Kollisionsprüfung innerhalb ihres temporären Verzeichnisses verfügbar.
- Der folgende vollständige CI-Lauf auf Commit `bc4424bfe41eb158c62f1f1e4b0ac948eee0aea5` war erfolgreich: Projekt-/Build-/Smoke-/Accessibility-/SQL-/Backup-Prüfungen sowie Deno-Typprüfung.
- Der R2-Transportadapter akzeptiert als Zielhost nun ausschließlich einen kanonischen HTTPS-Host unter `*.r2.cloudflarestorage.com`. Fremde Hosts, manipulierte Suffixe, Zugangsdaten in URLs, Pfade, Query-/Fragmentteile, nicht erlaubte Ports und fehlerhafte Portangaben werden vor Übergabe der Credentials an den Runner abgewiesen.
- Die Regressionstests prüfen zusätzlich Host-Allowlist, Normalisierung des Hostnamens, fehlerhafte Ports und bösartige Lookalike-Domains. Der CI-Nachweis für den neuesten Commit `37b8e808b418b674e8d960c9d2b1fa51746c26e8` ist noch ausstehend.
- Die R2-Transportfunktion bleibt ein injizierter Adapter. Ein realer R2-Upload, die Verifikation der Cloudflare-Kontoidentität und ein vollständiger Restore sind nicht erfolgt. Der HEAD-vor-PUT-Ablauf ist ausdrücklich keine atomare No-Overwrite-Garantie.

---

# PFMS – Verbindlicher Projektstatus

Stand: 14.11.2026  
Geschätzter Gesamtfortschritt: **ca. 42 %** (Arbeitsfortschritt, keine abgenommene Funktionsquote)  
Arbeitsbranch: `feature/pfss-complete-platform-build`  
Produktivbranch: `main`  
Produktionsfreigabe: **nicht erteilt**

> Alle Implementierungen erfolgen zunächst im Entwicklungszweig und in einer getrennten Testumgebung. Es gibt kein Produktionsdeployment ohne dokumentierte Abnahme und ausdrückliche Freigabe.

## 1. Gesamtbefund

PFMS ist noch kein vollständig integriertes Fußballmanagementsystem. Der Bestand besteht aus einem umfangreichen statischen Frontend, Supabase-Authentifizierung, mehreren vorhandenen SQL-Migrationen und teilweise bereits angebundenen Verwaltungsfunktionen. Viele fachliche Module sind bisher nur Oberflächen oder Teilfunktionen.

Die erste Repository-Aufnahme umfasste 33 Einträge einschließlich Verzeichnissen. Seitdem wurden eine Node-Projektkonfiguration, Smoke-Tests und ein GitHub-Actions-Workflow ergänzt. Eine Render-Blueprint-Konfiguration für einen getrennten Static-Site-Stagingdienst ist jetzt im Repository ergänzt. Sie wurde noch nicht im Render-Konto angewendet; der tatsächliche Servicetyp des bestehenden Testdiensts muss weiterhin verifiziert werden.

### Aktueller Sicherheitsfortschritt – Supabase-Umgebungstrennung

Die bisher im Browser fest eingetragene Supabase-URL und der Publishable Key wurden aus `app.js` entfernt. Der Build generiert jetzt `dist/pfms-config.js` aus Umgebungsvariablen. Der Staging-Build erzwingt die Übereinstimmung zwischen Staging-Projekt-Referenz und Supabase-URL und verweigert fehlende Konfigurationen sowie Secret-/Service-Role-Keys. Der GitHub-CI-Build nutzt ausschließlich nicht funktionsfähige Platzhalterdaten. Damit wird verhindert, dass das Staging-Frontend versehentlich an die zuvor im Quelltext hinterlegte Supabase-Instanz gekoppelt wird.

**Noch nicht verifiziert:** Es muss im Supabase-Dashboard ein eigenständiges Staging-Projekt eindeutig bestätigt und dessen öffentliche Build-Konfiguration in Render eingetragen werden. Existenz und Datenisolation dieses externen Projekts lassen sich nicht aus dem Git-Repository ableiten.

### Username-Login: Redis-Rate-Limit ergänzt – 14.11.2026

- Die Edge Function verwendet Upstash Redis mit einem atomaren gleitenden Fenster: maximal 5 fehlgeschlagene Versuche je normalisiertem Benutzernamen pro 15 Minuten; erfolgreiche Anmeldungen und interne Supabase-/Datenbankfehler verbrauchen kein Kontingent. Überschreitungen erhalten HTTP 429 mit `Retry-After`. Die Zählerprüfung und Erhöhung sind getrennte Redis-Aufrufe; parallel bereits laufende Requests können das Limit kurzfristig überschreiten.
- Redis-Schlüssel verwenden HMAC-SHA-256 mit dem separaten Secret `PFMS_RATE_LIMIT_HMAC_KEY`; Benutzernamen werden nicht im Klartext als Redis-Schlüssel gespeichert.
- Redis-/HMAC-Konfiguration fehlt oder Redis ist nicht erreichbar: Login wird fail-closed mit HTTP 503 abgewiesen. Es gibt keinen ungeschützten Fallback.
- Es wird bewusst keine IP-Identität aus ungeprüften Forwarding-Headern abgeleitet. Der Schutz ist ein kontobezogenes Passwortversuchs-Limit, noch kein vollständiger IP-/Bot-Schutz gegen verteilte Versuche über viele Benutzernamen.
- Staging benötigt eine eigene Upstash-Datenbank sowie `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` und `PFMS_RATE_LIMIT_HMAC_KEY`; Function anschließend neu deployen und mit Positiv-/Negativtests abnehmen. Noch nicht deployed oder live verifiziert.
- Regressionstests und Staging-Konfiguration sind im selben Feature-Branch ergänzt. Nach der Korrektur auf fehlgeschlagene Versuche sind beide GitHub-Actions-Jobs erfolgreich: Node-Projektprüfungen und Deno-Typprüfung. Lauf: https://github.com/Dridi06/PFSS/actions/runs/43639086053.

### Username-Login: Antwortdaten minimiert – 14.11.2026

- Die Edge Function `username-login` gibt nach erfolgreicher Anmeldung ausschließlich die Sitzungstokens und Sitzungsmetadaten zurück. Das vollständige Supabase-Userobjekt wird nicht mehr in der Function-Antwort ausgegeben; damit wird insbesondere die darin enthaltene E-Mail-Adresse nicht zusätzlich offengelegt.
- Der Browser setzt die Sitzung weiterhin ausschließlich mit `access_token` und `refresh_token`; der Login-Ablauf bleibt damit kompatibel.
- Ein Regressionstest prüft die notwendige Token-Antwort und verbietet die Rückgabe von `sessionData.user`.
- GitHub Actions auf Commit `25a04e87599d931199501a501d01720568fe891a` waren erfolgreich: Node-Syntax-/Build-/Smoke-/Accessibility-/SQL-/Funktionsrechte-/Backup-Prüfungen und Deno-Typprüfung bestanden. Lauf: https://github.com/Dridi06/PFSS/actions/runs/43638575504
- Dies ist ein Code-/CI-Nachweis. Die Function ist dadurch nicht automatisch im Supabase-Projekt deployed; der Login muss in Staging Ende-zu-Ende geprüft werden.

### Zusätzliche Sicherheitsregressionen – 14.11.2026
- Weitere Abnahmeprüfungen sichern die neueste neunte Berechtigung `tasks`, das Finanzjournal (keine Direktlöschung, Korrektur über Storno) sowie die zusammengesetzten Team-Fremdschlüssel für Eventteilnehmer und Reisepläne.
- GitHub Actions auf Commit `9e79fe95504bb9249a7145134b391c7a671f6963` erfolgreich: Node-Projektprüfungen und Deno-Typprüfung. Lauf: https://github.com/Dridi06/PFSS/actions/runs/43639759307.

- Erweiterte Team-Berechtigungstests prüfen nun die acht granularen Module, Edit-nur-mit-View, vollständige Permission-Payloads, aktive Organisationsmitgliedschaft mit passender Rolle sowie die Teamgrenzen bei Anwesenheit und Spielaufstellung.
- GitHub Actions auf Commit `5cf45b8aefebe69d5d5845565e7a1b0b5d62ba18` erfolgreich: Node-Projektprüfungen und Deno-Typprüfung. Lauf: https://github.com/Dridi06/PFSS/actions/runs/43639654925.

- Zusätzlich zählen interne Profil-/Auth-Dienstfehler nicht als falsche Passwörter; sie liefern HTTP 503 und verbrauchen kein Fehlversuchskontingent. Die entsprechende Regression ist im CI enthalten.
- Aktueller vollständiger GitHub-Actions-Nachweis nach diesen Login-Korrekturen: beide Jobs erfolgreich auf Commit `081d9486972a04ae95238d163822d9e814032e69`. Lauf: https://github.com/Dridi06/PFSS/actions/runs/43639401973.


- Die automatisierten Prüfungen decken jetzt zusätzlich die private Benachrichtigungs-Tabelle ab: FORCE RLS, Empfänger-Isolation und ausschließliches Update des Lesestatus.
- Support-Tickets: transaktionale Begrenzung auf 10 Einträge je Konto in 24 Stunden, Eigentümer-/Admin-Isolation und eingeschränkte Admin-Updatefelder.
- Private Scout-Medien: FORCE RLS, UID-basierter Storage-Pfad und Zuordnung nur zu eigenen Spielern.
- R2-Verbindungstest: JWT-Verifikation und zusätzliche serverseitige Administratorprüfung.
- GitHub Actions auf Commit `dc69a3a5ea4002fee4a70b183b35aef8777cd807` erfolgreich: Node-Projektprüfungen und Deno-Typprüfung. Lauf: https://github.com/Dridi06/PFSS/actions/runs/43639327757.
- Diese Tests prüfen Quelltext-/Migrationsinvarianten. Sie ersetzen keine realen RLS-/Rollen-Negativtests gegen die getrennte Staging-Datenbank.

### Passkey/WebAuthn – erste Frontend-Integration – 14.11.2026

- Die bestehende Supabase-Auth-Instanz wird mit der experimentellen Passkey-API aktiviert; das Browser-SDK ist auf mindestens v2.105.0 festgesetzt.
- Der Login-Bildschirm enthält zusätzlich „Mit Passkey anmelden“. Nach erfolgreicher Passkey-Authentifizierung wird derselbe serverseitige PFMS-Profil- und Zugangscheck wie beim bisherigen Login ausgeführt.
- Im angemeldeten Dashboard gibt es eine Funktion zum Einrichten eines Passkeys. Die Registrierung läuft über `supabase.auth.registerPasskey()`; die privaten Schlüssel bleiben beim Geräte-Authenticator.
- Passwort- und Benutzername-Login bleiben als Rückfallweg erhalten. Es wurden keine Konten, Rollen oder bestehenden Auth-Daten verändert.
- **Noch nicht aktiv/verifiziert:** Im getrennten Supabase-Stagingprojekt müssen Passkey-Authentifizierung und WebAuthn-Relying-Party konfiguriert werden. RP-ID und erlaubte Origins müssen exakt zur finalen Staging-Domain passen. Die RP-ID darf nach Ausgabe erster Passkeys nicht leichtfertig geändert werden.
- **Noch offen:** Staging-E2E-Test auf iOS/Safari, Android/Chrome und Desktop; Passkey-Verwaltung/Entfernen; verbindliche MFA-/Recovery-Regeln; Hardware-Sicherheitsschlüssel für Plattforminhaber; Produktions-RP-Konfiguration. Da Supabase die Passkey-API als experimentell kennzeichnet, bleibt Passwortlogin bis zur vollständigen Abnahme verfügbar.
- Diese Codeänderungen liegen ausschließlich im Feature-Branch und sind nicht automatisch in Render oder Supabase deployed.

## 2. Vorhandene Bausteine

### Build- und Umgebungsisolation (neu)
- Das Frontend enthält keine fest eingetragene Supabase-Projekt-URL oder Publishable-Key mehr; die Werte werden in `pfms-config.js` beim Build erzeugt.
- Der Staging-Build verlangt die exakte Staging-Projekt-Referenz und stoppt, wenn sie nicht zur Supabase-URL passt.
- Browser-Builds akzeptieren nur Publishable-/Anon-Keys; Secret-/Service-Role-Schlüssel werden abgewiesen.
- GitHub-CI baut mit einem Platzhalterprojekt und greift nicht auf eine echte Supabase-Instanz zu.
- Der Staging-Build bricht nachweislich bei fehlenden Verbindungsdaten, abweichender Projekt-ID/URL und Secret-Schlüsseln ab; diese Fälle sind automatisiert regressionsgetestet.
- Die Edge-Function-CORS-Fallbackliste erlaubt nur lokale Entwicklungs-Origins; Staging und Produktion müssen ihre Origins explizit konfigurieren.
- Die Signup-Trigger für Benutzernamen-Synchronisierung und das ergänzende Organisationsmodell verwenden jetzt einen leeren festen `search_path`; direkte Ausführung durch Browserrollen ist entzogen. Das Verhalten der Trigger bleibt unverändert, bis das doppelte Organisationsmodell nach dem Staging-Audit entschieden wird.
- Die zuletzt geprüften Branch-Stände bestehen beide GitHub-Actions-Jobs: Node-/Build-/Smoke-/Accessibility-/SQL-Prüfungen einschließlich Staging-Build-Fehlkonfigurationen und SECURITY-DEFINER-Suchpfad-/Revoke-Prüfungen sowie Deno-Typprüfung aller Edge Functions.
- Render benötigt die vier Staging-Variablen im Environment des getrennten Static-Site-Dienstes. Bis diese gesetzt sind und der Build im Render-Konto erfolgreich ist, ist Staging nicht deployfähig.


### Frontend
- Die vier Zugangspakete (Mitglied, Verein, Agentur, Einzelscout) werden untereinander dargestellt; Monats-/Jahreswahl ist je kostenpflichtiger Karte direkt möglich, der aktive Zyklus ist für Screenreader über `aria-pressed` erkennbar. Die Jahresersparnis ist ausgewiesen. Eine echte Zahlungsabwicklung ist weiterhin deaktiviert.
- `index.html`: Hauptanwendung mit rund 18 Hauptansichten.
- `app.js`: Navigation, Authentifizierung, Dashboard, Haupt-Spieler-/Berichtsfunktionen und Administrator-RPCs.
- `styles.css`, `scout-workspace.css`: Designbasis.
- `scout-workspace.js`: jetzt mit Supabase-CRUD für private Scout-Spieler und -Berichte sowie privatem Medien-Upload, signierten Medienabrufen und Löschfunktionen verbunden.
- `rechtliches.html`: rechtliche Informationsseite; Impressum und Kontaktdaten sind noch nicht veröffentlichungsfertig. Die Platzhalter für Betreiberidentität, ladungsfähige Anschrift und Kontakt-E-Mail müssen mit echten Angaben des Betreibers ersetzt und fachlich/rechtlich geprüft werden.

### Authentifizierung und Administration
- Supabase Auth wird im Browser verwendet.
- Anmeldung per E-Mail oder Benutzername; die Benutzernamenauflösung läuft über `username-login`.
- Passwort-Wiederherstellung, Registrierung und Profilprüfung sind vorhanden.
- Profile werden aus `public.profiles` geladen.
- Die zentrale Benutzerverwaltung verwendet `pfss_admin_list_profiles` und `pfss_admin_update_profile`.
- Sitzungspersistenz ist explizit aktiviert.
- Normaler Reload überspringt jetzt die Willkommensanimation und stellt die bestehende Sitzung direkt wieder her.
- Clientseitige Admin-Prüfungen verwenden `pfssIsRealAdmin`, um sowohl `admin` als auch `administrator` konsistent zu behandeln.

### Datenbank und Edge Functions
Vorhandene Migrationen betreffen:
- Benutzername-Registrierung und Admin-Kontrollfunktionen.
- Legacy-Organisationen, Mitgliedschaften und Einladungen.
- Serverseitige Berechtigungsprüfung `can_manage_org(uuid)` für Einladungen: nur aktive Organisationsinhaber bzw. Vereins-/Agenturadministratoren; fester leerer `search_path`, kein `PUBLIC`-/`anon`-EXECUTE.
- Ein zusätzliches neues Organisations-/Mitgliedschaftsmodell.
- Private Scout-Spieler, Berichte, Medien und einen privaten Storage-Bucket.
- Edge Functions: `username-login`, `r2-connection-check`, `pfms-owner-bootstrap`.

### Sicherung
- Ein GitHub-Actions-Workflow erstellt verschlüsselte PostgreSQL-Dumps, prüft das Archiv vor und nach der Verschlüsselung und lädt Archiv plus separates HMAC-SHA-256-Manifest in Cloudflare R2.
- `scripts/backup-hmac.py` enthält die gemeinsame PBKDF2-/HMAC-Schlüsselableitung und Manifestprüfung für Backup und Restore. Der Workflow verwendet für OpenSSL und HMAC dieselbe Secret-Variable; ein fehlendes oder manipuliertes Manifest stoppt die Entschlüsselung.
- Der reale R2-Lauf hängt von korrekt gesetzten Repository-Secrets ab; ein vollständiger Restore muss weiterhin in einer isolierten Staging-Umgebung praktisch getestet werden.
- Der kontrollierte Ablauf für Migrationen, Edge-Function-Deploy, Read-only-Audit, Rollen-/Negativtests und Render-Staging ist in `docs/STAGING_DEPLOYMENT.md` dokumentiert.

## 3. Offene bzw. unvollständige Funktionen

| Bereich | Aktueller Stand | Noch erforderlicher Nachweis / Arbeit |
|---|---|---|
| Haupt-Spielerdatenbank | Supabase-Tabelle `pfms_global_players`; FORCE RLS, Lesen für freigegebene Konten, Schreibrechte nur für Plattformadministratoren; Such-/Sortierfilter und CSV-Export der gefilterten Treffer vorhanden | Migration in Staging anwenden; CRUD-, RLS- und Mandantentests; Alt-Daten nur nach bewusster Importbestätigung übernehmen |
| Haupt-Scoutingberichte | Supabase-Tabelle `pfms_main_scouting_reports`; Anlegen/Bearbeiten/Löschen durch Verfasser oder Administrator; Admin kann alle sehen, normale Konten nur eigene Berichte; CSV-Export der sichtbaren Berichte vorhanden | Migration in Staging anwenden; positive/negative RLS- und CRUD-Tests |
| Haupt-Medienbereich | Private Benutzer-Medienbibliothek mit Supabase-Storage, signierten Abrufen, Metadaten und Löschfunktion im Entwicklungszweig | Staging-Migration anwenden; Upload, MIME-/Größenlimits, Owner-RLS und Negativtests auf fremde Dateien abnehmen |
| Privater Scout-Bereich | Private Supabase-CRUDs und Storage; globale Spielersuche mit Übernahme in private Scout-Datenbank vorbereitet | Migrationen in Staging anwenden; Suche, Übernahme, CRUD-, RLS- und Storage-Tests verwenden |
| Vereine und Agenturen | Live-Organisationsübersicht, Organisations-Mitgliederverwaltung und Einladungslinks; Scouting-Abteilung listet aktive Scouts je verwalteter Organisation; Verwaltungsseite verlinkt echte Mitglieder-/Teamworkflows | Organisationsweite frei definierbare Rechteprofile, vollständige Organisationspflege, Beitrags-/Austrittsabläufe sowie positive/negative Staging-Rollentests |
| Mannschaften und Staff | Legacy-Teamtabellen mit RLS; Teams und Trainerteam; Live-Übersicht Trainer/Co-Trainer/Betreuer je eigener Mannschaft; global verknüpfter Kader; neun getrennte Modulrechte; Trainingstermine und spielerbezogene Anwesenheit mit serverseitigen Rechteprüfungen | Team-, Rechte-, Kader-, Trainings- und Anwesenheitsmigrationen in Staging anwenden; positive/negative Zugriffstests je Rolle abnehmen |
| Trainer-/Team-Workspace | Teamübersicht, Trainerteam, granularer Rechte-Editor, Kader, Trainingsübungen/Einheitenpläne, Anwesenheit, Kalender, Spiele/Aufstellungen, Mannschaftskasse, Trainingszyklen/Wochenplanung, Taktik-/Videoanalyse, Turnier-/Eventansicht, Kader-Anmeldelisten/RSVP und detaillierter teamgebundener Fahrtplan mit Abfahrt, Ankunft, Rückfahrt, Anbieter, Fahrzeug, Sitzplätzen und Gesamtkosten im Entwicklungszweig angebunden | Team-/Analyse-/Event-/Teilnehmer-/Logistik-/Reiseplanmigrationen in Staging anwenden; positive/negative Rollen-, Teamgrenzen-, Zeitfolgen- und Kapazitätstests abnehmen |
| Vereinsmitgliedschaften | Einmalige Einladungslinks für verwaltbare Legacy-Organisationen; Rollen Scout/Trainer/Co-Trainer/Betreuer/Mitglied und Laufzeit 1–30 Tage; Codes werden nur gehasht gespeichert | Staging-Migrationen anwenden; Einladung erzeugen, Link öffnen, Registrierung mit E-Mail-Bestätigung und einmalige Einlösung/Nichtwiederverwendung Ende-zu-Ende testen; neue Guard-Migration verhindert Einlösung nach Sperrung einer Organisation; Beitrags- und Austrittsabläufe sind offen |
| Vereins-Scouting | Aktive Scouts je verwalteter Organisation werden über die Mitgliedschafts-RPC angezeigt; Scout-Einladung öffnet den bestehenden Einmal-Link-Workflow | Beobachtungsgebiete, Verantwortungsbereiche und organisationsbezogene Berichtsfreigaben |
| Plattforminhaber | Einmaliger Owner-Claim und Aktivierungsoberfläche im Entwicklungszweig vorbereitet | Staging-Migration/Secret/Edge-Function deployen; bestätigte E-Mail, korrekter Owner, Zweitclaim-Sperre und Negativtests abnehmen |
| Administration | Benutzerverwaltung, Organisationssuche, globale Mitgliederliste, minimierte Frontend-Fehlererfassung und Admin-Fehlerprotokoll im Entwicklungszweig vorhanden | Migrationen in Staging anwenden; Organisations-/Mitgliederworkflows, Audit, Sperren und Supportprozesse Ende-zu-Ende testen |
| Zahlungen | Ausschließlich unverbindliche Tarifvorschau; kein Checkout, keine Zahlung, kein Vertrag und keine aktive Testphase. Kostenpflichtige Registrierung stoppt vor der Kontoanlage und speichert keine Trial-/Billing-Metadaten. | Anbieterentscheidung, verbindliche Preis-/USt.-Festlegung, signierte Webhooks, Abrechnung, Testzahlungen, Kündigung/Erstattung und Rechtsprüfung |
| Kalender, Aufgaben, Nachrichten | Mannschaftskalender, private persönliche Aufgaben, gemeinsame Teamaufgaben mit Zuweisung an aktives Teamstaff, Priorität, Fälligkeit und Status; persönliche In-App-Mitteilungen bei Teamaufgaben- und Supportereignissen; Support-Ticket-Postfach | Organisationsweiter Kalender sowie Push-/E-Mail-Benachrichtigungen und weitere Benachrichtigungstypen |
| Fehlerüberwachung | Frontend-Fehler werden nach Redaktion sensibler Werte kontobezogen protokolliert; Adminansicht kann filtern und Status setzen | Migration in Staging anwenden, Fehler-Ingest, RLS, Statusänderungen und Aufbewahrung testen |
| Sicherheit | einzelne RLS-Policies und Security-Definer-Funktionen | gesamtes Policy-/Grant-/Storage-Inventar und Negativtests |
| Backup | Verschlüsselter PostgreSQL-Dump nach R2; Archiv wird vor und nach Verschlüsselung mit `pg_restore --list` geprüft; Upload-Objekt wird verifiziert | Secrets prüfen, Backup manuell ausführen und vollständigen Restore in eine neue isolierte Staging-Datenbank praktisch abnehmen |
| Render | `render.yaml` definiert `pfms-staging-static` auf dem Feature-Branch; noch nicht im Render-Konto angewendet | Bestehenden Testdiensttyp/Branch prüfen, Blueprint kontrolliert anwenden, Build-Logs und Browser-Test abnehmen |
| Qualitätssicherung | GitHub Actions: Syntax, Build, Smoke, Accessibility, SQL-Migrationen und Deno-Typprüfung sind auf dem Entwicklungsbranch automatisiert; letzte Branch-Läufe erfolgreich | Browser-/E2E-, Datenbank-, RLS-, Mandanten-, Datenschutz- und Restore-Tests |

## 3a. Umgesetzter Team-Betrieb

- **Kader:** Globale Spieler können einer Legacy-Mannschaft zugeordnet werden; Rückennummer, Positionsabweichung und Kaderstatus werden getrennt pro Team gespeichert.
- **Teamaufgaben:** Gemeinsame Aufgaben können im Team angelegt, einem aktiven Teammitglied zugewiesen, bearbeitet und gelöscht werden. Status (`open`, `in_progress`, `done`, `cancelled`), Priorität und Fälligkeit werden gespeichert; die Berechtigung `tasks` steuert die Sichtbarkeit und Bearbeitung, und die Datenbank begrenzt Zuweisungen auf Mitglieder derselben Mannschaft. Der Anfangsstatus wird beim Erstellen übernommen.
- **In-App-Mitteilungen:** Die Migrationen `20261207_pfms_in_app_notifications.sql` und `20261208_pfms_support_ticket_notifications.sql` ergänzen einen persönlichen, RLS-geschützten Posteingang. Datenbanktrigger erstellen Mitteilungen bei Teamaufgabenzuweisung/-abschluss sowie bei Supportantworten und Ticketabschluss. Browserkonten können nur eigene Einträge lesen und `is_read` ändern; Supportmitteilungen führen zurück zum eigenen Ticket. Die Seitenleiste zeigt ungelesene Mitteilungen. Push-/E-Mail-Zustellung bleibt offen.
- **Training:** Termine mit Titel, Datum, Beginn/Ende, Ort, Schwerpunkt und Notizen können durch Benutzer mit `training.edit` angelegt werden. Berechtigte Trainer können geplante Einheiten abschließen oder absagen. Ein teambezogener Übungskatalog speichert Kategorien, Dauer, Spielerzahl, Schwierigkeitsgrad, Material, Aufbau, Ablauf und Coachingpunkte; mehrere Übungen können mit Reihenfolge, Dauer und Einheitenhinweis in einem Trainingsplan kombiniert werden.
- **Anwesenheit:** Für jede Einheit wird eine Liste der Kaderspieler angezeigt. Mit `attendance.edit` lassen sich Status (anwesend, abwesend, entschuldigt, verletzt, verspätet oder offen) und Notiz pro Spieler speichern. Die Datenbank blockiert Zuordnungen zu einer anderen Mannschaft.
- **Zugriff:** `training.view/edit` und `attendance.view/edit` sind getrennte Module. Tabellen sind nicht direkt für Browser-Schreibzugriffe freigegeben; Änderungen laufen über berechtigungsgeprüfte RPCs.
- **Mannschaftskasse:** Einnahmen und Ausgaben in EUR werden dem Team zugeordnet. `finance.view` erlaubt die Übersicht, `finance.edit` zusätzlich das Buchen und Stornieren. Der Kassenstand berücksichtigt alle aktiven Buchungen; die Oberfläche zeigt die letzten 200 Buchungen. Originalbuchungen werden nicht gelöscht, sondern mit Benutzer, Zeit und Begründung storniert. Es handelt sich nicht um Bank- oder Zahlungsabwicklung.
- **Zusätzlich umgesetzt:** Mannschaftskalender, Spielansetzungen und Ergebnisse sowie Spieltagskader und matchbezogene Aufstellungen mit Startelf, Ersatzbank, Position, Reihenfolge und Kapitän.
- **Trainingszyklen:** Die Migration `20261201_pfms_legacy_training_cycles.sql` ergänzt teamgebundene Makrozyklen und automatisch datierte Wochen-Mikrozyklen. Wochenziele, Belastung 1–5, Trainerhinweise und Zuordnung von Trainingsterminen werden über `training.view/edit` und serverseitige RPCs verwaltet. Die Oberfläche leert Zyklusdaten und Formularzustände bei Team-, Rechte- und Kontowechsel.
- **Taktik-/Videoanalyse:** Die Migration `20261202_pfms_legacy_team_analysis.sql` ergänzt teambezogene Auswertungen mit Spielbezug, Spielphase, Stärken, Verbesserungen, Maßnahmen und Video-HTTPS-Link mit Zeitmarke. RLS ist erzwungen, direkte Browser-Schreibzugriffe sind entzogen und alle Lese-/Änderungs-RPCs prüfen `analysis.view/edit`. Die Datenbank verlangt nun einen nichtleeren HTTPS-Host und weist Userinfo in der URL zurück.
- **Veranstaltungen und Fahrtplanung:** Die Migrationen `20261203` bis `20261205` erweitern den Teamkalender um separat berechtigte Veranstaltungen, Teilnehmer/RSVP, Anmeldeschluss, Kapazität und detaillierte Fahrtenpläne. Team-/Event-Verknüpfungen und Sitzplatzgrenzen werden serverseitig geprüft. Die Funktionen sind im Entwicklungszweig verbunden; eine Laufzeitabnahme in Staging steht noch aus.
- **Zusätzlich umgesetzt:** Teambezogener Übungskatalog mit geordneten Einheitenplänen sowie eine Mannschaftskasse für Einnahmen/Ausgaben mit Kassenstand und nachvollziehbarer Stornierung.
- **Noch offen:** die Ende-zu-Ende-Abnahme sämtlicher Teamfunktionen und die reale Prüfung der Event-Transport- und Kapazitätsabläufe in Staging. Trainingszyklen/Wochenplanung, Taktik-/Videoanalyse, Eventverwaltung, Anmeldelisten und der detaillierte Fahrtplan sind im Entwicklungszweig verbunden, aber noch nicht auf der Supabase-Testdatenbank abgenommen.

### Teamkalender

Der Mannschaftskalender verwendet `pfms_legacy_team_calendar_events` als gemeinsame Datenbasis. Der Kalenderbereich enthält ausschließlich Spiel-, Besprechungs- und sonstige Mannschaftstermine; Lesen und Ändern laufen über `calendar.view` bzw. `calendar.edit`. Turniere und allgemeine Veranstaltungen sind dem separat berechtigten Veranstaltungsbereich (`events.view/edit`) vorbehalten. Die direkte SELECT-Policy und die SECURITY-DEFINER-RPCs erzwingen dieselbe Typgrenze; Browser-Schreibzugriffe auf die Tabelle bleiben gesperrt. Die additive Härtung liegt in `20261216_pfms_roster_select_permission_gate.sql` (Kader-SELECT) und `20261217_pfms_calendar_events_rpc_boundary.sql` (Kalender-/Event-RPC-Grenze). Beide Migrationen sind noch in Staging anzuwenden und mit getrennten Rollen zu testen.

Die separate Veranstaltungsansicht nutzt dieselbe Tabelle statt eines parallelen Event-Datenbestands. Die Migration `20261203_pfms_legacy_team_events.sql` ergänzt `events.view` und `events.edit`: Nutzer mit Event-Recht sehen ausschließlich Turniere und allgemeine Veranstaltungen, nicht Spiel- oder Besprechungstermine. CRUD erfolgt über eigene geprüfte RPCs. Kalenderrechte gewähren ausdrücklich keinen Zugriff auf Event-/Turnierzeilen; diese Trennung wird zusätzlich durch die Migration `20261217_pfms_calendar_events_rpc_boundary.sql` auch innerhalb der SECURITY-DEFINER-RPCs erzwungen. Die Migration `20261204_pfms_legacy_team_event_participants.sql` ergänzt Anmeldelisten aus dem Mannschaftskader mit Eingeladen/Zugesagt/Abgesagt/Anwesend/Nicht erschienen; die Zuordnung wird durch zusammengesetzte Fremdschlüssel auf denselben Event und Mannschaftskader begrenzt. Lesen/Schreiben unterliegt `events.view/edit`; direkte Tabellen-Schreibzugriffe bleiben gesperrt. Das Frontend zeigt Teilnehmer inline in der Veranstaltungskarte. Die zusätzliche Migration `20261205_pfms_legacy_team_event_logistics.sql` ergänzt Treffpunkt, Anmeldeschluss, Transportart, Anreisehinweise, Kosten pro Person und Kapazität. Die Kapazität wird beim Anlegen, bei RSVP-Statusänderungen und beim Ändern der maximalen Teilnehmerzahl serverseitig geprüft; Eventzeilen und Kapazitätsänderungen werden über eine einheitliche RPC und Event-Zeilensperren serialisiert. Noch offen ist die reale Staging-Abnahme. Die ergänzende Migration `20261205_pfms_legacy_team_event_travel_plans.sql` fügt je Veranstaltung einen detaillierten Fahrtplan hinzu: Abfahrtsort/Ziel, Treffzeit, Abfahrt, Ankunft, Rückfahrt, Transportanbieter, Fahrzeug, Sitzplatzanzahl, geschätzte Transportgesamtkosten und Hinweise. Sie nutzt dieselbe Event-/Team-Zuordnung, verlangt `events.view/edit`, erzwingt RLS und sperrt direkte Browser-Schreibzugriffe. Treffpunkt und grundlegende Transportart bleiben ausschließlich in der gemeinsamen Event-Logistik gespeichert. Die ergänzende Migration `20261205_pfms_legacy_team_event_travel_plans.sql` speichert je Veranstaltung eine detaillierte Fahrtstrecke mit Abfahrtsort, Ziel, Treffzeit, Abfahrt, Ankunft, Rückfahrt, Transportanbieter, Fahrzeug, Sitzplätzen und geschätzten Gesamtkosten. Sie ergänzt die Logistikdaten, verwendet deren Treffpunkt/Transportart weiter und erzwingt `events.view/edit`, Forced RLS sowie eine teamgebundene Event-Fremdschlüsselbeziehung. Direkte Tabellen-Schreibzugriffe bleiben gesperrt. Die Migration prüft zusätzlich, dass die Fahrzeug-Sitzplatzkapazität nicht kleiner als die Zahl der aktiven Einladungen/Zusagen/Teilnahmen ist; dieselbe Grenze gilt bei neuen Anmeldungen und RSVP-Statuswechseln unter einer einheitlichen Event-Zeilensperre. Eine fehlerhafte Constraint auf eine nicht vorhandene Spalte wurde entfernt.

## Teamspielbetrieb

- `pfms_legacy_team_matches` speichert Spielansetzungen, Gegner, Wettbewerb, Heim/Auswärts, Spielstätte, Status und Ergebnisse.
- `pfms_legacy_team_match_lineup` speichert eine matchbezogene Aufstellung mit Startelf/Ersatzbank, Position, Reihenfolge und Kapitän. Alle Spieler müssen zum Kader der Mannschaft gehören.
- Lesen und Ändern werden durch `matches.view/edit` kontrolliert. Die Datenbank erzwingt maximal elf Startelf-Spieler und höchstens einen Kapitän. Direkte Browser-Schreibzugriffe auf die Tabellen bleiben gesperrt.
- **Übungskatalog und Einheitenplan:** Die Migration `20261126_pfms_legacy_training_exercises.sql` ergänzt Mannschaftsübungen und die Verknüpfung mit Trainingseinheiten. Teamrechte `training.view/edit` gelten für Katalog und Plan. Zusammengesetzte Fremdschlüssel verhindern teamfremde Übungen; die Plan-RPC prüft Anzahl, Reihenfolge, Dauer und Teamzugehörigkeit vor dem Austausch des bestehenden Plans. Direkte Browser-Schreibzugriffe bleiben gesperrt. Frontend und CI-Smoke-Tests sind verbunden; Staging-Migration und Rollen-/Browserabnahme stehen noch aus.

Die Migration `20261125_pfms_legacy_team_matches.sql` enthält Spielansetzungen, Ergebnisse und matchbezogene Aufstellungen. `matches.view/edit` werden serverseitig geprüft; die SQL-Funktionen erzwingen Teamzugehörigkeit, maximal elf Startelf-Spieler und höchstens einen Kapitän. Die Oberfläche unterstützt Erstellen/Bearbeiten von Spielen, Ergebnis-/Statuspflege, Spieltagskandidaten und das Speichern der Aufstellung. Die Migration muss noch in Staging angewendet und mit verschiedenen Teamrollen Ende-zu-Ende geprüft werden.

## 4. Kritische Architekturentscheidung: Organisationsmodell

Die vorhandenen Migrationen belegen zwei parallele Datenmodelle:

1. Ältere Tabellen: `public.organizations` und `public.organization_memberships`. Die bestehende Admin-Verwaltung und die Einladungsfunktion verwenden dieses Modell.
2. Neuere Tabellen: `public.pfms_organizations`, `public.pfms_memberships` und `public.pfms_scout_profiles`. Eine neue Signup-Triggerfunktion provisioniert in dieses zweite Modell.

Bevor weitere Organisations- oder Teamfunktionen ergänzt werden, muss der tatsächliche Staging-Schema-Stand aufgenommen und ein einziges kanonisches Modell festgelegt werden. Es erfolgt keine automatische Zusammenführung, Löschung oder Migration auf Grundlage bloßer Annahmen.

Dafür wurde `supabase/STAGING_READ_ONLY_AUDIT.sql` bereitgestellt. Das Skript ist rein lesend und erfasst Tabellen/Spalten, RLS, Policies, Grants, Constraints, Trigger, relevante Funktionen, Storage-Konfiguration sowie geschätzte Zeilenbestände der beiden Organisationsmodelle und ihrer Mitgliedschaftstabellen. Die Zeilenzahlen basieren auf PostgreSQL-Statistiken und sind Näherungswerte, keine exakten Counts. Es muss im **Staging-Supabase-Projekt** ausgeführt und das Ergebnis geprüft werden.

Die Delegation von Organisationsrechten ist im Feature-Branch mit eigener SQL-Migration, Mitgliederansicht und Admin-Dialog für Bereichsrechte integriert. Sie ist noch nicht in Staging angewendet oder Ende-zu-Ende getestet. Die bestehenden Teamfachrechte bleiben davon getrennt.

## 5. Sicherheits- und Integrationsrisiken

- Alle drei Edge Functions verwenden im Entwicklungszweig jetzt eine gemeinsame CORS-Origin-Allowlist statt `*`. Standardmäßig sind ausschließlich lokale Entwicklungsdomains zugelassen. Staging und Produktion müssen `PFMS_ALLOWED_ORIGINS` in den jeweiligen Supabase-Function-Secrets ausdrücklich und getrennt konfigurieren. Die geänderten Functions sind noch nicht deployed; die Live-Funktionen behalten bis dahin ihre bisherige Konfiguration.
- Die Username-Login-Funktion begrenzt die Request-Body-Größe und die Passwortzeichenlänge. Ein belastbares serverseitiges Rate-Limit und zusätzlicher Missbrauchsschutz sind weiterhin offen.
- RLS, Grants, Security-Definer-Funktionen und Storage-Policies sind noch nicht vollständig im tatsächlichen Datenbankzustand geprüft. Die im Repository fehlende Legacy-Organisationsprüfung `can_manage_org(uuid)` ist jetzt ergänzt; beim Staging-Audit ist zu prüfen, ob bereits eine gleichnamige Funktion existiert und welche Definition derzeit aktiv ist.
- Die Frontend-Fehlertelemetrie speichert nur bereinigte Fehlermeldungen, route-/quellenbezogene Pfade ohne Query-Strings und Zeilen-/Spaltennummern. Stack-Traces werden bewusst nicht gespeichert; die Erfassung ist auf fünf Ereignisse pro Minute begrenzt. Die Admin-Ansicht zeigt höchstens die 200 neuesten Ereignisse. Staging-RLS- und Datenschutzabnahme stehen noch aus.
- Jede Organisationsressource braucht einen eindeutigen Mandantenbezug und serverseitige Autorisierung.
- Der einmalige Owner-Bootstrap ist im Entwicklungszweig implementiert: bestätigte E-Mail, dedizierter Registrierungsweg, separates Function-Secret, serverseitige JWT-Prüfung, service-role-RPC und Singleton-Owner-Tabelle. Die zusätzliche Migration `20261116_pfms_owner_bootstrap_registration_guard.sql` protokolliert den Owner-Registrierungsweg beim erstmaligen Anlegen des Auth-Kontos in einer für Benutzer gesperrten Tabelle; spätere Änderungen von `user_metadata` reichen nicht aus. Noch offen sind beide Staging-Migrationen, Secret-Konfiguration, Edge-Function-Deploy sowie positive/negative Ende-zu-Ende-Tests.
- Zahlungsfunktionen bleiben deaktiviert. Die Tarifauswahl ist nur eine Vorschau; kostenpflichtige Registrierungen werden vor der Kontoanlage gestoppt und erzeugen keine Testphase oder Abrechnungsmetadaten. Erst nach Anbieterentscheidung, Vertrags-/Steuerprüfung, signierten Webhooks und abgeschlossenen Testzahlungen darf eine echte Buchungsstrecke implementiert und ausdrücklich freigegeben werden.
- Legale Betreiber-/Impressumsangaben und Datenschutztexte müssen vor einem öffentlichen Start fachlich und rechtlich geprüft werden.

## 6. Aktuelle Qualitätsbasis und letzte Änderungen

- Der Owner-Aktivierungsbereich wird nur für Konten angezeigt, die beim ursprünglichen Signup den dedizierten Typ `owner_bootstrap` gewählt haben. Die Datenbankmigration sichert diese Auswahl serverseitig ab und erlaubt keine nachträgliche Selbstfreischaltung über änderbare User-Metadaten.

- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` ergänzt den persistenten globalen Spielerkatalog und verfassereigene Haupt-Scoutingberichte. Plattformadministratoren können globale Spieler anlegen/bearbeiten; RLS erlaubt freigegebenen Konten den Lesezugriff. Backups und lokale Alt-Daten werden über eine begrenzte transaktionale Admin-RPC mit neu zugewiesenen IDs importiert.
- Der Scout-Bereich hat eine globale schreibgeschützte Spielersuche mit Filtern erhalten. Ein globales Profil kann einmalig als private Scout-Kopie übernommen werden; die Quelle wird in `source_global_player_id` verknüpft.
- `supabase/migrations/20261128_pfms_personal_tasks.sql` ergänzt private persönliche Aufgaben mit Fälligkeit, Priorität und Status.
- `supabase/migrations/20261129_pfms_support_tickets.sql` ergänzt vertrauliche Supporttickets: Nutzer sehen eigene Anfragen, Plattformadministratoren sehen und beantworten alle Tickets; RLS und eingeschränkte Update-Spalten trennen die Rechte. RLS erzwingt Eigentümerzugriff für freigegebene Konten; das Frontend lädt, erstellt, aktualisiert und löscht Aufgaben mit Sitzungs-/Kontowechsel-Schutz.
- Der Vereinsbereich lädt verwaltbare Organisationen live, verknüpft Mitglieder- und Mannschaftsverwaltung und zeigt aktive Scouts je Organisation. Organisationsdaten werden bei Abmeldung und Kontowechsel aus dem Frontendzustand entfernt.
- Das Support-Postfach erlaubt Nutzern private Anfragen und Administratoren Status-/Antwortbearbeitung. Push-/E-Mail-Benachrichtigungen und eine verbindliche Aufbewahrungsfrist sind noch offen.

- `supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql`, `supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql` und `supabase/functions/pfms-owner-bootstrap/index.ts` ergänzen den einmaligen Owner-Claim mit unveränderbarer Registrierungsberechtigung, verifizierter Supabase-Sitzung, separatem Function-Secret, ausschließlich service-role-RPC und Singleton-Datensatz. UI zeigt die Aktivierung nur Konten mit dem speziellen Registrierungsweg; beide Migrationen und die Function sind noch nicht in Staging angewendet/deployed.
- `supabase/functions/_shared/cors.ts` implementiert eine gemeinsame CORS-Origin-Allowlist; `username-login` und `r2-connection-check` verwenden sie. Die Staging-Origin muss vor dem Deploy über `PFMS_ALLOWED_ORIGINS` freigegeben werden.
- `supabase/migrations/20261114_scout_workspace_integrity.sql` ergänzt Datenbankgrenzen für Scout-Daten, automatische `updated_at`-Zeitstempel und die Prüfung, dass Medien-Metadaten nur in den eigenen Benutzerordner zeigen. Die Migration wurde im Repository korrigiert, aber noch nicht in Supabase ausgeführt.
- `supabase/migrations/20261118_pfms_scout_force_rls.sql` erzwingt RLS zusätzlich auf den privaten Scout-Tabellen `pfss_scout_players`, `pfss_scout_reports` und `pfss_scout_media`. Die vorhandenen Owner-/Admin-Policies bleiben unverändert; die Migration prüft vorab, dass RLS für alle drei Tabellen aktiviert ist. Sie ist noch nicht in Staging angewendet.
- Die Scout-Basis-Migration `20261112_private_scout_workspaces.sql` verwendet für Admin-Policies jetzt `public.pfms_is_admin()`, das bereits in der vorherigen Organisationsmigration definiert wird. Damit hängt die Erstellung der Scout-Policies nicht mehr von der erst später angelegten Legacy-Kompatibilitätsfunktion `public.is_admin()` ab. Der CI-Smoke-Test prüft diese Reihenfolge ausdrücklich.
- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` ergänzt den global lesbaren Spieler-Katalog, autorisierte Admin-Schreibvorgänge, persönliche Scoutingberichte und einen begrenzten, transaktionalen Import vorhandener Browser-Backups. Die Migration wurde noch nicht in Staging angewendet.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql` ergänzt einen erzwungenen RLS-Fehlerlog mit kontobezogenem Insert und Admin-only Review. Frontend-Logging redigiert bekannte Token-/Passwortwerte und begrenzt die Rate; Migration und Browser-Integration müssen noch in Staging geprüft werden.
- `supabase/migrations/20261117_pfms_system_event_hardening.sql` beschränkt Admin-Updates auf Status-/Abschlussfelder, macht den ursprünglichen Fehlernachweis unveränderbar und weist häufige Credential-/Tokenmuster bereits in der Datenbank zurück. Diese Folge-Migration muss nach der Basis-Migration ebenfalls in Staging angewendet und geprüft werden.
- `supabase/migrations/20261117_pfms_main_media_library.sql` ergänzt `pfms_main_media` mit erzwungener Owner-RLS und privatem Storage im vorhandenen Bucket. Die Haupt-Medienansicht unterstützt Upload, signierte Anzeige und Löschen; die Migration wurde noch nicht in Staging angewendet.
- `supabase/migrations/20261127_pfms_legacy_team_finance.sql` ergänzt ein teambezogenes EUR-Buchungsjournal für Einnahmen und Ausgaben, einen serverseitig berechneten Kassenstand sowie begründete Stornierungen. `finance.view/edit` steuert Lese- und Bearbeitungszugriff; direkte Browser-Schreibzugriffe und physisches Löschen sind gesperrt. Oberfläche und RPC-Aufrufe sind im Entwicklungszweig verbunden; Staging-Migration, Rollen- und Browserabnahme stehen noch aus.
- `supabase/migrations/20261123_pfms_legacy_team_training.sql` ergänzt mannschaftsbezogene Trainingstermine und Anwesenheitslisten. Trainer/Co-Trainer/Betreuer erhalten Zugriff je nach `training.view/edit` und `attendance.view/edit`; Anwesenheitseinträge verweisen auf konkrete Kaderzuordnungen und werden serverseitig auf dieselbe Mannschaft geprüft. Die Oberfläche kann Termine mit Datum, Uhrzeit, Ort, Schwerpunkt und Notizen anlegen, Einheiten abschließen/absagen und den Status jedes Kaderspielers (anwesend, abwesend, entschuldigt, verletzt, verspätet oder offen) mit Notiz speichern. Die Migration ist noch nicht in Staging ausgeführt oder im Browser abgenommen.
- `supabase/migrations/20261122_pfms_legacy_team_permissions.sql` legte historisch acht Berechtigungsbereiche je Teamzuordnung an; die Folge-Migration `20261206_pfms_legacy_team_tasks.sql` erweitert das Modell auf neun Bereiche: Kader, Training, Anwesenheit, Mannschaftskasse, Veranstaltungen, Kalender, Spiele und Analyse. Co-Trainer/Betreuer erhalten standardmäßig keine Modulrechte, bis ein Trainer oder eine berechtigte Vereinsleitung sie setzt. Die Funktion `pfms_has_legacy_team_permission(team_id, module_key, action)` ist als serverseitige Prüfbasis für künftige RLS-Policies vorgesehen; UI und RPCs speichern Lesen/Bearbeiten getrennt, und Bearbeiten setzt Lesen voraus. Die Migration ist noch nicht in Staging angewendet.
- `supabase/migrations/20261121_pfms_legacy_team_management.sql` ergänzt das Team- und Trainerteam-Modell auf Basis der bestehenden `public.organizations`.
- `supabase/migrations/20261122_pfms_legacy_team_roster.sql` ergänzt die Mannschaftszuordnung zur globalen PFMS-Spielerdatenbank. Trikotnummer, Kaderstatus und optionale Positionsabweichung gehören zur Teamzuordnung; das globale Spielerprofil bleibt davon unabhängig und wird beim Entfernen aus dem Kader nicht gelöscht. Die Kader-RPCs prüfen `pfms_has_legacy_team_permission(team_id, 'squad', 'view'|'edit')`: Leserechte erlauben die Anzeige, Bearbeitungsrechte zusätzlich Suche, Hinzufügen, Aktualisieren und Entfernen. Die Oberfläche verwendet dieselben vom Server geladenen Berechtigungen. Die Migration ist noch nicht in Staging angewendet. Die Oberfläche `view-teams` lädt verwaltete und persönlich zugewiesene Mannschaften; berechtigte Vereinsleitungen/Trainer können Teams anlegen, bearbeiten und archivieren sowie Trainer, Co-Trainer und Betreuer aus aktiven Vereinsmitgliedern zuordnen und entfernen. Die Funktionen verwenden erzwungene RLS und serverseitige Teamrechte. Migration und Browser-Ende-zu-Ende-Abnahme stehen noch aus.
- `supabase/migrations/20261119_pfms_legacy_invitation_workspace.sql` und `20261120_pfms_legacy_invitation_workspace_hardening.sql` ergänzen die verwaltbare Organisationsliste und härten die Erzeugung einmaliger Einladungscodes. Die Ansicht `view-club-members` kann für eigene verwaltbare Organisationen Links mit Rolle und Laufzeit erstellen; der rohe Code wird nicht in der Datenbank gespeichert und nur einmal an den Ersteller zurückgegeben. Die Einladung wird bei der Registrierung über `?invite=...` eingelöst. Die Staging-Abnahme ist noch offen.
- `supabase/migrations/20261118_pfms_legacy_org_manager_guard.sql` ergänzt die bisher im Repository fehlende Funktion `public.can_manage_org(uuid)`. Die Prüfung erlaubt nur dem angemeldeten Benutzer mit aktiver Mitgliedschaft in der Rolle `owner`, `club_admin` oder `agency_admin` die Verwaltung der betreffenden Legacy-Organisation. Die Einladungs-RPC verwendet diesen Server-Check; die Migration ist noch nicht in Staging angewendet.
- `supabase/migrations/20261115_admin_global_member_directory.sql` und die Ansicht `view-admin-members` ergänzen eine serverseitig geschützte organisationsübergreifende Mitgliedersuche sowie Rollen-/Statusänderungen. Die Migration ist noch nicht in Staging ausgeführt.
- Die Haupt-Spielerdatenbank nutzt `pfms_global_players` und bietet im Entwicklungszweig Admin-CRUD. Die Haupt-Scoutingberichte nutzen `pfms_main_scouting_reports` und bieten CRUD für Verfasser/Admin; die RLS-Policies setzen die gleiche Zugriffstrennung serverseitig durch. Die Spieler-Fremdschlüsselbeziehung nutzt `ON DELETE RESTRICT`, damit die Historie nicht kaskadierend verschwindet.
- Lokale Spieler-/Berichtsdaten bleiben nach Anmeldung zunächst im Browser erhalten. Ein Administrator kann sie nach ausdrücklicher Bestätigung über eine begrenzte transaktionale RPC in die Cloud übernehmen; lokale Originaldaten werden erst nach erfolgreichem Import entfernt.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql` und die Frontend-Fehlererfassung speichern nur gekürzte/normalisierte Meldung und minimierte Quelldetails; Benutzer dürfen nur eigene offene Ereignisse einreichen, Administratoren können das Protokoll prüfen und bearbeiten.
- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` verbindet den Haupt-Spielerkatalog und Haupt-Scoutingberichte mit Supabase. Der Import lokaler Alt-Daten erfordert ausdrücklich eine Administratorbestätigung; die Quelldaten werden erst nach erfolgreichem Import entfernt. Die Migration ist noch nicht in Staging ausgeführt.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql`, die Client-Fehlertelemetrie und `view-admin-errors` ergänzen eine RLS-geschützte Fehlerübersicht mit Statuspflege. Der Logger redigiert Tokens/E-Mail-Adressen, speichert keine Stack-Traces und ist auf fünf Ereignisse pro Minute begrenzt. Staging-Migration und Laufzeittest stehen noch aus.
- Die Qualitätsprüfung prüft nun zusätzlich die Owner-Registrierungs- und Admin-Mitgliederfunktionen; Deno typprüft alle drei Edge Functions (Benutzername-Login, R2-Verbindung, Owner-Bootstrap).
- `package.json` enthält `npm test`, `npm run check:syntax` und `npm run build`. Der Static-Site-Build erstellt ausschließlich die acht benötigten Browserdateien in `dist/`; `tests/build-smoke.mjs` prüft lokale HTML- und CSS-Asset-Referenzen und schließt interne Repository-Dateien aus. Die bestehenden Smoke-Tests prüfen zusätzlich Cloud-Katalog, Owner-Bootstrap, Admin-Mitgliederliste und Fehlerüberwachung.
- `tests/smoke.mjs` prüft Dateien, Navigation, lokale Assets, PFMS-Markenhinweise, Auth-Reload-Logik, globale Spielersuche, private Medien, Team-/Trainings-/Spielmodule, Organisationsübersicht und Fehlertelemetrie.
- `.github/workflows/pfms-quality.yml` führt die Projekt- und Build-Tests sowie die Deno-Typprüfung bei Push/PR aus.
- Die letzten GitHub-Actions-Läufe sind erfolgreich. Sie belegen statische Repository-Prüfungen und Edge-Function-Typprüfung, nicht die reale Supabase-/Render-Laufzeit.
- Die zuletzt geprüften GitHub-Actions-Läufe auf dem PR-Branch sind erfolgreich. Die CI umfasst Node-/Build-/Smoke-/Accessibility-/SQL-Prüfungen, Deno-Typprüfung aller Edge Functions und jetzt zusätzlich signaturgenaue Vergleiche von SQL-Funktionsdefinitionen, `GRANT EXECUTE` und SECURITY-DEFINER-`REVOKE`.
- `.github/workflows/pfss-database-backup.yml` prüft die PostgreSQL-Archivstruktur vor der Verschlüsselung, entschlüsselt eine temporäre Kopie zur erneuten `pg_restore --list`-Prüfung und verifiziert anschließend den R2-Upload. `docs/BACKUP_RESTORE.md` beschreibt eine vollständige Wiederherstellung ausschließlich in eine neu angelegte isolierte Testdatenbank. Ein realer R2-Upload und Restore wurden in dieser Sitzung nicht ausgeführt.
- `render.yaml` definiert den isolierten Render-Staging-Static-Site-Dienst `pfms-staging-static` auf `feature/pfss-complete-platform-build`, veröffentlicht nur `dist/` und begrenzt automatische Deployments auf bestandene Checks. Die Blueprint-Konfiguration wurde noch nicht mit dem Render-Konto synchronisiert.
- `tests/accessibility-smoke.mjs` prüft die statischen HTML-Seiten auf doppelte IDs, zugängliche Beschriftungen für sichtbare Formularfelder, Alt-Texte sowie zugängliche Namen für Buttons und Links. Der aktuelle Quellstand wurde mit denselben Prüfregeln ausgewertet: beide HTML-Seiten ohne Treffer. Die Prüfung ist in `npm test` integriert; der zugehörige CI-Lauf muss nach dem Commit noch bestätigt werden.
- `SECURITY.md` dokumentiert einen verantwortungsvollen Meldeweg ohne öffentliche Offenlegung von Geheimnissen oder Nutzerdaten. `.github/dependabot.yml` aktiviert wöchentliche Updates für GitHub-Actions-Abhängigkeiten.
- Die Render-Staging-Konfiguration setzt eine Content-Security-Policy mit restriktiven Script-, Frame-, Object- und Verbindungsquellen sowie HSTS (`max-age=31536000; includeSubDomains`). Erlaubt werden das benötigte Supabase-Projekt-Subdomain-Muster und das Supabase-JS-CDN. Der Build-Smoke-Test prüft die CSP-Konfiguration. Die Richtlinie muss nach dem ersten echten Staging-Browserlauf auf Authentifizierung, Medien und sonstige externe Ressourcen geprüft werden.
- Der GitHub-Actions-Lauf `43600769629` auf Commit `139b90b...` war erfolgreich: Frontend-Syntax-/Smoke-Tests und Deno-Typprüfung aller drei Edge Functions. Weitere Änderungen am Club-Workspace befinden sich in einem neuen CI-Lauf. Ein erfolgreicher statischer Test ist kein Nachweis für die Laufzeitintegration mit Supabase oder Render.
- Der Scout-Bereich wurde von Beispieldaten auf private Supabase-Tabellen und Storage umgestellt.
- Die Markenbezeichnung wurde in den zuletzt bearbeiteten Oberflächen auf PFMS ausgerichtet.
- Der Vereinsbereich lädt verwaltbare Organisationen live, führt zu Mitgliederverwaltung und Mannschaften und zeigt aktive Scouts je Organisation. Beim Kontowechsel werden Organisations- und Scoutdaten zurückgesetzt.
- Die Seite `view-staff` ist jetzt mit den vorhandenen Team-RPCs verbunden: Sie lädt die eigenen Mannschaftszuordnungen und die tatsächlichen Trainer-/Co-Trainer-/Betreuerprofile; Verantwortliche können direkt den bestehenden Trainerteam- und Bereichsrechte-Dialog öffnen. Der bisherige statische Zuordnungs-Platzhalter wurde entfernt. Der GitHub-Actions-Lauf auf Commit `e926bb47bf38873abe23b5b74df4ae07b01745ca` war in beiden Jobs erfolgreich.
- Die Trainer-/Betreuerübersicht zeigt aktive und inaktive Teamzuordnungen getrennt und weist die aktive Anzahl separat aus. Der Build-Smoke-Test prüft zusätzlich den HSTS-Header der Render-Staging-Konfiguration.
- Die Trainer-/Betreuerübersicht kennzeichnet jetzt aktive und inaktive Teamzuordnungen getrennt; die aktive Personenzahl wird separat von der Gesamtzahl angezeigt.
- Der generische Platzhalter-Clickhandler `data-skeleton-action` wurde ebenfalls entfernt. Ein Smoke-Test verhindert, dass solche nicht funktionsfähigen Modulaktionen erneut in HTML oder App-Code auftauchen.
- Normale Seitenneuladungen zeigen die Willkommensanimation nicht erneut.

Die tatsächliche Browser-, Supabase-, Storage- und Render-Ende-zu-Ende-Prüfung steht noch aus.

## 6a. Aktueller Fortschritt und Abnahmegrenze

| Arbeitspaket | Schätzung |
|---|---:|
| Grundgerüst, Authentifizierung und Navigation | 85 % |
| Plattform- und Benutzeradministration | 60 % |
| Organisationen, Vereine und Mitgliedschaften | 45 % |
| Spieler- und Scoutingdaten | 65 % |
| Privater Scout-Bereich und Medien | 70 % |
| Teamverwaltung und Kader | 55 % |
| Training und Kalender | 65 % |
| Spiele und Aufstellungen | 70 % |
| Finanzen, Abos und Zahlungen | 25 % |
| Sicherheit und Qualitätssicherung | 55 % |
| Staging-, Betriebs- und Produktionsreife | 20 % |

Die Schätzwerte bewerten die Implementierung im Repository, nicht den produktiven Nutzungsgrad. Der Gesamtwert von ca. 42 % ist eine gewichtete Arbeitsprognose für das gesamte geplante PFMS. Ohne ausgeführte Staging-Migrationen, Rollen-/Negativtests und Browser-Abnahme werden die betroffenen Module nicht als abgenommen gewertet.

## 7. Verbindliche Reihenfolge

1. **Testumgebung stabilisieren:** Render-Service-Typ und Branch-Zuordnung prüfen; reproduzierbaren Teststart sicherstellen.
2. **Staging-Datenbank inventarisieren:** Nur-Lese-Audit ausführen; Tabellen, Trigger, Policies und tatsächliche Daten vergleichen.
3. **Identität und Organisation vereinheitlichen:** kanonisches Modell, sicherer Owner-Claim, Mitgliedschaften, Rollen, Rechte, Einladungen und Audit.
4. **Datenpersistenz und Fußball-Stammdaten:** Haupt-Spieler, Berichte, Vereine, Agenturen, Mannschaften und Staff mit serverseitiger Mandantenprüfung.
5. **Scouting und Medien:** Scout-Bereich in Staging Ende-zu-Ende prüfen; organisationsbezogene Freigaben, Bewertungen, Shortlists und Medien ergänzen.
6. **Betriebsmodule:** Training, Anwesenheit, Spiele, Kalender, Mannschaftskasse, Aufgaben, Nachrichten und Exporte.
7. **Geschäft und Produktionsbetrieb:** Abos/Zahlungen, Monitoring, Backups/Restore, Datenschutz-/Rechtsprüfung und formale Freigabe.

Ein Modul zählt erst als fertig, wenn UI, Datenbank, serverseitige Rechte, Fehlerfälle, Tests und Dokumentation zusammen funktionieren. Ein Menüpunkt, eine Vorschau oder ein erfolgreicher Seitenaufruf allein ist kein Funktionsnachweis.

## 8. Änderungsregeln

- Keine direkte Änderung an `main` oder produktiven Daten.
- Keine SQL-Migration ohne vorherigen Staging-Schema-Audit und Backup.
- Keine Secrets im Repository oder Chat.
- Jede Änderung bleibt klein, nachvollziehbar und überprüfbar.
- Jede abgeschlossene Funktion erhält positive und negative Tests.
- Produktionsdeployment erst nach dokumentierter Abnahme und ausdrücklicher Freigabe.


## 9. Qualitätssicherung – Stand 14.11.2026

- **Aktueller CI-Nachweis:** Commit `d3c6aa98d0f000b79ca635dd371cc9aa8b76fc3a` auf `feature/pfss-complete-platform-build` besteht beide GitHub-Actions-Jobs (`Syntax and project smoke tests` sowie `Type-check Supabase Edge Functions`). Enthalten sind u. a. der Test der Scout-Migrationsreihenfolge und die erzwungene RLS-Härtung. Das ist ein statischer Repository-Nachweis; es ersetzt keine Staging-Laufzeitabnahme.


- Der zuletzt abgeschlossene GitHub-Actions-Lauf auf Commit `38948cc109ab684eeabb37c465008944a3f3d4bc` war in beiden Jobs erfolgreich: Node-/Build-/Smoke-/Accessibility-/SQL-/Funktionsrechte-Prüfungen sowie Deno-Typprüfung aller drei Edge Functions.
- Die Backup-Smoke-Tests prüfen jetzt den gemeinsam genutzten HMAC-Helfer statt veralteten Inline-Code. Zusätzlich ist die zuvor inkonsistente Passphrase-Umgebungsvariable im manuellen und geplanten Backup-Workflow vereinheitlicht.
- Ein zusätzlicher ausführbarer Python-Test prüft den echten HMAC-Helper mit erfolgreichem Erstellen/Verifizieren, falscher Passphrase, manipuliertem Archiv und fehlendem Secret. Er läuft verpflichtend innerhalb von `npm test`.
- Der Scout-Workspace verwirft veraltete asynchrone Ladevorgänge bei Kontowechsel; doppelte Request-Generation-Prüfungen wurden bereinigt.
- Eine Quellcodeprüfung hatte doppelte ältere Scout-Medienhandler entdeckt, die die abgesicherten Upload-/Löschfunktionen überschrieben hätten. Die veralteten Duplikate wurden entfernt. Private Scout-Abfragen, Änderungen, Löschungen und globale Spielerübernahmen sind zusätzlich ausdrücklich auf `owner_id` und die aktuelle Sitzung begrenzt. Neue Smoke-Tests verhindern doppelte Handler/Funktionsdeklarationen und prüfen die Kontowechsel-Isolation; GitHub Actions auf Commit `08fa89d` waren erfolgreich.
- Die Authentifizierungsinitialisierung invalidiert jetzt bereits vor dem ersten asynchronen Rollenabruf die vorherige Sitzung. Veraltete Initialisierungen dürfen nach Kontowechsel weder Rollen noch Workspace-/Mediendaten des vorherigen Kontos aktivieren. Ein eigener Smoke-Test prüft die Reihenfolge; GitHub Actions auf Commit `6d7b155` waren in beiden Jobs erfolgreich.

- `npm test` führt Syntaxprüfung, isolierten CI-Build, Projekt-Smoke-Tests, Build-/Asset-/CSP-Prüfungen, Accessibility-Prüfung, SQL-Migrationssyntaxprüfung und Funktionsrechte-Signaturprüfung aus.
- Der Berechtigungstest prüft zusätzlich die vollständige `can_manage_org`-Regel (auth.uid, aktive Mitgliedschaft, erlaubte Leitungsrollen, leerer `search_path`, eingeschränkte EXECUTE-Rechte) und dass die Einladungs-RPC sowohl Plattformadministratoren als auch berechtigte Organisationsleitungen akzeptiert.
- Der Migrationstest prüft paarige PostgreSQL-Dollar-Quote-Begrenzer; der Funktionstest vergleicht deklarierte Funktionssignaturen mit `GRANT EXECUTE` und SECURITY-DEFINER-`REVOKE`.
- Die Edge Function `r2-connection-check` verlangt ein verifiziertes Benutzer-JWT und die serverseitige PFMS-Administratorprüfung über `pfms_is_admin`. `verify_jwt = true` ist explizit gesetzt; Antworten werden nicht gecacht.
- Die Render-CSP erlaubt die erforderliche Google-Fonts-Stylesheet-Origin, ohne die übrige Richtlinie pauschal zu öffnen.
- Build-/Staging-Isolation ist fail-closed: CI nutzt Platzhalterdaten; Staging muss eine ausdrücklich konfigurierte Projekt-ID, URL und einen Publishable-/Anon-Key verwenden. Secret-/Service-Role-Schlüssel werden für Browserbuilds abgewiesen.
- Teamaufgaben verwenden einen eigenen neunten Berechtigungsbereich `tasks.view/edit`; aktive Teammitarbeiter werden über einen zusammengesetzten Fremdschlüssel derselben Mannschaft zugeordnet.
- In-App-Mitteilungen sind persönlich RLS-geschützt. Datenbanktrigger erzeugen Mitteilungen bei Teamaufgabenzuweisung und -abschluss; Browserkonten können nur eigene Mitteilungen lesen und als gelesen markieren.
- `supabase/STAGING_READ_ONLY_AUDIT.sql` inventarisiert Organisationsmodelle, Tabellen, Policies, Grants, Storage und Funktionsrechte.
- `supabase/STAGING_ACCEPTANCE_READ_ONLY.sql` ergänzt nach dem Migrationseinsatz gezielte Prüfungen für RLS/FORCE RLS, Team-Aufgabenzuweisung, neun Berechtigungsbereiche, RPC-EXECUTE, Benachrichtigungstrigger und private Leserechte. Es liest ausschließlich Kataloge und Privilegien und verändert keine Daten oder Schemaobjekte.
- Die Staging-Abnahme prüft jetzt zusätzlich `can_manage_org(uuid)` und `pfms_create_legacy_invitation(uuid,text,integer)` direkt über PostgreSQL-Kataloge: SECURITY DEFINER, leerer `search_path`, EXECUTE für `authenticated`, kein EXECUTE für `anon` oder PUBLIC sowie die Admin-/Organisationsleitungs-Autorisierung. Ein zusätzlicher Regressionstest stellt sicher, dass diese beiden Abnahmeprüfungen und die PUBLIC-ACL-Prüfung im SQL-Skript erhalten bleiben. GitHub-Actions-Lauf `43633889211` auf Commit `d35aa4c153a007a6aadda12a4e4bd5c03d9edaad` war in beiden Jobs erfolgreich. Dies ist weiterhin ein statischer CI-Nachweis, keine ausgeführte Staging-Abnahme.
- GitHub-Actions-Lauf `43632979597` auf Commit `5f502949269e99b475111125977cb7b9818e7ce4` erfolgreich: beide Jobs (Node-/Build-/Smoke-/Accessibility-/SQL-Prüfungen sowie Deno-Typprüfung aller Edge Functions) bestanden. Der korrigierte Funktionsrechte-Test hat 121 öffentliche Funktionssignaturen, 109 EXECUTE-Freigaben und 100 SECURITY-DEFINER-Funktionen erkannt; alle 100 besitzen einen passenden EXECUTE-Widerruf. Zusätzlich schützt ein gezielter Regressionstest die `can_manage_org`-Autorisierung der Einladungsfunktion. Das ist ein CI-/Repository-Nachweis, keine Staging-Laufzeitabnahme.


Diese Prüfungen sind Repository-/CI-Nachweise. Sie ersetzen weder das tatsächliche Ausführen der Migrationen in Staging noch den Funktionstest des R2-Endpunkts mit einem Administrator- und einem Nicht-Administrator-Konto.

## 4. Repository-Konsistenzprüfung – 14.11.2026

- Die Staging-Anleitung enthielt einen Verweis auf `20261207_pfms_legacy_org_permissions.sql`, der im Repository nicht existiert. Die unbelegte Anweisung wurde entfernt; es wird keine nicht vorhandene Migration mehr zur Anwendung empfohlen.
- Der Migration-Smoke-Test prüft jetzt zusätzlich alle expliziten `supabase/migrations/<datei>.sql`-Verweise in den Markdown-Dateien unter `docs/` gegen den tatsächlichen Migrationsbestand. Damit werden veraltete oder falsch benannte Migrationsanweisungen künftig im CI erkannt.
- GitHub-Actions-Lauf [43634176285](https://github.com/Dridi06/PFSS/actions/runs/43634176285) auf dem Feature-Branch war erfolgreich: Syntax-/Build-/Smoke-/Accessibility-/SQL-/Grant-/Backup-Prüfungen und Deno-Typprüfung beider Jobs bestanden.
- Die Render-Blueprint-Datei, Staging-Build-Konfiguration, Veröffentlichungsliste, CSP/Security-Header und Backup-/Restore-Abläufe wurden statisch geprüft. Das ist keine Bestätigung der Render-Dashboard-Konfiguration, einer realen Supabase-Verbindung oder eines erfolgreichen Restore-Laufs.

### Zusätzliche Staging-Origin-Isolation – 14.11.2026

- Bei der Prüfung der Edge-Function-Anleitung wurde festgestellt, dass das Beispiel für `PFMS_ALLOWED_ORIGINS` in der Staging-Projektkonfiguration neben der Platzhalter-Staging-Domain auch die Produktionsdomain `pfss-scouting.onrender.com` aufführte.
- Die Produktionsdomain wurde aus dem Staging-Beispiel entfernt. Die Staging-Allowlist enthält dort jetzt ausschließlich die dedizierte Staging-Origin. Produktion und Staging müssen ihre jeweilige Allowlist getrennt verwalten.
- Ein Regressionstest verhindert, dass die Produktionsdomain künftig erneut in einem Staging-Allowlist-Beispiel auftaucht.
- GitHub-Actions-Lauf [43634340307](https://github.com/Dridi06/PFSS/actions/runs/43634340307) bestand beide Jobs. Der Testlauf bestätigte erneut 21 Navigationstargets, 44 SQL-Migrationen, 118 SECURITY-DEFINER-Definitionen sowie die Build-, Accessibility-, Grant- und Backup-Prüfungen.
- Die Korrektur betrifft Dokumentation und CI-Schutz. Die tatsächlichen Supabase-Function-Secrets wurden nicht verändert; deren Dashboard-Konfiguration muss im Staging separat geprüft werden.


## UI-/Datenbank-Berechtigungsabgleich – 14.11.2026

- Die Team-Workspace-Oberfläche wurde gegen die neun serverseitig aufgelösten Berechtigungsbereiche geprüft: Spielerkader, Training, Anwesenheit, Mannschaftskasse, Veranstaltungen, Kalender, Spiele, Analyse und Teamaufgaben.
- Die Oberfläche verwendet `pfms_get_my_legacy_team_permissions` und speichert die vom Server gelieferten `can_view`-/`can_edit`-Werte. Die Modulnavigation wird anhand der Leseberechtigung ausgeblendet; Bearbeitungsoberflächen und Schreibaktionen prüfen gesondert die Bearbeitungsberechtigung.
- Die Anwesenheit hat eigenständige Lese- und Bearbeitungsprüfungen; ein reiner Trainings-Lesezugriff erteilt keine Anwesenheitsänderungsrechte.
- Die bestehenden UI-Prüfungen wurden um Regressionstests ergänzt, die die neun Module, serverseitige Berechtigungsauflösung, getrennte Lese-/Bearbeitungsrechte und das Ausblenden nicht freigegebener Module absichern.
- Die Änderung betrifft Tests und Projektdokumentation. Es wurden keine Datenbankmigrationen, Zugangsdaten, Render-Dienste oder Produktivsysteme geändert.
- Zusätzlich korrigiert: Beim Abwählen eines Modul-Leserechts wird das zugehörige Bearbeitungsrecht jetzt automatisch deaktiviert und zurückgesetzt. Der Dialog bindet den Änderungslistener nur einmal; ein Regressionstest schützt dieses Verhalten.
- GitHub-Actions-Lauf [43644061815](https://github.com/Dridi06/PFSS/actions/runs/43644061815) auf Commit `587b5cff6cb212425dd964227fe46fb37dd3616b` war erfolgreich: Syntax-/Build-/Smoke-/Accessibility-/SQL-/Funktionsrechte-/Backup-Prüfungen und Deno-Typprüfung bestanden. Die neuen UI-Berechtigungs-Regressionstests sind damit im CI grün. Dies bleibt ein statischer Repository-/CI-Nachweis und ersetzt keine reale Staging-Abnahme.


## Erweiterte Staging-Prüfung der neun Team-Rechtebereiche – 14.11.2026

- Die bisherige Read-only-Staging-Prüfung kontrollierte beim neunten Berechtigungsbereich im Wesentlichen nur das Vorhandensein von `tasks` und die Anzahl neun.
- Die Prüfung wurde präzisiert: Sie kontrolliert jetzt alle neun Schlüssel (`squad`, `training`, `attendance`, `finance`, `events`, `calendar`, `matches`, `analysis`, `tasks`) in der effektiven Berechtigungsfunktion.
- Zusätzlich werden die eindeutige Neuner-Konfiguration, die Validierung der Bearbeitungs-/Lesekombination sowie die zulässigen Aktionen `view/edit` geprüft.
- Ein automatisierter Regressionstest schützt diese konkreten Staging-Prüfungen. Das Skript bleibt vollständig lesend und führt keine Schema- oder Datenänderungen aus.
- Die Prüfung wurde im Repository erweitert; sie wurde noch nicht gegen eine reale Staging-Datenbank ausgeführt.


## Zusätzliche UI-Rechtehärtung – Spielbetrieb und Kalender – 14.11.2026

- Bei der Prüfung der Bearbeitungswege wurde festgestellt, dass die Formular-Öffnungsfunktionen für Spiele und Kalendereinträge selbst keine eigene `can_edit`-Prüfung hatten. Die Speichern-Funktionen und serverseitigen RPCs prüften die Bearbeitungsrechte bereits; die sichtbaren Bearbeiten-Schaltflächen wurden ebenfalls nur berechtigten Konten angezeigt.
- Die Formular-Öffnungsfunktionen prüfen jetzt zusätzlich unmittelbar `matches.edit` bzw. `calendar.edit`. Damit bleibt auch bei direktem Aufruf oder verändertem DOM die UI-Berechtigungslogik konsistent.
- Zwei Smoke-Regressionstests schützen diese Guards. Serverseitige Berechtigungen bleiben die maßgebliche Sicherheitsgrenze.
- Die Änderung betrifft ausschließlich Frontend und Tests. Keine Migration, kein Datenbankzugriff und kein Deployment wurden ausgeführt.


- GitHub-Actions-Lauf [43644791339](https://github.com/Dridi06/PFSS/actions/runs/43644791339) auf Commit `a1b587b573e6c0007f79ee43509174cfcf2745c5` war erfolgreich. Beide Jobs bestanden: Projekt-/Smoke-/Accessibility-/SQL-/Funktionsrechte-/Backup-Prüfungen und Deno-Typprüfung. Ein erster Testlauf hatte lediglich eine zu wörtliche Quelltext-Assertion im neu ergänzten Test beanstandet; die Assertion wurde auf eine robuste Funktions-/Guard-Prüfung umgestellt und danach erfolgreich ausgeführt.


## Schutz vor verspäteten Antworten in Team-Unterbereichen – 14.11.2026

- Bei der Prüfung von Trainingsplan, Anwesenheitsliste und Spielaufstellung wurde die Fehlerbehandlung auf verspätete Antworten geprüft.
- Fehlerantworten werden nun nur noch angezeigt, wenn Benutzer, ausgewählte Mannschaft und der jeweils geöffnete Termin/das Spiel weiterhin übereinstimmen. Ein alter Request kann dadurch nicht mehr den gerade geöffneten anderen Mannschaftsbereich mit einer veralteten Fehlermeldung oder leeren Daten überschreiben.
- Drei Regressionstests sichern diese Team-/Sitzungs-/Spielbindung.
- Keine Datenbankänderung und kein Deployment. Die Änderung liegt ausschließlich im Feature-Branch; Staging- und Live-Akzeptanz bleiben offen.


## Zusätzliche Teamwechsel-Isolation bei Berechtigungs- und Aufstellungsaktionen – 14.11.2026

- Die Fehlerbehandlung beim Laden des ausgewählten Team-Workspaces prüft jetzt auch im Fehlerfall, ob die angeforderte Mannschaft weiterhin ausgewählt ist. Ein verspäteter Fehler einer vorherigen Mannschaft darf die aktuelle Ansicht nicht sperren oder überschreiben.
- Das Speichern einer Spielaufstellung bindet den gesamten Vorgang jetzt bereits vor dem RPC an die ursprüngliche Benutzer-, Team- und Spiel-ID. Erfolgs-, Fehler- und Abschlussbehandlung werden bei einem zwischenzeitlichen Team-/Spielwechsel verworfen; insbesondere wird kein Button einer inzwischen anderen Ansicht durch einen alten Request verändert.
- Zwei Regressionstests sichern diese Team-/Spielbindung.
- Keine Migration, Datenbankänderung oder Bereitstellung. Die Änderungen bleiben auf dem Feature-Branch.


## Teamgebundene Abschlussbehandlung weiterer Schreibvorgänge – 14.11.2026

- Die Abschlussbehandlung asynchroner Schreibvorgänge wurde für Anwesenheit, Trainingspläne, Spiele und Kalendereinträge vereinheitlicht.
- Jeder Vorgang hält die ursprüngliche Benutzer-/Team-/Sitzungs- bzw. Bearbeitungs-ID fest. Erfolgs- und Fehlermeldungen sowie das erneute Aktivieren von Schaltflächen erfolgen nur, solange dieselbe Ansicht noch aktiv ist.
- Dadurch kann ein verspäteter Request nach einem Mannschafts- oder Terminwechsel nicht mehr die Bedienelemente der neuen Ansicht verändern.
- Vier Regressionstests schützen die Team-/Sitzungsbindung und die Button-Abschlussbehandlung.
- Keine Datenbankmigration, keine Änderung an Daten oder Secrets und kein Deployment. Die Änderungen bleiben auf dem Feature-Branch.


## Erweiterte Teamwechsel-Isolation für Trainingszyklen, Übungen und Kasse – 14.11.2026

- Weitere asynchrone Schreibvorgänge wurden geprüft: Trainingszyklus anlegen, Wochenplanung bearbeiten, Zyklusstatus ändern, Übungskatalog bearbeiten, Trainingsstatus ändern und Mannschaftskassenbuchung anlegen.
- Deren Abschlussbehandlung aktiviert Schaltflächen nur noch dann wieder, wenn Benutzerkonto und ursprünglich ausgewählte Mannschaft weiterhin übereinstimmen.
- Sechs Regressionstests sichern die betroffenen Schreibwege. Serverseitige RPC-/RLS-Prüfungen bleiben weiterhin die maßgebliche Autorisierung.
- Keine Datenbank-, Storage-, Secret- oder Live-Änderung; keine Bereitstellung. Feature-Branch bleibt isoliert.


## Mannschaftskader-Schreibvorgänge an Teamkontext gebunden – 14.11.2026

- Hinzufügen, Bearbeiten und Entfernen von Kaderzuordnungen erfassen jetzt die ursprüngliche Team-ID.
- Nach einem asynchronen Datenbankaufruf werden Erfolg, Fehler, Neuladen und Button-Freigabe nur ausgeführt, wenn dieselbe Mannschaft noch ausgewählt ist.
- Drei Regressionstests schützen die Teamkontextbindung aller drei Kader-Schreibwege.
- Globale Spielerprofile werden weiterhin nicht gelöscht, wenn eine Mannschaftszuordnung entfernt wird.
- Keine Migration, keine Änderung an Produktivdaten und kein Deployment.


## Weitere Team-Workspace-Schreibwege gegen verspätete Abschlussaktionen geschützt – 14.11.2026

- Die Abschlussbehandlung wurde auch bei Analyse, Veranstaltungen, Teilnehmerlisten, Fahrtplänen, Teamaufgaben, Trainings-Terminen und Trainingswochen-Zuordnungen an den ursprünglichen Teamkontext gebunden.
- Die Zuordnung von Trainer-/Betreuerpersonal prüft die Team-ID jetzt auch nach dem RPC und nach dem Neuladen, bevor ein Dialog geöffnet oder eine Schaltfläche verändert wird.
- Acht zusätzliche Regressionstests decken die verbleibenden Schreibwege und die Personalzuordnung ab.
- Keine Datenbank- oder Live-Änderung; Feature-Branch und CI bleiben der Prüfpfad.


- Nachkontrolle der teamgebundenen Abschlussaktionen: Auch das Submit-Steuerelement des Fahrt-/Transportplans wird nach einem asynchronen Speichern nur noch freigegeben, wenn die ursprüngliche Mannschaft weiterhin aktiv ist. Ein zusätzlicher Smoke-Test schützt diesen Sonderfall.


### Passkey-Verwaltung ergänzt – 15.11.2026

- Das Konto-Sicherheitsfeld kann die für den aktuell angemeldeten Benutzer registrierten Passkeys über `auth.passkey.list()` laden.
- Passkeys können mit `auth.passkey.update()` umbenannt und mit `auth.passkey.delete()` entfernt werden. Die Bedienoberfläche begrenzt Namen auf 1–120 Zeichen und verlangt vor dem Entfernen eine Bestätigung.
- Die Oberfläche blockiert das Entfernen des letzten aktuell gelisteten Passkeys und fordert zunächst einen zweiten Zugang. Das ist eine zusätzliche clientseitige Schutzmaßnahme, aber keine serverseitige Garantie gegen parallele Änderungen oder Löschungen außerhalb dieser Oberfläche.
- Die Passkey-Verwaltungs-API ist in der aktuellen Supabase-JavaScript-Dokumentation beschrieben. Passkeys bleiben experimentell; produktive Aktivierung erst nach Staging-Konfiguration und Ende-zu-Ende-Abnahme.
- Die Verwaltung wurde im Feature-Branch ergänzt; noch kein Browser-/Staging-Test und kein Deployment.


### Passkey-Regressionstests und CI-Nachweis – 15.11.2026

- Der vollständige GitHub-Actions-Lauf für Commit `bd096c164523cc9bd88a8b70505e4da939ef882c` ist erfolgreich: beide Jobs „Syntax and project smoke tests“ und „Type-check Supabase Edge Functions“ abgeschlossen.
- Neue Smoke-Assertions sichern die Passkey-Login-/Registrierungs- und Verwaltungsoberfläche, Supabase-Auth-Opt-in, Listen/Umbenennen/Entfernen sowie die UI-Schutzprüfung gegen das versehentliche Entfernen des letzten gelisteten Passkeys.
- Die Supabase-JavaScript-Referenz bestätigt die verwendeten Aufrufe `registerPasskey()`, `signInWithPasskey()` sowie `auth.passkey.list/update/delete`. Die Funktion bleibt experimentell; SDK-/Serverkompatibilität und die Dashboard-Aktivierung müssen im Staging praktisch geprüft werden.
- Der neue Regressionstest liegt auf dem Feature-Branch. Für dessen neuen Commit steht der nächste CI-Lauf noch aus.
- Die Staging-Umgebung ist weiterhin nicht als aktiv und getestet bestätigt. Keine Datenbankmigration, Supabase-Function oder Render-Service wurde durch diese Codeänderungen deployed.


### WebAuthn-RP-Domainprüfung für Render-Staging – 15.11.2026

- Die Staging-Anleitung legt jetzt die Reihenfolge für Supabase Authentication → Passkeys fest: tatsächlichen Render-Host ermitteln, RP-ID und HTTPS-Origin exakt eintragen, erst danach Passkey-Authentifizierung im dedizierten Projekt `PFSS-Test` aktivieren.
- Sicherheitsrelevanter Befund: `onrender.com` ist in der Public Suffix List als Public Suffix eingetragen. Es darf daher nicht als gemeinsame RP-ID für PFMS verwendet werden. Der vollständige konkrete Staging-Hostname kann als RP-ID dienen; ein eigenes PFMS-Custom-Domain ist langfristig vorzuziehen.
- Eine Änderung der RP-ID macht bereits registrierte Passkeys unbrauchbar. Staging- und Produktionsdomains bleiben getrennte Credential-Bereiche.
- Beleg: Supabase Passkey-Konfigurationsanleitung und W3C WebAuthn-RP-ID-Regeln; Public-Suffix-Eintrag von Render. Staging-Konfiguration wurde noch nicht im Dashboard geändert.


### Supabase-JS-Aktualisierung und Passkey-API-Abgleich – 15.11.2026

- Supabase-JS-CDN wurde von `2.105.0` auf `2.119.0` aktualisiert. Laut Supabase-Changelog ist `2.117.0` die Version, ab der die Passkey-API standardmäßig aktiviert ist; das frühere `auth.experimental.passkey`-Opt-in ist seitdem deprecated und wirkungslos. Die veraltete Client-Option wurde entfernt.
- Die Passkey-Aufrufe für Registrierung, Anmeldung, Listen, Umbenennen und Löschen stimmen mit der aktuellen Supabase-JavaScript-Referenz überein.
- Die Funktion selbst wird weiterhin als experimentell geführt und muss zusätzlich im Supabase-Projekt aktiviert sein. Der neue Smoke-Test prüft den SDK-Pin und verhindert die Rückkehr zum veralteten Opt-in.
- Diese Aktualisierung ist noch nicht durch den nachfolgenden GitHub-Actions-Lauf bestätigt. Keine Staging- oder Produktionsbereitstellung durchgeführt.


### CI-Abnahme und Integrationsübersicht aktualisiert – 15.11.2026

- Der vollständige GitHub-Actions-Lauf für Commit `0778f08aa6a0cc205c57b1407dc7e1933b445ee8` ist erfolgreich. Beide Jobs (Node-Projekt-/Smoke-/Accessibility-/SQL-/Backup-Prüfungen sowie Deno-Typprüfung aller drei Edge Functions) wurden mit `success` abgeschlossen: [Run 43651944730](https://github.com/Dridi06/PFSS/actions/runs/43651944730).
- Der offene Draft-Pull-Request #1 wurde aktualisiert: Passkey-Integration, SDK-Stand 2.119.0, RP-ID-Risiko, aktueller CI-Nachweis und offene Staging-/Produktionsblocker sind dokumentiert. Der PR bleibt Draft und wurde nicht gemergt.
- Die vorherige Aussage, der neue CI-Lauf stehe noch aus, ist damit überholt. Der aktuelle geprüfte Stand ist `0778f08`.
- Nächster Umsetzungsschritt: Staging-Umgebung anhand des tatsächlichen Render-Hostnamens und des dedizierten Supabase-Projekts `PFSS-Test` vorbereiten. Ohne Zugriff auf das Render-/Supabase-Dashboard können tatsächliche Service-Existenz, Projekt-Referenz, Secrets und Domain nicht verifiziert oder eingerichtet werden.
- Keine Änderung an `main`, Produktions-Supabase, Live-Render-Service oder Produktivdaten. Kein Deployment.


### Browser-Build: Supabase-URL-Validierung weiter gehärtet – 15.11.2026

- Die Build-Konfiguration akzeptiert jetzt ausschließlich eine kanonische HTTPS-Projekt-Origin im Format `https://<20-stellige-ref>.supabase.co/`.
- Zugangsdaten in der URL, Ports, zusätzliche Pfade, Query-Parameter, Fragmente, ungültige URLs und fremde Host-Suffixe werden fail-closed abgewiesen.
- Neue Regressionstests decken diese fehlerhaften URL-Formen sowie ungültige URL-Syntax ab. Die vorhandene Prüfung auf Staging-Projekt-Referenz und öffentliche Schlüssel bleibt bestehen.
- Die Änderung ist im Feature-Branch; der CI-Lauf für den neuen Stand steht noch aus. Kein Deployment und keine Änderung an Supabase-Projekten.

### Render-Staging-Blueprint und Browser-Build regressionsgeprüft – 15.11.2026

- Die Render-Blueprint-Smoke-Tests prüfen den getrennten Static-Site-Dienst, den ausschließlich auf den Feature-Branch gerichteten Build, den Build-Befehl, den Veröffentlichungsordner `dist/`, den CI-abhängigen Deploy-Trigger und die extern zu setzenden Staging-Variablen.
- Zusätzlich wird geprüft, dass die Blueprint-Konfiguration keinen Produktionsdienst und keinen Branch `main` definiert. Die Prüfung liest nur die Repository-Datei; sie kontaktiert oder verändert Render nicht.
- Der Build-Test kontrolliert die Reihenfolge der Frontend-Skripte: `pfms-config.js` vor `app.js`, danach `scout-workspace.js`. So wird verhindert, dass die Anwendung vor ihrer Laufzeitkonfiguration startet.
- Die erste Testfassung enthielt einen fehlerhaften Zeilenumbruchvergleich. Dieser Testfehler wurde korrigiert; anschließend bestanden beide GitHub-Actions-Läufe für Commit `478727d7d92e0da7c1f8f34ccdbc0fe10f0236e5`: [Push-Lauf 43652524277](https://github.com/Dridi06/PFSS/actions/runs/43652524277) und [Pull-Request-Lauf 43652528440](https://github.com/Dridi06/PFSS/actions/runs/43652528440).
- Der erfolgreiche CI-Nachweis bestätigt automatisierte Repository-/Build-Prüfungen und den Deno-Typcheck. Er bestätigt weder eine tatsächlich eingerichtete Render-Staging-Instanz noch eine getrennte Supabase-Datenbank oder einen Browser-Ende-zu-Ende-Test.
- Keine Render-/Supabase-Dashboardänderung, keine Migration, kein Deployment, keine Änderung an `main` oder Produktivdaten. Draft-PR #1 bleibt offen und ungemergt.

### Plattforminhaber- und Organisationsinhaber-Schutz – 15.11.2026

- Neue additive Migration `20261210_pfms_owner_integrity_hardening.sql`: Die reguläre Administrator-Benutzerverwaltung darf das in `pfms_platform_owner` eingetragene Inhaberkonto nicht mehr herabstufen oder sperren. Die Änderung ist serverseitig in der SECURITY-DEFINER-RPC umgesetzt; `search_path` ist leer, EXECUTE ist auf `authenticated` begrenzt.
- Die Verwaltungs-RPC für Legacy-Organisationsmitgliedschaften sperrt nun zuerst den Organisationsdatensatz und erst danach die betroffene Mitgliedschaft. So werden parallele Änderungen an mehreren Inhabern derselben Organisation serialisiert, bevor die Regel „mindestens ein aktiver Inhaber“ geprüft wird.
- Die RPC-Parameter für Rolle und Status werden zusätzlich explizit gegen NULL und nicht erlaubte Werte validiert.
- Das Read-only-Staging-Abnahme-Skript prüft die Plattforminhaber-Schutzregel, die Organisationssperre und die EXECUTE-Rechte. Es prüft außerdem, dass `authenticated` `profiles.role` und `profiles.status` nicht direkt per Tabellenzugriff ändern kann. Diese letzte Prüfung muss nach dem tatsächlichen Staging-Schema-Audit grün sein; die zugrunde liegenden Tabellenrechte wurden nicht blind verändert, weil die reale Profile-Tabellenkonfiguration extern verifiziert werden muss.
- Regressionstests für Migration, Funktionsrechte und Staging-Abnahmepunkte bestanden. Vollständige GitHub-Actions für Commit `f373a14793c49be2109d9782409f4e78193f3049` erfolgreich: [Push-Lauf 43653035484](https://github.com/Dridi06/PFSS/actions/runs/43653035484) und [Pull-Request-Lauf 43653039072](https://github.com/Dridi06/PFSS/actions/runs/43653039072).
- Noch nicht angewendet oder zur Laufzeit getestet. Vor dem Einsatz: vollständigen Read-only-Schema-Audit und Backup in der getrennten Staging-Datenbank durchführen, Migrationen in Reihenfolge prüfen, dann Positiv-/Negativtests für Plattforminhaber, Administratoren und Organisationsinhaber ausführen.
- Keine Änderung an `main`, keine Live-Daten, keine Render-/Supabase-Dashboardänderung, kein Deployment. Draft-PR #1 bleibt offen und ungemergt.

### Mandantentrennung: Teamzugriff an aktuelle Organisationsmitgliedschaft gebunden – 15.11.2026

- In der bisherigen zentralen Team-Zugriffslogik konnten aktive Team-Personalzuordnungen den Zugriff weiterhin begründen, auch wenn die zugehörige Organisationsmitgliedschaft inzwischen nicht mehr aktiv war. Außerdem prüfte der Managerpfad den Status der Organisation nicht selbst.
- Neue additive Migration `20261211_pfms_legacy_team_membership_scope.sql` härtet beide zentralen Funktionen `pfms_can_access_legacy_team(uuid)` und `pfms_can_manage_legacy_team(uuid)`: Teamzugriff setzt jetzt eine Organisation im Status `approved` oder `active` voraus. Trainerzugriff verlangt zusätzlich eine aktive Mitgliedschaft desselben Nutzers in genau dieser Organisation und eine übereinstimmende Rolle zwischen Organisationsmitgliedschaft und Teamzuordnung.
- Alle bestehenden Team-RLS-Policies und Modul-RPCs, die diese zentralen Hilfsfunktionen verwenden, erhalten die strengere Prüfung automatisch. Plattformadministratoren behalten ihren ausdrücklich vorgesehenen globalen Zugriff.
- Regressionstests und ein neuer Read-only-Staging-Abnahmepunkt prüfen Organisationsstatus, aktive Mitgliedschaft, Rollenabgleich und Funktionsrechte. GitHub Push-CI für Commit `8cc4f47f9768bc024c00c75b76482812024e553b` erfolgreich: [Run 43653337563](https://github.com/Dridi06/PFSS/actions/runs/43653337563). Der zugehörige Pull-Request-Lauf ist noch in Bearbeitung.
- Noch nicht in Supabase angewendet oder gegen echte Staging-Daten getestet. Vor Freigabe mit getrennten Konten testen: aktive Vereinsleitung, aktiver Trainer, gesperrtes Organisationskonto, entzogene Mitgliedschaft, Rollenwechsel und Zugriff auf ein fremdes Team.
- Keine Produktionsänderung, kein Deployment, keine Änderung an `main`; Draft-PR #1 bleibt offen und ungemergt.


### Private Scout-Daten und Einladungsprüfung – 15.11.2026

- Die Migrationen für private Scout-Arbeitsbereiche wurden geprüft: Spieler, Berichte und Medienmetadaten sind an `owner_id = auth.uid()` gebunden; Berichte und Medien dürfen nur Spieler aus demselben Scout-Arbeitsbereich referenzieren. Die Medienablage verwendet einen privaten Bucket mit UID-Ordnerstruktur. Die nachträgliche Hardening-Migration erzwingt RLS und validiert Medienpfad sowie MIME-Typ.
- Der globale Spielerkatalog ist ausdrücklich als gemeinsamer Katalog angelegt: freigegebene Konten dürfen lesen, nur Plattformadministratoren dürfen globale Spieler anlegen, ändern oder löschen. Teambezogene Kaderzuordnungen bleiben separat und sind durch die Teamrechte geschützt. Das ist eine bewusste Produktentscheidung, kein versehentlicher Mandantenzugriff.
- Die Einlösung von Organisations-Einladungen prüft Einmaligkeit, Widerruf, Ablauf und den Status der Zielorganisation. Zeilensperren serialisieren die Einlösung gegen parallele Einlösungen und Organisationssperren.
- Das Read-only-Staging-Abnahmeskript prüft nun zusätzlich FORCE RLS der drei Scout-Tabellen, Owner-/Spielerbindung, private Storage-Policies und den Einladungsstatus-Guard. Die Smoke-Tests sichern diese vier Prüfungen gegen versehentliche Entfernung ab.
- Diese Änderungen sind ausschließlich im Feature-Branch vorbereitet. Noch keine Migration in Supabase ausgeführt und keine Laufzeit-/Storage-Negativtests gegen eine reale Staging-Instanz vorgenommen.


### Aufgaben-Zuweisungen an aktuelle Organisationsmitgliedschaft gebunden – 15.11.2026

- Bei der Prüfung der Vereinsmodule fiel auf: Aufgaben konnten bisher an einen aktiven Team-Personaldatensatz vergeben werden, obwohl die Organisationsmitgliedschaft des betreffenden Nutzers inzwischen entzogen, gesperrt oder in eine andere Rolle geändert worden sein konnte.
- Neue additive Migration `20261212_pfms_legacy_team_task_assignee_membership.sql` härtet Erstellung und Änderung von Teamaufgaben. Ein Empfänger muss jetzt gleichzeitig eine aktive Teamzuordnung, eine aktive Mitgliedschaft derselben Organisation mit übereinstimmender Rolle und eine Organisation im Status `approved` oder `active` haben. Die relevanten Zeilen werden während der Prüfung gesperrt.
- Der Read-only-Staging-Audit prüft beide RPC-Funktionsdefinitionen und ihre Rechte. Regressionstests verhindern, dass eine der beiden Prüfungen später entfernt wird.
- Diese Änderung ist noch nicht auf eine Supabase-Datenbank angewendet. Staging muss zusätzlich mit einem zuvor aktiven und anschließend entzogenen Teammitglied testen, dass eine neue Zuweisung abgewiesen wird.


### Trainingszyklen: Datumsintegrität der zugeordneten Einheiten – 15.11.2026

- Bei der Prüfung der Trainingszyklen wurde eine Integritätslücke gefunden: Beim Zuordnen einer Einheit zu einer Mikrozykluswoche wurde ihr Datum geprüft. Eine spätere Datumsänderung der Trainingseinheit über die reguläre Trainings-RPC konnte die Einheit jedoch außerhalb dieser Woche verschieben.
- Neue additive Migration `20261213_pfms_training_cycle_session_date_guard.sql` ergänzt einen Datenbanktrigger. Bei Einfügen bzw. Änderung von Team, Datum oder Zykluswochen-Zuordnung wird geprüft, dass Team und Datum weiterhin zur ausgewählten Mikrozykluswoche passen. Die Wochenzeile wird während der Prüfung mit `FOR SHARE` gesperrt.
- Der Trigger ist nicht direkt durch Browserrollen aufrufbar; die Änderung erfolgt innerhalb der bereits berechtigten Trainings-RPCs. Neue Regressionstests und ein Read-only-Staging-Abnahmepunkt prüfen die Triggerdefinition, Aktivierung und Funktionsrechte.
- Noch nicht auf Supabase angewendet oder gegen echte Staging-Daten getestet. Staging muss positiv eine Einheit innerhalb der Woche speichern und negativ eine Datumsverschiebung vor Wochenbeginn, nach Wochenende sowie eine teamfremde Zuordnung ablehnen.


### Spieltagsaufstellungen: Teamzugehörigkeit auf Datenbankebene erzwungen – 15.11.2026

- Die Spieltagsaufstellung prüfte beim Speichern bereits, ob ein Kaderspieler zum ausgewählten Team gehört. Die ursprüngliche Tabellenstruktur hatte diese Beziehung aber nicht zusätzlich relational abgesichert.
- Neue additive Migration `20261214_pfms_match_lineup_team_integrity.sql` ergänzt eine nicht-nullbare Team-ID an jeder Aufstellungszeile. Zusammengesetzte Fremdschlüssel erzwingen, dass sowohl das Spiel als auch die Kaderzuordnung exakt zu diesem Team gehören.
- Ein Trigger setzt die Team-ID beim Schreiben aus dem Spieldatensatz. Vorhandene widersprüchliche Zeilen lassen die Migration bewusst abbrechen, statt sie stillschweigend zu verändern.
- Regressionstest und Read-only-Staging-Audit prüfen beide Fremdschlüssel, die Triggeraktivierung und die RLS-Konfiguration. Noch nicht in Supabase angewendet oder mit realen Staging-Daten getestet.


### Zentrale Mitgliedschaftsprüfung für alle Team-Modulrechte – 15.11.2026

- Bei der übergreifenden Rechteprüfung wurde ein echter Bypass gefunden: `pfms_has_legacy_team_permission` prüfte bei normalen Teammitarbeitern nur die aktive Teamzuweisung und das konfigurierte Modulrecht. Damit konnte eine veraltete Teamzuweisung die zuvor gehärtete zentrale Organisationsmitgliedschaftsprüfung umgehen.
- Die Berechtigungslisten-Funktion erlaubte einem Nutzer mit noch aktiver Teamzuweisung außerdem, die Modulrechte der eigenen Zuweisung ohne erneute zentrale Teamzugriffsprüfung abzurufen.
- Neue additive Migration `20261215_pfms_team_permission_membership_gate.sql` verlangt vor jeder Modulberechtigung `pfms_can_access_legacy_team`. Das gilt für alle neun Module einschließlich Aufgaben. Auch das Abrufen der Berechtigungsliste verlangt jetzt zentrale Teamzugriffsberechtigung.
- Regressionstest und Read-only-Staging-Audit ergänzt. Noch nicht auf Supabase angewendet oder mit echten Rollen und Mitgliedschaften zur Laufzeit getestet.

### Kontenlebenszyklus und Löschfolgen – Prüfung 15.11.2026

- Die Konten- und Organisationsmigrationen wurden auf Rollenänderungen, Sperrung, Eigentümerintegrität und Fremdschlüssel-Löschfolgen geprüft. Der dedizierte Plattforminhaber ist über `pfms_platform_owner` geschützt; die reguläre Admin-Profilfunktion darf ihn weder herabstufen noch sperren. Die Organisationsverwaltung erzwingt mindestens einen aktiven Eigentümer und serialisiert Änderungen über die Organisationszeile.
- Die Auth-Trigger legen bei der Registrierung Profile und je nach Registrierungsart Organisations- bzw. Scout-Datensätze an. Die Owner-Bootstrap-Funktion verlangt zusätzlich den serverseitig dokumentierten ursprünglichen Registrierungsweg, eine bestätigte E-Mail und das geheime Bootstrap-Token; die Service-Role bleibt ausschließlich serverseitig.
- Entfernen einer Team-Personalzuordnung und Entfernen eines Spielers aus dem Mannschaftskader sind getrennte Vorgänge. Teamaufgaben bleiben bei Entfernung einer Personalzuordnung erhalten und werden entzugewiesen. Ein Kader-Eintrag löscht nicht den globalen Spieler; historische Aufstellungen können die Löschung einer Kaderzuordnung durch Fremdschlüssel verhindern.
- Endgültiges Löschen eines Auth-Kontos ist derzeit kein nachgewiesener Self-Service-Ablauf der Oberfläche. Mehrere historische Beziehungen verwenden bewusst `ON DELETE RESTRICT`, während private Scout-Daten und persönliche Daten teilweise an das Auth-Konto gekoppelt sind. Deshalb darf ein Konto nicht pauschal direkt aus `auth.users` gelöscht werden: vorher müssen Eigentümerrollen, erstellte Datensätze, Aufbewahrungspflichten und private Medien geprüft und geregelt werden.
- Vor einer späteren Kontolöschfunktion ist ein expliziter Prozess zu entwerfen: Eigentümerübergabe, Sperrung/Widerruf der Sessions, Export bzw. Aufbewahrung erforderlicher Vereins- und Buchhaltungsdaten, Löschung oder Anonymisierung personenbezogener Daten, Bereinigung privater Storage-Objekte und protokollierter Abschluss. Die tatsächlichen Aufbewahrungsfristen sind rechtlich zu prüfen und nicht allein aus der Datenbank abzuleiten.
- Es wurden in dieser Prüfung keine Konten gelöscht und keine Datenbankänderungen vorgenommen. Die bisherigen Rollen-/Löschprüfungen sind Code- und Migrationsprüfung; ein echter Staging-Lauf mit getrennten Testkonten steht weiterhin aus.

### Backup- und Restore-Betriebsgrenzen präzisiert – 15.11.2026

- Die Backup-Workflow- und HMAC-Implementierung wurde erneut geprüft. Der Workflow erstellt einen Custom-Format-PostgreSQL-Dump, prüft dessen Archivstruktur, verschlüsselt mit AES-256-CBC/PBKDF2 und authentifiziert den Chiffretext vor und nach der Entschlüsselungsprobe mit einem domain-separat abgeleiteten HMAC-SHA-256-Schlüssel. Das Manifest wird gemeinsam mit dem verschlüsselten Dump nach R2 hochgeladen.
- Die R2-Prüfung über `head-object` bestätigt nur, dass Backup und Manifest als Objekte vorhanden sind. Sie ist kein Download- oder Restore-Nachweis. Die vorhandene Restore-Anleitung verlangt deshalb HMAC-Prüfung vor Entschlüsselung und Wiederherstellung ausschließlich in eine neue isolierte Testdatenbank.
- Wichtige Betriebsgrenzen sind jetzt in `docs/BACKUP_RESTORE.md` dokumentiert: GitHub-Schedule läuft nur aus der Standard-Branch-Version des Workflows; R2-Lifecycle/Aufbewahrung ist außerhalb des Workflows zu konfigurieren; PostgreSQL-Dumps sichern keine Supabase-Storage-Binärdateien.
- Ein realer Backup-Lauf, R2-Upload, vollständiger Download und Restore wurden weiterhin nicht ausgeführt. Die benötigten Secrets und die tatsächliche Staging-Zielinstanz wurden nicht geprüft. Es gibt daher keinen belegten Backup-Restore-Erfolg und keine Zusage eines aktiven täglichen Backups aus dem Feature-Branch.


### Private Supabase-Storage-Sicherung fachlich vorbereitet – 15.11.2026

- Die geprüften Migrationen und Frontendmodule verwenden für Scout-Medien und die persönliche Haupt-Medienbibliothek denselben privaten Bucket `pfss-scout-private`. Die Scout-Medien liegen unter `<user-id>/<dateiname>`; die Haupt-Medienbibliothek unter `<user-id>/main/<dateiname>`. Die Metadaten liegen getrennt in `pfss_scout_media` und `pfms_main_media`.
- Der PostgreSQL-Dump enthält keine Datei-Binärdaten. Deshalb wurde mit `docs/STORAGE_BACKUP_RESTORE.md` ein separater sicherer Zielprozess dokumentiert: read-only Quellzugriff, geschützte serverseitige Secrets, private Ablage, verschlüsselte Manifeste, rekursive Pagination, Objektgrößen-/SHA-256-Abgleich und Restore ausschließlich in ein isoliertes Staging-Projekt.
- Vor Implementierung muss das tatsächliche Staging-Storage-Inventar read-only mit dem Repository abgeglichen werden. Ein gemeinsamer Backup-Zeitpunkt für Datenbank und Storage sowie Abgleich von Metadaten, Objekten und verwaisten Dateien sind Teil der späteren Abnahme.
- Noch nicht umgesetzt oder nachgewiesen: kein Storage-Backup-Skript/Workflow, kein reales Bucket-Inventar, kein Download/Upload nach R2 und kein Storage-Restore. Es wurden keine Storage-Objekte oder Supabase-Einstellungen verändert.

### Storage-Inventarisierung: Adapter, Integritätsmanifest und Laufzeitgrenzen – 15.11.2026

- Die rekursive Inventarisierungslogik `scripts/storage_inventory.py` ist vollständig transportneutral. Sie listet keine Objekte selbst, sondern verarbeitet ausschließlich Seiten, die ein Aufrufer bereitstellt.
- Der injizierte Adapter `scripts/storage_supabase_adapter.py` erzeugt den read-only Listing-Request für den bekannten privaten Bucket. Projekt-URL und 20-stelliger Projekt-Ref müssen exakt zusammenpassen; ein authentifiziertes Benutzer-JWT und ein Publishable-/Anon-Key werden verlangt. Erkannte `service_role`-Tokens werden abgewiesen.
- Der Adapter führt selbst keine HTTP-Verbindung aus. Tests verwenden ausschließlich einen Fake-Transport. Die JWT-Rollenprüfung ist kein Ersatz für die Signaturprüfung durch Supabase; die tatsächliche Datenfreigabe richtet sich weiterhin nach den serverseitig geprüften Storage-Policies.
- Die Inventarisierung besitzt nun harte Obergrenzen für Objekte, Seiten und Ordnertiefe. Pfadsegmente, Datei-/Ordner-Kollisionen, Duplikate, fehlerhafte Metadaten und nicht ganzzahlige Byte-Größen führen zum Abbruch.
- `build_inventory_manifest()` erzeugt aus einer vollständigen, sortierten Metadatenliste Objektanzahl, Gesamtbytes und einen deterministischen SHA-256-Fingerabdruck. Unbekannte Dateigrößen und unsichere relative Pfade werden nicht als vollständiges Manifest akzeptiert.
- Offline-Regressionstests prüfen Adapter-Request, Host-/Bucket-Grenzen, Token-Rollen-Guard, Traversierung, Pagination, Limits, Pfadsicherheit und deterministische Manifeste. Kein Test kontaktiert Supabase.
- **Noch nicht ausgeführt:** Es wurde kein reales Staging-Projekt identifiziert oder kontaktiert, kein Bucket-Inventar abgerufen und kein Storage-Objekt heruntergeladen. Vor dem ersten echten Lauf müssen Projektidentität, Benutzer-Leserechte und tatsächlicher Bucket-Bestand unabhängig im Supabase-Konto bestätigt werden.


### Supabase Storage – Offline-Archivkern ergänzt – 15.11.2026

- `scripts/storage_archive.py` paketiert lokal bereitgestellte Storage-Objekte in ein TAR-Archiv mit kanonischem Manifest und SHA-256 pro Objekt.
- Vor Archivierung und Restore werden Pfade, Symlinks, Duplikate, Objektanzahl, Gesamtbytes, tatsächliche Dateigrößen und Hashes geprüft.
- `verify_archive` validiert das komplette Archiv ohne Extraktion; `restore_archive` schreibt ausschließlich in ein leeres Zielverzeichnis und überschreibt keine vorhandenen Dateien.
- `tests/storage-archive-smoke.py` ergänzt Offline-Tests für Round-trip, Manipulation, Traversal, Duplikate, leere Inventare und Ressourcenlimits. Der Test wird in `npm run test:backup` aufgenommen.
- **Nicht enthalten:** Supabase-Download, R2-Transport, Verschlüsselung dieses Storage-Archivs, automatischer Workflow oder echter Restore. Das TAR ist bis zur separaten Verschlüsselung nicht für dauerhafte Ablage oder Übertragung geeignet.
- Die Entwicklung bleibt ausschließlich im Feature-Branch; keine Migration, Supabase-Verbindung, R2-Aktion, Render-Änderung oder Produktionsänderung.


### Storage-Archiv – Verschlüsselung und Authentifizierung ergänzt – 15.11.2026

- `scripts/storage_archive_crypto.py` ergänzt lokale AES-256-CBC/PBKDF2-Verschlüsselung (600.000 Iterationen) und verwendet den vorhandenen domain-separierten HMAC-SHA-256-Helfer.
- Die Entschlüsselungsroutine authentifiziert den Chiffretext zuerst und ruft OpenSSL erst nach erfolgreicher HMAC-Prüfung auf.
- Zielüberschreibung wird verhindert; Passphrase wird ausschließlich aus einer Umgebungsvariable gelesen und nicht als Prozessargument übergeben.
- `tests/storage-archive-crypto-smoke.py` prüft Round-trip, manipulierten Chiffretext, falsches HMAC und Zielkonflikte. Der Test ist in `npm run test:backup` eingebunden.
- **Noch nicht umgesetzt:** Supabase-Dateidownload, R2-Upload/Download, R2-Retention, automatischer Workflow und echter Staging-Restore. Es wurden keine externen Dienste kontaktiert.


### Team-Modulrechte: zentrale Regressionstests über alle neun Bereiche – 15.11.2026

- Die Datenbank-RPCs der Bereiche Kader, Training, Anwesenheit, Finanzen, Veranstaltungen, Kalender, Spiele, Analyse und Aufgaben wurden systematisch gegen ihre jeweilige View-/Edit-Berechtigung geprüft.
- Ein neuer CI-Test sichert die aktuellsten Definitionen der Lese- und Schreib-RPCs ab, verlangt FORCE RLS und eine modulbezogene SELECT-Policy für die geschützten Modultabellen und prüft, dass Anwesenheit zusätzlich zum Training separat berechtigt wird.
- Die neunte Berechtigung `tasks` wird ausdrücklich gegen die Tabellen-Constraint, die vollständige Neun-Einträge-Payload und die zentrale aktuelle Organisationsmitgliedschaftsprüfung abgesichert. Die Regression verhindert, dass spätere Änderungen den zentralen Teamzugriff wieder umgehen.
- Der Test ist in Syntax- und vollständige Projekt-Testläufe eingebunden. Dies ist ein statischer Quelltext-/Migrationsschutz; reale Rollen- und Mandantentests gegen Supabase-Staging bleiben verpflichtend.
- Ausschließlich Feature-Branch. Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung/Migration und keine Änderung an `main` oder Produktivdaten.


### Kaderdaten: direkte SELECT-Policy an granularen Modulzugriff gebunden – 15.11.2026

- Die Prüfung hat eine konkrete RLS-Lücke in der Kader-Tabelle gefunden: Die SECURITY-DEFINER-RPCs verlangten bereits `squad.view`, die direkte PostgREST-SELECT-Policy prüfte aber nur allgemeinen Teamzugriff. Ein Teammitarbeiter ohne Kader-Leserecht hätte daher die Kaderzeilen direkt abfragen können.
- Neue additive Migration `20261216_pfms_roster_select_permission_gate.sql` ersetzt diese Policy durch `pfms_has_legacy_team_permission(team_id, 'squad', 'view')`. Die zentrale Funktion verlangt zusätzlich die aktuelle aktive Organisationsmitgliedschaft und den gültigen Organisationsstatus.
- Der neue Regressionstest prüft die jeweils neueste SELECT-Policy, FORCE RLS, modulbezogene RPC-Lese-/Schreibrechte und die vollständigen Aufgabenrechte einschließlich Löschen. Trainings- und Anwesenheitsrechte bleiben getrennt geprüft.
- Noch nicht in Supabase angewendet. Vor Freigabe ist in Staging mit zwei Konten zu testen: gleicher aktiver Teamzugriff, aber einmal mit und einmal ohne `squad.view`; direkte Tabellenabfrage muss ohne Recht leer/abgewiesen sein, die berechtigte Abfrage muss funktionieren.
- Ausschließlich Feature-Branch. Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung/Migration und keine Änderung an `main` oder Produktivdaten.


- In derselben Prüfung wurde außerdem die gemeinsame Tabelle für Kalender- und Veranstaltungseinträge betrachtet: Die bisherige direkte SELECT-Policy ließ `calendar.view` auch Zeilen des Typs `event` und `tournament` lesen, obwohl dafür separat `events.view` vorgesehen ist. Die neue Policy trennt den Zugriff jetzt anhand von `event_type`; Kalenderrecht gilt für sonstige Kalendereinträge, Veranstaltungsrecht für Events und Turniere. Die Regression prüft beide Rechte in der jeweils neuesten Policy.


### Frontend-/Datenbank-Verträge: RPC-Schnittstellen automatisch abgeglichen – 15.11.2026

- Neuer CI-Test `tests/frontend-rpc-contract-smoke.mjs` liest alle SQL-Migrationen automatisch ein und gleicht die RPC-Aufrufe in `app.js` und `scout-workspace.js` mit den jeweils vorhandenen SQL-Funktionssignaturen ab.
- Geprüft werden fehlende SQL-Funktionsdefinitionen, unbekannte oder falsch geschriebene Frontend-Parameter sowie fehlende erforderliche Parameter bei vollständig ausgeschriebenen Argumentobjekten. Spread-/dynamische Argumentobjekte werden bewusst konservativ behandelt: ihre expliziten Schlüssel werden geprüft, aber nicht als vollständige Argumentliste ausgegeben.
- CI-Ergebnis: 78 Frontend-RPC-Aufrufe gegen 121 SQL-RPC-Namen aus 51 Migrationen geprüft; keine Schnittstellenabweichung. Der Test ist in `npm test` integriert.
- Zusammen mit den Team-Berechtigungsregressionen sind damit die Datenbankfunktionsnamen und expliziten Frontend-Parameter sowie die granularen Modulrechte automatisiert gegen spätere Regressionen abgesichert. Dies ersetzt weiterhin keine echten Browser-/Supabase-Staging-Abläufe.
- Letzter bestätigter Testlauf für den RPC-Vertragstest: GitHub Actions Run `43661228054`, beide Jobs erfolgreich. Ausschließlich Feature-Branch; kein Render-Deployment, keine Supabase-Verbindung oder Migration und keine Änderung an `main` oder Produktivdaten.


### Kalender-/Veranstaltungsgrenze auch in SECURITY-DEFINER-RPCs geschlossen – 15.11.2026

- Die erneute Rollenprüfung hat eine echte Umgehung der zuvor gehärteten SELECT-Policy aufgedeckt: `pfms_list_legacy_team_calendar` läuft als SECURITY DEFINER und gab bislang auch Event-/Turnierzeilen zurück, sobald nur `calendar.view` vorhanden war. Die direkte RLS-Policy allein konnte diesen RPC-Pfad nicht begrenzen.
- Neue Migration `20261217_pfms_calendar_events_rpc_boundary.sql`: Kalender-Lese-RPC filtert Event-/Turnierzeilen aus; Kalender-Schreib-RPCs akzeptieren ausschließlich `match`, `meeting` und `other`; der Update-RPC prüft zuerst den bestehenden Datensatztyp und verweigert Event-/Turnierzeilen sowie jede Umklassifizierung in Event-/Turnierarten. Die Events-RPCs bleiben separat an `events.view/edit` gebunden.
- Die Kalenderoberfläche zeigt die drei zulässigen Kalendertypen an. Veranstaltungen und Turniere werden ausschließlich über den Veranstaltungsbereich verwaltet.
- `tests/team-module-permissions-smoke.mjs` schützt jetzt die neuesten SECURITY-DEFINER-Funktionskörper sowie die erlaubten UI-Optionen gegen Regression. `supabase/STAGING_ACCEPTANCE_READ_ONLY.sql` prüft zusätzlich die installierten Funktionsdefinitionen, search_path und EXECUTE-Grants anhand der tatsächlichen Staging-Kataloge.
- Die Staging-Abnahme wurde entsprechend präzisiert: `calendar.view` sieht keine Event-/Turnierzeilen; weder Erstellen noch Aktualisieren über Kalender-RPCs darf Events/Turniere umgehen. Die vorherige pauschale Erwartung, `calendar.view` decke den vollständigen gemeinsamen Kalender ab, ist damit ausdrücklich ersetzt.
- Statischer Code- und CI-Nachweis; noch nicht in Supabase angewendet oder zur Laufzeit getestet. Ausschließlich Feature-Branch. Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung/Migration und keine Änderung an `main` oder Produktivdaten.


- Abschließender GitHub-Actions-Lauf nach der Ergänzung der Kalender-/Event-RPC-Regressionen erfolgreich: Commit `54d7adc08baceb0ec44280a6b0850dc388e36178`, Run [43661689408](https://github.com/Dridi06/PFSS/actions/runs/43661689408). Beide Jobs erfolgreich.
- Laufprotokoll: 52 SQL-Migrationen und 130 SECURITY-DEFINER-Definitionen geprüft; 46 Team-RPC-Berechtigungsprüfungen, 12 FORCE-RLS-Modultabellen, 78 Frontend-RPC-Aufrufe gegen 121 SQL-RPC-Namen sowie Funktionsrechte erfolgreich. Build-, Accessibility-, Backup-/Storage- und Edge-Function-Prüfungen ebenfalls erfolgreich.
- Die statische Abnahme beweist nicht, dass die Migration bereits in der externen Staging-Datenbank installiert ist. Die neue read-only Staging-Katalogprüfung und die getrennten Rollen-Negativtests sind vor jeder Staging-Freigabe weiterhin auszuführen.


## Ergänzung 15.11.2026 – Mandanten- und Rollenisolierung als CI-Regressionsschutz

- Neue Datei `tests/tenant-role-isolation-smoke.mjs`: prüft die effektiven Definitionen der Teamzugriffs- und Verwaltungshelfer, die aktive Organisationsmitgliedschaft, Rollenübereinstimmung zwischen Organisation und Teamzuordnung, die Trainer-Verwaltungsrolle, die organisationsgebundene Kandidatensuche und Teammitarbeiter-Zuordnung, den Schutz von Inhaber-/Adminrollen sowie die ausschließlichen RPC-Schreibrechte auf Teammitarbeiter.
- Der Test läuft in `npm test` und schützt die zentralen Mandantengrenzen gegen spätere unbeabsichtigte Änderungen.
- `supabase/STAGING_ACCEPTANCE_READ_ONLY.sql` enthält vier zusätzliche Katalogprüfungen für Teamzugriff, Trainer-Verwaltungsrecht, organisationsgebundene Teammitarbeiter-Zuordnung und den Schutz von Führungsrollen.
- `docs/STAGING_DEPLOYMENT.md` ergänzt konkrete Positiv-/Negativfälle: aktive und gesperrte Mitgliedschaften, Rollenwechsel, zweite Organisation, Co-Trainer-/Betreuergrenzen, direkte Tabellen-Schreibversuche und Führungsrollen.
- Vollständiger CI-Lauf erfolgreich: [Run 43662180691](https://github.com/Dridi06/PFSS/actions/runs/43662180691). Die neuen Mandanten-/Rollentests und sämtliche bestehenden Node-/Build-/SQL-/Storage-Prüfungen sowie die Edge-Function-Typprüfung sind erfolgreich.
- Statischer Repository-Nachweis; die externen Staging-Rollen müssen weiterhin mit getrennten Testkonten praktisch abgenommen werden. Keine Render-Änderung, kein Deployment, keine Supabase-Verbindung/Migration, keine Produktivdatenänderung und keine Änderung an `main`.
