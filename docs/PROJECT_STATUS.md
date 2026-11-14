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
| Haupt-Spielerdatenbank | Supabase-Tabelle `pfms_global_players`; Lesen für freigegebene Konten, Anlegen/Bearbeiten/Löschen nur für Plattformadministratoren; Such-/Sortierfilter vorhanden | Migration in Staging anwenden; CRUD-, RLS- und Mandantentests; Alt-Daten nur nach bewusster Importbestätigung übernehmen |
| Haupt-Scoutingberichte | Supabase-Tabelle `pfms_main_scouting_reports`; Anlegen/Bearbeiten/Löschen durch Verfasser oder Administrator; Admin kann alle sehen, normale Konten nur eigene Berichte | Migration in Staging anwenden; positive/negative RLS- und CRUD-Tests |
| Haupt-Medienbereich | Private Benutzer-Medienbibliothek mit Supabase-Storage, signierten Abrufen, Metadaten und Löschfunktion im Entwicklungszweig | Staging-Migration anwenden; Upload, MIME-/Größenlimits, Owner-RLS und Negativtests auf fremde Dateien abnehmen |
| Privater Scout-Bereich | Private Supabase-CRUDs und Storage; globale Spielersuche mit Übernahme in private Scout-Datenbank vorbereitet | Migrationen in Staging anwenden; Suche, Übernahme, CRUD-, RLS- und Storage-Tests verwenden |
| Vereine und Agenturen | Teile der Oberfläche und Admin-RPCs vorhanden | Besitzer-/Leitungsworkflows, Datenpflege, Einladungen und Mitgliedschaften vervollständigen |
| Mannschaften und Staff | Oberflächen, überwiegend Platzhalter | Datenmodell, Zuweisungen, zeitliche Zuordnung und Rollenrechte |
| Trainer-/Team-Workspace | Modulübersicht und Platzhalter | Kader, Training, Anwesenheit, Spiele, Aufstellungen und Rechte |
| Vereinsmitgliedschaften | Einmalige Einladungslinks für verwaltbare Legacy-Organisationen; Rollen Scout/Trainer/Co-Trainer/Betreuer/Mitglied und Laufzeit 1–30 Tage; Codes werden nur gehasht gespeichert | Staging-Migrationen anwenden; Einladung erzeugen, Link öffnen, Registrierung mit E-Mail-Bestätigung und einmalige Einlösung/Nichtwiederverwendung Ende-zu-Ende testen; Beitrags- und Austrittsabläufe sind offen |
| Vereins-Scouting | Oberfläche/Übersicht | Scout-Zuordnung, Beobachtungsgebiete, Berichtsfreigaben |
| Plattforminhaber | Einmaliger Owner-Claim und Aktivierungsoberfläche im Entwicklungszweig vorbereitet | Staging-Migration/Secret/Edge-Function deployen; bestätigte E-Mail, korrekter Owner, Zweitclaim-Sperre und Negativtests abnehmen |
| Administration | Benutzerverwaltung, Organisationssuche, globale Mitgliederliste, minimierte Frontend-Fehlererfassung und Admin-Fehlerprotokoll im Entwicklungszweig vorhanden | Migrationen in Staging anwenden; Organisations-/Mitgliederworkflows, Audit, Sperren und Supportprozesse Ende-zu-Ende testen |
| Zahlungen | Vorschau, kein Anbieter angebunden | Anbieterentscheidung, Webhooks, Abrechnungslogik und Rechtsprüfung |
| Kalender, Aufgaben, Nachrichten | geplant bzw. Platzhalter | Datenmodell, Rollen, Workflows und Benachrichtigungen |
| Fehlerüberwachung | Frontend-Fehler werden nach Redaktion sensibler Werte kontobezogen protokolliert; Adminansicht kann filtern und Status setzen | Migration in Staging anwenden, Fehler-Ingest, RLS, Statusänderungen und Aufbewahrung testen |
| Sicherheit | einzelne RLS-Policies und Security-Definer-Funktionen | gesamtes Policy-/Grant-/Storage-Inventar und Negativtests |
| Backup | Workflow im Repository | Secrets prüfen, Backup ausführen und Restore-Probe dokumentieren |
| Render | Service-Konfiguration nicht verifiziert | Service-Typ prüfen, Test-Build, Health-Check und Browser-Test |
| Qualitätssicherung | `npm test`, GitHub Actions, Deno-Typprüfung aller drei Edge Functions sowie statische Checks für Owner, Mitglieder, Scout und Fehlertelemetrie | Browser-/E2E-, Datenbank-, RLS-, Mandanten-, Datenschutz- und Restore-Tests |

## 4. Kritische Architekturentscheidung: Organisationsmodell

Die vorhandenen Migrationen belegen zwei parallele Datenmodelle:

1. Ältere Tabellen: `public.organizations` und `public.organization_memberships`. Die bestehende Admin-Verwaltung und die Einladungsfunktion verwenden dieses Modell.
2. Neuere Tabellen: `public.pfms_organizations`, `public.pfms_memberships` und `public.pfms_scout_profiles`. Eine neue Signup-Triggerfunktion provisioniert in dieses zweite Modell.

Bevor weitere Organisations- oder Teamfunktionen ergänzt werden, muss der tatsächliche Staging-Schema-Stand aufgenommen und ein einziges kanonisches Modell festgelegt werden. Es erfolgt keine automatische Zusammenführung, Löschung oder Migration auf Grundlage bloßer Annahmen.

Dafür wurde `supabase/STAGING_READ_ONLY_AUDIT.sql` bereitgestellt. Das Skript ist rein lesend und erfasst Tabellen/Spalten, RLS, Policies, Grants, Constraints, Trigger, relevante Funktionen, Storage-Konfiguration sowie geschätzte Zeilenbestände der beiden Organisationsmodelle und ihrer Mitgliedschaftstabellen. Die Zeilenzahlen basieren auf PostgreSQL-Statistiken und sind Näherungswerte, keine exakten Counts. Es muss im **Staging-Supabase-Projekt** ausgeführt und das Ergebnis geprüft werden.

## 5. Sicherheits- und Integrationsrisiken

- Alle drei Edge Functions verwenden im Entwicklungszweig jetzt eine gemeinsame CORS-Origin-Allowlist statt `*`. Standardmäßig sind die bekannte Render-Produktionsdomain und lokale Entwicklungsdomains zugelassen. Für Staging muss `PFMS_ALLOWED_ORIGINS` in den Supabase-Function-Secrets als kommagetrennte Liste aller erlaubten Origins gesetzt werden. Die geänderten Functions sind noch nicht deployed; die Live-Funktionen behalten bis dahin ihre bisherige Konfiguration.
- Die Username-Login-Funktion begrenzt die Request-Body-Größe und die Passwortzeichenlänge. Ein belastbares serverseitiges Rate-Limit und zusätzlicher Missbrauchsschutz sind weiterhin offen.
- RLS, Grants, Security-Definer-Funktionen und Storage-Policies sind noch nicht vollständig im tatsächlichen Datenbankzustand geprüft. Die im Repository fehlende Legacy-Organisationsprüfung `can_manage_org(uuid)` ist jetzt ergänzt; beim Staging-Audit ist zu prüfen, ob bereits eine gleichnamige Funktion existiert und welche Definition derzeit aktiv ist.
- Die Frontend-Fehlertelemetrie speichert nur bereinigte Fehlermeldungen, route-/quellenbezogene Pfade ohne Query-Strings und Zeilen-/Spaltennummern. Stack-Traces werden bewusst nicht gespeichert; die Erfassung ist auf fünf Ereignisse pro Minute begrenzt. Die Admin-Ansicht zeigt höchstens die 200 neuesten Ereignisse. Staging-RLS- und Datenschutzabnahme stehen noch aus.
- Jede Organisationsressource braucht einen eindeutigen Mandantenbezug und serverseitige Autorisierung.
- Der einmalige Owner-Bootstrap ist im Entwicklungszweig implementiert: bestätigte E-Mail, dedizierter Registrierungsweg, separates Function-Secret, serverseitige JWT-Prüfung, service-role-RPC und Singleton-Owner-Tabelle. Die zusätzliche Migration `20261116_pfms_owner_bootstrap_registration_guard.sql` protokolliert den Owner-Registrierungsweg beim erstmaligen Anlegen des Auth-Kontos in einer für Benutzer gesperrten Tabelle; spätere Änderungen von `user_metadata` reichen nicht aus. Noch offen sind beide Staging-Migrationen, Secret-Konfiguration, Edge-Function-Deploy sowie positive/negative Ende-zu-Ende-Tests.
- Zahlungsfunktionen bleiben deaktiviert, bis Anbieter, serverseitige Webhooks, Abrechnungslogik und rechtliche Voraussetzungen umgesetzt und getestet sind.
- Legale Betreiber-/Impressumsangaben und Datenschutztexte müssen vor einem öffentlichen Start fachlich und rechtlich geprüft werden.

## 6. Aktuelle Qualitätsbasis und letzte Änderungen

- Der Owner-Aktivierungsbereich wird nur für Konten angezeigt, die beim ursprünglichen Signup den dedizierten Typ `owner_bootstrap` gewählt haben. Die Datenbankmigration sichert diese Auswahl serverseitig ab und erlaubt keine nachträgliche Selbstfreischaltung über änderbare User-Metadaten.

- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` ergänzt den persistenten globalen Spielerkatalog und verfassereigene Haupt-Scoutingberichte. Plattformadministratoren können globale Spieler anlegen/bearbeiten; RLS erlaubt freigegebenen Konten den Lesezugriff. Backups und lokale Alt-Daten werden über eine begrenzte transaktionale Admin-RPC mit neu zugewiesenen IDs importiert.
- Der Scout-Bereich hat eine globale schreibgeschützte Spielersuche mit Filtern erhalten. Ein globales Profil kann einmalig als private Scout-Kopie übernommen werden; die Quelle wird in `source_global_player_id` verknüpft.
- `supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql`, `supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql` und `supabase/functions/pfms-owner-bootstrap/index.ts` ergänzen den einmaligen Owner-Claim mit unveränderbarer Registrierungsberechtigung, verifizierter Supabase-Sitzung, separatem Function-Secret, ausschließlich service-role-RPC und Singleton-Datensatz. UI zeigt die Aktivierung nur Konten mit dem speziellen Registrierungsweg; beide Migrationen und die Function sind noch nicht in Staging angewendet/deployed.
- `supabase/functions/_shared/cors.ts` implementiert eine gemeinsame CORS-Origin-Allowlist; `username-login` und `r2-connection-check` verwenden sie. Die Staging-Origin muss vor dem Deploy über `PFMS_ALLOWED_ORIGINS` freigegeben werden.
- `supabase/migrations/20261114_scout_workspace_integrity.sql` ergänzt Datenbankgrenzen für Scout-Daten, automatische `updated_at`-Zeitstempel und die Prüfung, dass Medien-Metadaten nur in den eigenen Benutzerordner zeigen. Die Migration wurde im Repository korrigiert, aber noch nicht in Supabase ausgeführt.
- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` ergänzt den global lesbaren Spieler-Katalog, autorisierte Admin-Schreibvorgänge, persönliche Scoutingberichte und einen begrenzten, transaktionalen Import vorhandener Browser-Backups. Die Migration wurde noch nicht in Staging angewendet.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql` ergänzt einen erzwungenen RLS-Fehlerlog mit kontobezogenem Insert und Admin-only Review. Frontend-Logging redigiert bekannte Token-/Passwortwerte und begrenzt die Rate; Migration und Browser-Integration müssen noch in Staging geprüft werden.
- `supabase/migrations/20261117_pfms_system_event_hardening.sql` beschränkt Admin-Updates auf Status-/Abschlussfelder, macht den ursprünglichen Fehlernachweis unveränderbar und weist häufige Credential-/Tokenmuster bereits in der Datenbank zurück. Diese Folge-Migration muss nach der Basis-Migration ebenfalls in Staging angewendet und geprüft werden.
- `supabase/migrations/20261117_pfms_main_media_library.sql` ergänzt `pfms_main_media` mit erzwungener Owner-RLS und privatem Storage im vorhandenen Bucket. Die Haupt-Medienansicht unterstützt Upload, signierte Anzeige und Löschen; die Migration wurde noch nicht in Staging angewendet.
- `supabase/migrations/20261119_pfms_legacy_invitation_workspace.sql` und `20261120_pfms_legacy_invitation_workspace_hardening.sql` ergänzen die verwaltbare Organisationsliste und härten die Erzeugung einmaliger Einladungscodes. Die Ansicht `view-club-members` kann für eigene verwaltbare Organisationen Links mit Rolle und Laufzeit erstellen; der rohe Code wird nicht in der Datenbank gespeichert und nur einmal an den Ersteller zurückgegeben. Die Einladung wird bei der Registrierung über `?invite=...` eingelöst. Die Staging-Abnahme ist noch offen.
- `supabase/migrations/20261118_pfms_legacy_org_manager_guard.sql` ergänzt die bisher im Repository fehlende Funktion `public.can_manage_org(uuid)`. Die Prüfung erlaubt nur dem angemeldeten Benutzer mit aktiver Mitgliedschaft in der Rolle `owner`, `club_admin` oder `agency_admin` die Verwaltung der betreffenden Legacy-Organisation. Die Einladungs-RPC verwendet diesen Server-Check; die Migration ist noch nicht in Staging angewendet.
- `supabase/migrations/20261115_admin_global_member_directory.sql` und die Ansicht `view-admin-members` ergänzen eine serverseitig geschützte organisationsübergreifende Mitgliedersuche sowie Rollen-/Statusänderungen. Die Migration ist noch nicht in Staging ausgeführt.
- Die Haupt-Spielerdatenbank nutzt `pfms_global_players` und bietet im Entwicklungszweig Admin-CRUD. Die Haupt-Scoutingberichte nutzen `pfms_main_scouting_reports` und bieten CRUD für Verfasser/Admin; die RLS-Policies setzen die gleiche Zugriffstrennung serverseitig durch. Die Spieler-Fremdschlüsselbeziehung nutzt `ON DELETE RESTRICT`, damit die Historie nicht kaskadierend verschwindet.
- Lokale Spieler-/Berichtsdaten bleiben nach Anmeldung zunächst im Browser erhalten. Ein Administrator kann sie nach ausdrücklicher Bestätigung über eine begrenzte transaktionale RPC in die Cloud übernehmen; lokale Originaldaten werden erst nach erfolgreichem Import entfernt.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql` und die Frontend-Fehlererfassung speichern nur gekürzte/normalisierte Meldung und minimierte Quelldetails; Benutzer dürfen nur eigene offene Ereignisse einreichen, Administratoren können das Protokoll prüfen und bearbeiten.
- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` verbindet den Haupt-Spielerkatalog und Haupt-Scoutingberichte mit Supabase. Der Import lokaler Alt-Daten erfordert ausdrücklich eine Administratorbestätigung; die Quelldaten werden erst nach erfolgreichem Import entfernt. Die Migration ist noch nicht in Staging ausgeführt.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql`, die Client-Fehlertelemetrie und `view-admin-errors` ergänzen eine RLS-geschützte Fehlerübersicht mit Statuspflege. Der Logger redigiert Tokens/E-Mail-Adressen, speichert keine Stack-Traces und ist auf fünf Ereignisse pro Minute begrenzt. Staging-Migration und Laufzeittest stehen noch aus.
- Die Qualitätsprüfung prüft nun zusätzlich die Owner-Registrierungs- und Admin-Mitgliederfunktionen; Deno typprüft alle drei Edge Functions (Benutzername-Login, R2-Verbindung, Owner-Bootstrap).
- `package.json` enthält `npm test` und `npm run check:syntax`. Die Smoke-Tests prüfen nun auch den Cloud-Katalog, Owner-Bootstrap, Admin-Mitgliederliste und Fehlerüberwachung.
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
