# PFMS – Verbindlicher Projektstatus

Stand: 14.11.2026  
Geschätzter Gesamtfortschritt: **ca. 42 %** (Arbeitsfortschritt, keine abgenommene Funktionsquote)  
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
| Vereine und Agenturen | Live-Organisationsübersicht, Organisations-Mitgliederverwaltung und Einladungslinks; Scouting-Abteilung listet aktive Scouts je verwalteter Organisation; Verwaltungsseite verlinkt echte Mitglieder-/Teamworkflows | Organisationsweite frei definierbare Rechteprofile, vollständige Organisationspflege, Beitrags-/Austrittsabläufe sowie positive/negative Staging-Rollentests |
| Mannschaften und Staff | Legacy-Teamtabellen mit RLS; Teams und Trainerteam; global verknüpfter Kader; acht getrennte Modulrechte; Trainingstermine und spielerbezogene Anwesenheit mit serverseitigen Rechteprüfungen | Team-, Rechte-, Kader-, Trainings- und Anwesenheitsmigrationen in Staging anwenden; positive/negative Zugriffstests je Rolle abnehmen |
| Trainer-/Team-Workspace | Teamübersicht, Trainerteam, granularer Rechte-Editor, Kader, Trainingsübungen und Einheitenpläne, Anwesenheit, Mannschaftskalender, Spiele/Aufstellungen sowie Mannschaftskasse im Entwicklungszweig angebunden; getrennte Teamrechte | Team-Migrationen in Staging anwenden und mit Vereinsleitung/Trainer/Co-Trainer/Betreuer positiv und negativ abnehmen; Trainingszyklen, Analyse und Events ergänzen |
| Vereinsmitgliedschaften | Einmalige Einladungslinks für verwaltbare Legacy-Organisationen; Rollen Scout/Trainer/Co-Trainer/Betreuer/Mitglied und Laufzeit 1–30 Tage; Codes werden nur gehasht gespeichert | Staging-Migrationen anwenden; Einladung erzeugen, Link öffnen, Registrierung mit E-Mail-Bestätigung und einmalige Einlösung/Nichtwiederverwendung Ende-zu-Ende testen; Beitrags- und Austrittsabläufe sind offen |
| Vereins-Scouting | Aktive Scouts je verwalteter Organisation werden über die Mitgliedschafts-RPC angezeigt; Scout-Einladung öffnet den bestehenden Einmal-Link-Workflow | Beobachtungsgebiete, Verantwortungsbereiche und organisationsbezogene Berichtsfreigaben |
| Plattforminhaber | Einmaliger Owner-Claim und Aktivierungsoberfläche im Entwicklungszweig vorbereitet | Staging-Migration/Secret/Edge-Function deployen; bestätigte E-Mail, korrekter Owner, Zweitclaim-Sperre und Negativtests abnehmen |
| Administration | Benutzerverwaltung, Organisationssuche, globale Mitgliederliste, minimierte Frontend-Fehlererfassung und Admin-Fehlerprotokoll im Entwicklungszweig vorhanden | Migrationen in Staging anwenden; Organisations-/Mitgliederworkflows, Audit, Sperren und Supportprozesse Ende-zu-Ende testen |
| Zahlungen | Sichere Bereitschaftsseite; es werden keine Zahlungen ausgelöst | Anbieterentscheidung, Webhooks, Abrechnungslogik, Testzahlungen und Rechtsprüfung |
| Kalender, Aufgaben, Nachrichten | Mannschaftskalender, private persönliche Aufgaben und internes Support-Ticket-Postfach mit Admin-Antworten und Status | Organisationsweiter Kalender, gemeinsame Aufgaben/Zuordnung, Nachrichten/Benachrichtigungen außerhalb des Support-Tickets |
| Fehlerüberwachung | Frontend-Fehler werden nach Redaktion sensibler Werte kontobezogen protokolliert; Adminansicht kann filtern und Status setzen | Migration in Staging anwenden, Fehler-Ingest, RLS, Statusänderungen und Aufbewahrung testen |
| Sicherheit | einzelne RLS-Policies und Security-Definer-Funktionen | gesamtes Policy-/Grant-/Storage-Inventar und Negativtests |
| Backup | Workflow im Repository | Secrets prüfen, Backup ausführen und Restore-Probe dokumentieren |
| Render | Service-Konfiguration nicht verifiziert | Service-Typ prüfen, Test-Build, Health-Check und Browser-Test |
| Qualitätssicherung | `npm test`, GitHub Actions, Deno-Typprüfung aller drei Edge Functions sowie statische Checks für Owner, Mitglieder, Scout, Fehlertelemetrie, Teamspiele und Trainingsübungen | Browser-/E2E-, Datenbank-, RLS-, Mandanten-, Datenschutz- und Restore-Tests |

## 3a. Umgesetzter Team-Betrieb

- **Kader:** Globale Spieler können einer Legacy-Mannschaft zugeordnet werden; Rückennummer, Positionsabweichung und Kaderstatus werden getrennt pro Team gespeichert.
- **Training:** Termine mit Titel, Datum, Beginn/Ende, Ort, Schwerpunkt und Notizen können durch Benutzer mit `training.edit` angelegt werden. Berechtigte Trainer können geplante Einheiten abschließen oder absagen. Ein teambezogener Übungskatalog speichert Kategorien, Dauer, Spielerzahl, Schwierigkeitsgrad, Material, Aufbau, Ablauf und Coachingpunkte; mehrere Übungen können mit Reihenfolge, Dauer und Einheitenhinweis in einem Trainingsplan kombiniert werden.
- **Anwesenheit:** Für jede Einheit wird eine Liste der Kaderspieler angezeigt. Mit `attendance.edit` lassen sich Status (anwesend, abwesend, entschuldigt, verletzt, verspätet oder offen) und Notiz pro Spieler speichern. Die Datenbank blockiert Zuordnungen zu einer anderen Mannschaft.
- **Zugriff:** `training.view/edit` und `attendance.view/edit` sind getrennte Module. Tabellen sind nicht direkt für Browser-Schreibzugriffe freigegeben; Änderungen laufen über berechtigungsgeprüfte RPCs.
- **Mannschaftskasse:** Einnahmen und Ausgaben in EUR werden dem Team zugeordnet. `finance.view` erlaubt die Übersicht, `finance.edit` zusätzlich das Buchen und Stornieren. Der Kassenstand berücksichtigt alle aktiven Buchungen; die Oberfläche zeigt die letzten 200 Buchungen. Originalbuchungen werden nicht gelöscht, sondern mit Benutzer, Zeit und Begründung storniert. Es handelt sich nicht um Bank- oder Zahlungsabwicklung.
- **Zusätzlich umgesetzt:** Mannschaftskalender, Spielansetzungen und Ergebnisse sowie Spieltagskader und matchbezogene Aufstellungen mit Startelf, Ersatzbank, Position, Reihenfolge und Kapitän.
- **Zusätzlich umgesetzt:** Teambezogener Übungskatalog mit geordneten Einheitenplänen sowie eine Mannschaftskasse für Einnahmen/Ausgaben mit Kassenstand und nachvollziehbarer Stornierung.
- **Noch offen:** Trainingszyklen/Wochenplanung, Taktik-/Videoanalyse und Veranstaltungen. Alle bisher umgesetzten Teamfunktionen sind im Entwicklungszweig verbunden, aber noch nicht auf der Supabase-Testdatenbank abgenommen.

### Teamkalender

Der Mannschaftskalender verwendet `pfms_legacy_team_calendar_events` mit getrennten Terminarten (Spiel, Besprechung, Turnier, Veranstaltung, Sonstiges), Datum, Uhrzeit, Ort, Notizen und Status. Lesen und Ändern sind ausschließlich über `calendar.view` bzw. `calendar.edit` freigegeben; Browser-Schreibzugriffe auf die Tabelle bleiben gesperrt. Die Migration `20261124_pfms_legacy_team_calendar.sql` ist im Entwicklungszweig vorhanden. Sie muss zusammen mit den vorherigen Team-/Rechtemigrationen in Staging angewendet und mit verschiedenen Rollen getestet werden.

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
- `supabase/migrations/20261128_pfms_personal_tasks.sql` ergänzt private persönliche Aufgaben mit Fälligkeit, Priorität und Status.
- `supabase/migrations/20261129_pfms_support_tickets.sql` ergänzt vertrauliche Supporttickets: Nutzer sehen eigene Anfragen, Plattformadministratoren sehen und beantworten alle Tickets; RLS und eingeschränkte Update-Spalten trennen die Rechte. RLS erzwingt Eigentümerzugriff für freigegebene Konten; das Frontend lädt, erstellt, aktualisiert und löscht Aufgaben mit Sitzungs-/Kontowechsel-Schutz.
- Der Vereinsbereich lädt verwaltbare Organisationen live, verknüpft Mitglieder- und Mannschaftsverwaltung und zeigt aktive Scouts je Organisation. Organisationsdaten werden bei Abmeldung und Kontowechsel aus dem Frontendzustand entfernt.
- Das Support-Postfach erlaubt Nutzern private Anfragen und Administratoren Status-/Antwortbearbeitung. Push-/E-Mail-Benachrichtigungen und eine verbindliche Aufbewahrungsfrist sind noch offen.

- `supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql`, `supabase/migrations/20261116_pfms_owner_bootstrap_registration_guard.sql` und `supabase/functions/pfms-owner-bootstrap/index.ts` ergänzen den einmaligen Owner-Claim mit unveränderbarer Registrierungsberechtigung, verifizierter Supabase-Sitzung, separatem Function-Secret, ausschließlich service-role-RPC und Singleton-Datensatz. UI zeigt die Aktivierung nur Konten mit dem speziellen Registrierungsweg; beide Migrationen und die Function sind noch nicht in Staging angewendet/deployed.
- `supabase/functions/_shared/cors.ts` implementiert eine gemeinsame CORS-Origin-Allowlist; `username-login` und `r2-connection-check` verwenden sie. Die Staging-Origin muss vor dem Deploy über `PFMS_ALLOWED_ORIGINS` freigegeben werden.
- `supabase/migrations/20261114_scout_workspace_integrity.sql` ergänzt Datenbankgrenzen für Scout-Daten, automatische `updated_at`-Zeitstempel und die Prüfung, dass Medien-Metadaten nur in den eigenen Benutzerordner zeigen. Die Migration wurde im Repository korrigiert, aber noch nicht in Supabase ausgeführt.
- `supabase/migrations/20261115_pfms_global_player_catalogue.sql` ergänzt den global lesbaren Spieler-Katalog, autorisierte Admin-Schreibvorgänge, persönliche Scoutingberichte und einen begrenzten, transaktionalen Import vorhandener Browser-Backups. Die Migration wurde noch nicht in Staging angewendet.
- `supabase/migrations/20261116_pfms_system_event_monitoring.sql` ergänzt einen erzwungenen RLS-Fehlerlog mit kontobezogenem Insert und Admin-only Review. Frontend-Logging redigiert bekannte Token-/Passwortwerte und begrenzt die Rate; Migration und Browser-Integration müssen noch in Staging geprüft werden.
- `supabase/migrations/20261117_pfms_system_event_hardening.sql` beschränkt Admin-Updates auf Status-/Abschlussfelder, macht den ursprünglichen Fehlernachweis unveränderbar und weist häufige Credential-/Tokenmuster bereits in der Datenbank zurück. Diese Folge-Migration muss nach der Basis-Migration ebenfalls in Staging angewendet und geprüft werden.
- `supabase/migrations/20261117_pfms_main_media_library.sql` ergänzt `pfms_main_media` mit erzwungener Owner-RLS und privatem Storage im vorhandenen Bucket. Die Haupt-Medienansicht unterstützt Upload, signierte Anzeige und Löschen; die Migration wurde noch nicht in Staging angewendet.
- `supabase/migrations/20261127_pfms_legacy_team_finance.sql` ergänzt ein teambezogenes EUR-Buchungsjournal für Einnahmen und Ausgaben, einen serverseitig berechneten Kassenstand sowie begründete Stornierungen. `finance.view/edit` steuert Lese- und Bearbeitungszugriff; direkte Browser-Schreibzugriffe und physisches Löschen sind gesperrt. Oberfläche und RPC-Aufrufe sind im Entwicklungszweig verbunden; Staging-Migration, Rollen- und Browserabnahme stehen noch aus.
- `supabase/migrations/20261123_pfms_legacy_team_training.sql` ergänzt mannschaftsbezogene Trainingstermine und Anwesenheitslisten. Trainer/Co-Trainer/Betreuer erhalten Zugriff je nach `training.view/edit` und `attendance.view/edit`; Anwesenheitseinträge verweisen auf konkrete Kaderzuordnungen und werden serverseitig auf dieselbe Mannschaft geprüft. Die Oberfläche kann Termine mit Datum, Uhrzeit, Ort, Schwerpunkt und Notizen anlegen, Einheiten abschließen/absagen und den Status jedes Kaderspielers (anwesend, abwesend, entschuldigt, verletzt, verspätet oder offen) mit Notiz speichern. Die Migration ist noch nicht in Staging ausgeführt oder im Browser abgenommen.
- `supabase/migrations/20261122_pfms_legacy_team_permissions.sql` ergänzt acht getrennte Berechtigungsbereiche je Teamzuordnung: Kader, Training, Anwesenheit, Mannschaftskasse, Veranstaltungen, Kalender, Spiele und Analyse. Co-Trainer/Betreuer erhalten standardmäßig keine Modulrechte, bis ein Trainer oder eine berechtigte Vereinsleitung sie setzt. Die Funktion `pfms_has_legacy_team_permission(team_id, module_key, action)` ist als serverseitige Prüfbasis für künftige RLS-Policies vorgesehen; UI und RPCs speichern Lesen/Bearbeiten getrennt, und Bearbeiten setzt Lesen voraus. Die Migration ist noch nicht in Staging angewendet.
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
- `package.json` enthält `npm test` und `npm run check:syntax`. Die Smoke-Tests prüfen nun auch den Cloud-Katalog, Owner-Bootstrap, Admin-Mitgliederliste und Fehlerüberwachung.
- `tests/smoke.mjs` prüft Dateien, Navigation, lokale Assets, PFMS-Markenhinweise, Auth-Reload-Logik, globale Spielersuche, private Medien, Team-/Trainings-/Spielmodule, Organisationsübersicht und Fehlertelemetrie.
- `.github/workflows/pfms-quality.yml` führt diese Prüfungen bei Push/PR aus.
- Der GitHub-Actions-Lauf `43600769629` auf Commit `139b90b...` war erfolgreich: Frontend-Syntax-/Smoke-Tests und Deno-Typprüfung aller drei Edge Functions. Weitere Änderungen am Club-Workspace befinden sich in einem neuen CI-Lauf. Ein erfolgreicher statischer Test ist kein Nachweis für die Laufzeitintegration mit Supabase oder Render.
- Der Scout-Bereich wurde von Beispieldaten auf private Supabase-Tabellen und Storage umgestellt.
- Die Markenbezeichnung wurde in den zuletzt bearbeiteten Oberflächen auf PFMS ausgerichtet.
- Der Vereinsbereich lädt verwaltbare Organisationen live, führt zu Mitgliederverwaltung und Mannschaften und zeigt aktive Scouts je Organisation. Beim Kontowechsel werden Organisations- und Scoutdaten zurückgesetzt.
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
