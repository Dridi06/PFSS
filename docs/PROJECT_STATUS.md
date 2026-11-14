# PFMS – Verbindlicher Projektstatus

Stand: 14.11.2026  
Arbeitsbranch: `feature/pfss-complete-platform-build`  
Produktivbranch: `main`  
Produktionsfreigabe: **nicht erteilt**

> Alle Implementierungen erfolgen zunächst im Entwicklungszweig und in einer getrennten Testumgebung. Es gibt kein Produktionsdeployment ohne dokumentierte Abnahme und ausdrückliche Freigabe.

## 1. Gesamtbefund

PFMS ist noch kein vollständig integriertes Fußballmanagementsystem. Der Bestand besteht aus einem umfangreichen statischen Frontend, Supabase-Authentifizierung, mehreren vorhandenen SQL-Migrationen und teilweise bereits angebundenen Verwaltungsfunktionen. Viele fachliche Module sind bisher nur Oberflächen oder Teilfunktionen.

Die erste Repository-Aufnahme umfasste 33 Einträge einschließlich Verzeichnissen. Seitdem wurden eine Node-Projektkonfiguration, Smoke-Tests und ein GitHub-Actions-Workflow ergänzt. Eine Render-Service-Konfiguration ist weiterhin nicht im Repository abgelegt; der konkrete Render-Service-Typ muss im Render-Konto verifiziert werden.

## 2. Vorhandene Bausteine

### Frontend
- `index.html`: Hauptanwendung mit rund 18 Hauptansichten.
- `app.js`: Navigation, Authentifizierung, Dashboard, Haupt-Spieler-/Berichtsfunktionen und Administrator-RPCs.
- `styles.css`, `scout-workspace.css`: Designbasis.
- `scout-workspace.js`: jetzt mit Supabase-CRUD für private Scout-Spieler und -Berichte sowie privatem Medien-Upload, signierten Medienabrufen und Löschfunktionen verbunden.
- `rechtliches.html`: rechtliche Informationsseite; Impressum und Kontaktdaten sind noch nicht veröffentlichungsfertig.

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
- Ein zusätzliches neues Organisations-/Mitgliedschaftsmodell.
- Private Scout-Spieler, Berichte, Medien und einen privaten Storage-Bucket.
- Edge Functions: `username-login`, `r2-connection-check`, `pfms-owner-bootstrap`.

### Sicherung
- Ein GitHub-Actions-Workflow erstellt verschlüsselte PostgreSQL-Dumps und lädt sie in Cloudflare R2.
- Der reale Lauf hängt von korrekt gesetzten Repository-Secrets ab; die Wiederherstellung muss in einer isolierten Staging-Umgebung getestet werden.

## 3. Offene bzw. unvollständige Funktionen

| Bereich | Aktueller Stand | Noch erforderlicher Nachweis / Arbeit |
|---|---|---|
| Haupt-Spielerdatenbank | Daten liegen derzeit in `localStorage` (`pfss_players_v1`) | Persistente Supabase-Daten, Eigentümer-/Organisationsbezug, CRUD- und Mandantentests |
| Haupt-Scoutingberichte | Daten liegen derzeit in `localStorage` (`pfss_reports_v1`) | Supabase-Persistenz, Beziehungen und CRUD-Tests |
| Haupt-Medienbereich | lokale Objekt-URLs, nicht dauerhaft | Private Uploads, Metadaten, signierte Abrufe und Löschvorgänge |
| Privater Scout-Bereich | Code mit privaten Supabase-Tabellen und Storage verbunden; zusätzliche Integritätsmigration für Zeitstempel, Feldgrenzen und Datei-Pfade vorhanden | Migrationen in Staging anwenden; Scoutkonto für CRUD-, RLS- und Storage-Tests verwenden |
| Vereine und Agenturen | Teile der Oberfläche und Admin-RPCs vorhanden | Besitzer-/Leitungsworkflows, Datenpflege, Einladungen und Mitgliedschaften vervollständigen |
| Mannschaften und Staff | Oberflächen, überwiegend Platzhalter | Datenmodell, Zuweisungen, zeitliche Zuordnung und Rollenrechte |
| Trainer-/Team-Workspace | Modulübersicht und Platzhalter | Kader, Training, Anwesenheit, Spiele, Aufstellungen und Rechte |
| Vereinsmitgliedschaften | Teilweise Oberflächen und ältere Datenbankfunktionen | Aufnahme, Beiträge, Status, Wechsel/Austritt und Berechtigungen |
| Vereins-Scouting | Oberfläche/Übersicht | Scout-Zuordnung, Beobachtungsgebiete, Berichtsfreigaben |
| Plattforminhaber | Einmaliger Owner-Claim und Aktivierungsoberfläche im Entwicklungszweig vorbereitet | Staging-Migration/Secret/Edge-Function deployen; bestätigte E-Mail, korrekter Owner, Zweitclaim-Sperre und Negativtests abnehmen |
| Administration | Benutzerverwaltung und Organisationssuch-RPCs teilweise vorhanden | Vollständige Organisations-/Mitgliederverwaltung, Audit, Sperren, Fehler- und Supportprozesse |
| Zahlungen | Vorschau, kein Anbieter angebunden | Anbieterentscheidung, Webhooks, Abrechnungslogik und Rechtsprüfung |
| Kalender, Aufgaben, Nachrichten | geplant bzw. Platzhalter | Datenmodell, Rollen, Workflows und Benachrichtigungen |
| Sicherheit | einzelne RLS-Policies und Security-Definer-Funktionen | gesamtes Policy-/Grant-/Storage-Inventar und Negativtests |
| Backup | Workflow im Repository | Secrets prüfen, Backup ausführen und Restore-Probe dokumentieren |
| Render | Service-Konfiguration nicht verifiziert | Service-Typ prüfen, Test-Build, Health-Check und Browser-Test |
| Qualitätssicherung | `npm test` und GitHub Actions für Syntax und statische Smoke-Tests | Browser-/E2E-, Datenbank-, RLS- und Mandantentests |

## 4. Kritische Architekturentscheidung: Organisationsmodell

Die vorhandenen Migrationen belegen zwei parallele Datenmodelle:

1. Ältere Tabellen: `public.organizations` und `public.organization_memberships`. Die bestehende Admin-Verwaltung und die Einladungsfunktion verwenden dieses Modell.
2. Neuere Tabellen: `public.pfms_organizations`, `public.pfms_memberships` und `public.pfms_scout_profiles`. Eine neue Signup-Triggerfunktion provisioniert in dieses zweite Modell.

Bevor weitere Organisations- oder Teamfunktionen ergänzt werden, muss der tatsächliche Staging-Schema-Stand aufgenommen und ein einziges kanonisches Modell festgelegt werden. Es erfolgt keine automatische Zusammenführung, Löschung oder Migration auf Grundlage bloßer Annahmen.

Dafür wurde `supabase/STAGING_READ_ONLY_AUDIT.sql` bereitgestellt. Das Skript ist rein lesend und erfasst Tabellen/Spalten, RLS, Policies, Grants, Constraints, Trigger, relevante Funktionen und den privaten Scout-Bucket. Es muss im **Staging-Supabase-Projekt** ausgeführt und das Ergebnis geprüft werden.

## 5. Sicherheits- und Integrationsrisiken

- Beide Edge Functions verwenden im Entwicklungszweig jetzt eine gemeinsame CORS-Origin-Allowlist statt `*`. Standardmäßig sind die bekannte Render-Produktionsdomain und lokale Entwicklungsdomains zugelassen. Für Staging muss `PFMS_ALLOWED_ORIGINS` in den Supabase-Function-Secrets als kommagetrennte Liste aller erlaubten Origins gesetzt werden. Die geänderten Functions sind noch nicht deployed; die Live-Funktionen behalten bis dahin ihre bisherige Konfiguration.
- Die Username-Login-Funktion begrenzt die Request-Body-Größe und die Passwortzeichenlänge. Ein belastbares serverseitiges Rate-Limit und zusätzlicher Missbrauchsschutz sind weiterhin offen.
- RLS, Grants, Security-Definer-Funktionen und Storage-Policies sind noch nicht vollständig im tatsächlichen Datenbankzustand geprüft.
- Jede Organisationsressource braucht einen eindeutigen Mandantenbezug und serverseitige Autorisierung.
- Der einmalige Owner-Bootstrap ist im Entwicklungszweig implementiert: bestätigte E-Mail, dedizierter Registrierungsweg, separates Function-Secret, serverseitige JWT-Prüfung, service-role-RPC und Singleton-Owner-Tabelle. Die zusätzliche Migration `20261116_pfms_owner_bootstrap_registration_guard.sql` protokolliert den Owner-Registrierungsweg beim erstmaligen Anlegen des Auth-Kontos in einer für Benutzer gesperrten Tabelle; spätere Änderungen von `user_metadata` reichen nicht aus. Noch offen sind beide Staging-Migrationen, Secret-Konfiguration, Edge-Function-Deploy sowie positive/negative Ende-zu-Ende-Tests.
- Zahlungsfunktionen bleiben deaktiviert, bis Anbieter, serverseitige Webhooks, Abrechnungslogik und rechtliche Voraussetzungen umgesetzt und getestet sind.
- Legale Betreiber-/Impressumsangaben und Datenschutztexte müssen vor einem öffentlichen Start fachlich und rechtlich geprüft werden.

## 6. Aktuelle Qualitätsbasis und letzte Änderungen

- Der Owner-Aktivierungsbereich wird nur für Konten angezeigt, die beim ursprünglichen Signup den dedizierten Typ `owner_bootstrap` gewählt haben. Die Datenbankmigration sichert diese Auswahl serverseitig ab und erlaubt keine nachträgliche Selbstfreischaltung über änderbare User-Metadaten.

- `supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql`, `supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql` und `supabase/functions/pfms-owner-bootstrap/index.ts` ergänzen den einmaligen Owner-Claim mit unveränderbarer Registrierungsberechtigung, verifizierter Supabase-Sitzung, separatem Function-Secret, ausschließlich service-role-RPC und Singleton-Datensatz. UI zeigt die Aktivierung nur Konten mit dem speziellen Registrierungsweg; beide Migrationen und die Function sind noch nicht in Staging angewendet/deployed.
- `supabase/functions/_shared/cors.ts` implementiert eine gemeinsame CORS-Origin-Allowlist; `username-login` und `r2-connection-check` verwenden sie. Die Staging-Origin muss vor dem Deploy über `PFMS_ALLOWED_ORIGINS` freigegeben werden.
- `supabase/migrations/20261114_scout_workspace_integrity.sql` ergänzt Datenbankgrenzen für Scout-Daten, automatische `updated_at`-Zeitstempel und die Prüfung, dass Medien-Metadaten nur in den eigenen Benutzerordner zeigen. Die Migration wurde im Repository korrigiert, aber noch nicht in Supabase ausgeführt.
- `supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql`, die Edge Function `pfms-owner-bootstrap` und `docs/OWNER_BOOTSTRAP.md` enthalten jetzt den sicheren Erstbesitzer-Ablauf. Die Migration ist noch nicht auf Staging angewendet, das Function-Secret noch nicht gesetzt und die Function noch nicht deployed.
- `package.json` enthält `npm test` und `npm run check:syntax`.
- `tests/smoke.mjs` prüft Dateien, Navigation, lokale Assets, PFMS-Markenhinweise, Auth-Reload-Logik sowie die privaten Scout-Tabellen und Medienfunktionen.
- `.github/workflows/pfms-quality.yml` führt diese Prüfungen bei Push/PR aus.
- Ein GitHub-Actions-Lauf auf Commit `60aa159084e0e0d674dffc5ff2b1f6f03267d267` war erfolgreich. Weitere Läufe nach den zusätzlichen Tests und Sicherheitsänderungen sind getrennt zu prüfen. Ein erfolgreicher statischer Test ist kein Nachweis für die Laufzeitintegration mit Supabase oder Render.
- Der Scout-Bereich wurde von Beispieldaten auf private Supabase-Tabellen und Storage umgestellt.
- Die Markenbezeichnung wurde in den zuletzt bearbeiteten Oberflächen auf PFMS ausgerichtet.
- Normale Seitenneuladungen zeigen die Willkommensanimation nicht erneut.

Die tatsächliche Browser-, Supabase-, Storage- und Render-Ende-zu-Ende-Prüfung steht noch aus.

## 7. Verbindliche Reihenfolge

1. **Testumgebung stabilisieren:** Render-Service-Typ und Branch-Zuordnung prüfen; reproduzierbaren Teststart sicherstellen.
2. **Staging-Datenbank inventarisieren:** Nur-Lese-Audit ausführen; Tabellen, Trigger, Policies und tatsächliche Daten vergleichen.
3. **Identität und Organisation vereinheitlichen:** kanonisches Modell, sicherer Owner-Claim, Mitgliedschaften, Rollen, Rechte, Einladungen und Audit.
4. **Datenpersistenz und Fußball-Stammdaten:** Haupt-Spieler, Berichte, Vereine, Agenturen, Mannschaften und Staff mit serverseitiger Mandantenprüfung.
5. **Scouting und Medien:** Scout-Bereich in Staging Ende-zu-Ende prüfen; organisationsbezogene Freigaben, Bewertungen, Shortlists und Medien ergänzen.
6. **Betriebsmodule:** Training, Anwesenheit, Spiele, Kalender, Aufgaben, Nachrichten, Finanzen und Exporte.
7. **Geschäft und Produktionsbetrieb:** Abos/Zahlungen, Monitoring, Backups/Restore, Datenschutz-/Rechtsprüfung und formale Freigabe.

Ein Modul zählt erst als fertig, wenn UI, Datenbank, serverseitige Rechte, Fehlerfälle, Tests und Dokumentation zusammen funktionieren. Ein Menüpunkt, eine Vorschau oder ein erfolgreicher Seitenaufruf allein ist kein Funktionsnachweis.

## 8. Änderungsregeln

- Keine direkte Änderung an `main` oder produktiven Daten.
- Keine SQL-Migration ohne vorherigen Staging-Schema-Audit und Backup.
- Keine Secrets im Repository oder Chat.
- Jede Änderung bleibt klein, nachvollziehbar und überprüfbar.
- Jede abgeschlossene Funktion erhält positive und negative Tests.
- Produktionsdeployment erst nach dokumentierter Abnahme und ausdrücklicher Freigabe.
