# PFMS – Staging-Migrationsabgleich: Ergebnis 16.11.2026

## Ziel und Sicherheitsgrenze

Read-only-Abgleich zwischen dem dedizierten Supabase-Staging-Projekt `oolvpbzbqiojioazsoun` und dem GitHub-Entwicklungsbranch `feature/pfss-complete-platform-build`.

Es wurden keine Migrationen ausgeführt, keine Datenbankobjekte verändert, keine Historie repariert und keine Produktionsressourcen angesprochen.

## Direkt verifizierte Ergebnisse

### Supabase-Staging

- Supabase-Projekt-Migrationsübersicht über die verfügbare Projektfunktion: `{"migrations":[]}` – keine registrierten Migrationseinträge zurückgegeben.
- PostgreSQL-Katalogabfrage auf `supabase_migrations.schema_migrations`: Relation existiert nicht.
- Read-only-Abfrage auf Tabellen mit Migrations-/Schema-Namen in den relevanten Supabase-/Public-Schemas: keine Ledger-Tabelle gefunden.
- Gleichzeitig ist das Staging-Schema nicht leer: Die vorherige Schema-Baseline vom 16.11.2026 dokumentiert 15 öffentliche Tabellen, 25 Relationen in public/storage, 222 Spalten, 106 Constraints, 62 Indizes, 28 RLS-Policies, 22 nicht-interne Trigger und 31 Funktionen/Prozeduren. Die aktuelle Tabellenübersicht meldet RLS für alle 15 öffentlichen Tabellen.
- Die bestehende Datenbank enthält also bereits zahlreiche Objekte, aber keine über die abgefragten Migrationsmechanismen nachvollziehbare Registratur ihrer Herkunft.

### GitHub-Entwicklungsbranch

- Branch: `feature/pfss-complete-platform-build`
- 69 timestampierte SQL-Dateien im Verzeichnis `supabase/migrations`.
- 53 verschiedene achtstellige Versionspräfixe.
- 11 kollidierende Versionsgruppen mit insgesamt 16 zusätzlichen Dateien.
- Die bekannte Kollisionsliste stimmt mit dem bestehenden Baseline-Guard überein. Keine Kollisionsdatei wurde umbenannt oder geändert.

## Schlussfolgerung

Eine leere Remote-Migrationsliste ist **kein Beweis**, dass keine Migrationen ausgeführt wurden. Sie bedeutet lediglich, dass die Supabase-Migrationsübersicht keine Einträge liefert. Weil zugleich ein umfangreiches Datenbankschema vorhanden ist, ist die tatsächliche Schema-Provenienz unbekannt.

Eine automatische Zuordnung „Migration angewendet / nicht angewendet“ wäre aktuell nicht belastbar. Eine Ausführung aller 69 Dateien, `migration repair`, `--include-all`, das manuelle Anlegen einer erfundenen Ledger-Historie oder ein Rename der kollidierenden Dateien wäre unzulässig.

## Nächster sicherer Arbeitsplan

1. **Unabhängiges Backup:** Vor jeder Änderung einen vollständigen Staging-Schemaexport und, soweit verfügbar, einen Datenbackup-/Restore-Punkt sichern. Der Export muss außerhalb des Produktionsprojekts eindeutig als Staging-Artefakt abgelegt werden.
2. **Ist-Schema maschinenlesbar erfassen:** Tabellen, Spalten, Typen, Defaults, Constraints, Indizes, Policies, Trigger, Funktionen samt Definitionen, Eigentümer, SECURITY DEFINER, search_path und effektive ACLs inventarisieren.
3. **Migrationen einzeln analysieren:** Für jede der 69 Dateien DDL-/DML-Objekte, Abhängigkeiten, Vorbedingungen, Seiteneffekte und Kollisionspräfixe extrahieren. Keine Ausführung.
4. **Evidenzmatrix aufbauen:** Pro Migration festhalten, welche ihrer erwarteten Objekte im Ist-Schema vorhanden, abweichend oder nicht vorhanden sind. Objektgleichheit allein ist kein sicherer Beweis für Ausführung; insbesondere Funktionen, Policies, Grants und Trigger müssen inhaltlich verglichen werden.
5. **Kollisionsgruppen einzeln auflösen:** Für jedes doppelte Präfix die Dateien und Abhängigkeiten einzeln bewerten. Keine historische Datei stillschweigend umbenennen.
6. **Reviewfähige Baseline erzeugen:** Erst nach vollständiger Analyse einen expliziten, begründeten Vorschlag erstellen: bereits im Schema repräsentiert / nicht repräsentiert / abweichend / unklar. Unklare Fälle bleiben gesperrt.
7. **Disposable staging clone:** Den Plan in einer isolierten, wegwerfbaren Staging-Kopie validieren, bevor Shared Staging verändert wird. Shared Staging und Production bleiben bis zu einem separaten Freigabeschritt unverändert.

## Status

- Remote-Ledger-Abfrage: abgeschlossen, leer.
- Katalogprüfung auf Ledger-Tabelle: abgeschlossen, nicht vorhanden.
- Repository-Migrationsinventar: abgeschlossen, 69 Dateien / 11 Kollisionsgruppen.
- Historische Migrationen sicher einer Ausführung zugeordnet: **nicht möglich mit derzeit verfügbarer Evidenz**.
- Migrationsausführung oder Reparatur: **gesperrt**.
- Produktionsumgebung: unangetastet.

Diese Datei ist ein read-only Arbeitscheckpoint, keine Freigabe zur Migration.


## Ergänzende Objektprüfung (16.11.2026, read-only)

Zusätzlich wurde die aktuelle öffentliche Staging-Objektliste erneut direkt aus PostgreSQL abgefragt. Erfasst wurden Tabellen, Spalten, öffentliche Funktionen mit SECURITY DEFINER/search_path, RLS-Policies und Trigger. Das ist eine Momentaufnahme des Ist-Zustands, keine automatische Zuordnung aller Migrationen.

### Verifizierte Tabellenabweichungen bei ausgewählten Feature-Migrationen

| Migration | Im SQL erwartete Objekte | Staging-Befund | Bewertung |
|---|---|---|---|
| `20261115_pfms_global_player_catalogue.sql` | `pfms_global_players`, `pfms_main_scouting_reports`; außerdem Änderung an `pfss_scout_players` | Beide PFMS-Tabellen fehlen. Die im Migrations-SQL referenzierte Tabelle `pfss_scout_players` fehlt ebenfalls; vorhanden ist stattdessen `pfss_players`. | Nicht direkt anwendbar; Abhängigkeit/Modellabweichung muss zuerst geklärt werden. |
| `20261115_pfms_platform_owner_bootstrap.sql` | `pfms_platform_owner`, `pfms_owner_setup_available()`, `pfms_claim_initial_owner(uuid)` | Tabelle und beide Funktionen fehlen. | Im Staging nicht vorhanden; keine Ausführungsaussage über andere Deploy-Wege. |
| `20261116_pfms_system_event_monitoring.sql` | `pfms_system_events`, `pfms_system_events_touch_updated_at()`, Trigger | Tabelle/Funktion/Trigger fehlen. | Im Staging nicht vorhanden. |
| `20261117_pfms_main_media_library.sql` | `pfms_main_media` und zugehörige Policies | Tabelle fehlt; vorhanden ist die ältere/andere `pfss_media`. | Modellabweichung; nicht gleichsetzen. |
| `20261207_pfms_in_app_notifications.sql` | `pfms_notifications`, Task-Benachrichtigungstrigger/-funktion | Tabelle fehlt. | Im Staging nicht vorhanden. |
| `20261208_pfms_support_ticket_notifications.sql` | Erweiterung `pfms_notifications`, Support-Ticket-Trigger | `pfms_notifications` fehlt; `pfms_support_tickets` ebenfalls nicht in öffentlicher Tabellenliste. | Abhängigkeit nicht erfüllt. |
| `20261220_pfms_admin_system_event_pagination.sql` | `pfms_admin_list_system_events_page(...)` | Funktion fehlt. | Erklärt, weshalb die Admin-Aktivitätsansicht keine passende DB-RPC hat. |

### Weitere konkrete Ist-Schema-Befunde

- Vorhandene öffentliche Tabellen umfassen `pfms_memberships`, `pfms_organizations`, `pfms_scout_profiles`, `pfms_test_personas`, `pfss_audit_log`, `pfss_calendar_events`, `pfss_invitations`, `pfss_media`, `pfss_memberships`, `pfss_organizations`, `pfss_platform_roles`, `pfss_players`, `pfss_scouting_reports`, `pfss_tasks`, `pfss_teams` und `profiles`.
- Die Tabellen `pfss_players`, `pfss_scouting_reports`, `pfss_tasks` und `pfss_teams` sind vorhanden. Sie sind **nicht automatisch** gleichwertig mit den späteren PFMS-Global-/Legacy-Team-Tabellen.
- Die aktuelle öffentliche Funktionsliste enthält 28 Funktionen. Die erwartete Event-Pagination-RPC ist nicht darunter.
- `pfss_audit_log` bleibt organisationsbezogen und ist kein Ersatz für die fehlende Plattform-Audit-Tabelle.
- Das Schema enthält auch `pfms_test_personas`; diese Tabelle war in der früheren verkürzten 15-Tabellen-Zusammenfassung nicht aufgeführt. Die aktuelle vollständige Tabellenabfrage liefert 16 Tabellen. Der ältere Zählwert ist hiermit korrigiert.

### Wichtige Einschränkung

Das Fehlen eines Objekts mit exakt demselben Namen ist starke Evidenz, dass die betreffende Migration in dieser Form nicht im aktuellen Schema repräsentiert ist. Es beweist jedoch nicht, dass keinerlei manuelle oder alternative Implementierung existiert. Für eine Freigabe müssen auch semantisch gleichwertige Objekte, Datenmodellunterschiede, Funktionen, Policies, Trigger, Storage-Regeln und Abhängigkeiten geprüft werden.

### Nächster Arbeitsschritt

Die nächste Runde erstellt eine vollständige Soll-/Ist-Matrix für alle Migrationen, beginnend bei den 11 Kollisionsgruppen und den migrationsübergreifenden Abhängigkeiten. Besonders die historische Trennung zwischen `pfss_*` und `pfms_*` muss sauber dokumentiert werden. Shared Staging bleibt unverändert, bis ein isolierter Clone mit einer validierten Baseline verfügbar ist.


## Kollisionsgruppen-Analyse – Runde 1 (16.11.2026, read-only)

Untersucht wurden die vollständigen SQL-Quellen der ersten sechs Präfixgruppen bzw. die zugehörigen zentralen Dateien. Die Prüfung bewertet Abhängigkeiten und semantische Konflikte; sie ist keine Freigabe zur Ausführung.

### Präfix 20261110

| Datei | Inhalt / Abhängigkeit | Bewertung |
|---|---|---|
| `20261110_admin_control_center.sql` | Definiert `pfss_admin_list_profiles()` und `pfss_admin_update_profile(uuid,text,text)`; verwendet `public.is_admin()`, setzt `search_path = public`. | Im Staging existieren gleichnamige Funktionen, aber die live geprüfte Update-Funktion verwendet eine andere Admin-Prüfung und `search_path = pg_catalog, public`. Die Datei ist daher keine harmlose „bereits erledigt“-Migration; ein erneutes Ausführen würde eine sicherheitsrelevante Implementierung überschreiben. |
| `20261110_username_registration.sql` | Fügt einen case-insensitiven Username-Index hinzu und ersetzt den Trigger `pfss_sync_signup_username` auf `auth.users`. | Trigger-/Index-Zustand muss separat mit Katalogdefinitionen verglichen werden. Nicht aus dem Vorhandensein von `profiles` ableiten. |

**Ergebnis:** Zwei unabhängige Funktionsbereiche, aber beide berühren Auth-/Profil-Sicherheit. Keine automatische Anwendung oder Ledger-Zuordnung.

### Präfix 20261111

| Datei | Inhalt / Abhängigkeit | Bewertung |
|---|---|---|
| `20261111_admin_legacy_organization_management.sql` | Admin-RPCs auf `public.organizations` und `public.organization_memberships`; außerdem `profiles.full_name` und `auth.users`. | Die erwarteten Legacy-Tabellen `organizations` und `organization_memberships` sind im aktuellen Staging-Tabelleninventar nicht vorhanden. Nicht an `pfss_organizations`/`pfss_memberships` umbiegen. |
| `20261111_fix_admin_scout_search_types.sql` | Ersetzt nur `pfms_admin_list_legacy_scouts(text)` mit expliziten Rückgabetyp-Casts. | Korrekturdatei ist von der vorherigen Funktionssignatur und denselben Legacy-Tabellen abhängig. Muss nach der Basisdefinition kommen, sofern das Legacy-Modell überhaupt bestätigt wird. |
| `20261111_fix_invitation_admin_access.sql` | Ersetzt `pfms_create_legacy_invitation(uuid,text,integer)`; verwendet `organizations`, `organization_invitations`, `can_manage_org(uuid)`, `is_admin()`. | Abhängigkeiten fehlen/ungeklärt. Funktion allein ohne Tabellen- und Helper-Basis nicht anwendbar. |
| `20261111_legacy_organization_invitations.sql` | Erstellt `organization_invitations`, Erstellungs-/Einlösungstrigger und Mitgliedschaftseintrag; verwendet `organizations`, `organization_memberships`, `profiles`, `can_manage_org`. | Zentrale Legacy-Tabellen fehlen im Staging. Außerdem ist die Trigger-Reihenfolge gegenüber weiteren `auth.users`-Profiltriggern zu prüfen. |
| `20261111_organizations_memberships_permissions.sql` | Erstellt eigenständiges `pfms_organizations`/`pfms_memberships`-Modell, Rollen-/Admin-RPCs und Signup-Provisionierung. | Das ist ein zweites Organisationsmodell und nicht das Legacy-Modell der anderen Dateien. Im Staging existieren bereits gleichnamige PFMS-Tabellen, aber Funktions-/Spalten-/Policy-Gleichheit ist nicht belegt. Trigger- und Datenmodell-Kollisionen sind möglich. |

**Ergebnis:** Diese Gruppe enthält zwei konkurrierende Organisationsmodelle: das Legacy-Modell (`organizations`/`organization_memberships`) und das neue PFMS-Modell (`pfms_organizations`/`pfms_memberships`). Sie dürfen nicht als ein gemeinsamer, linear ausführbarer Stapel behandelt werden. Die beiden `pfms_admin_list_legacy_scouts(text)`-Definitionen sind eindeutig eine Basisdefinition plus Typkorrektur; die Korrektur muss nach der Basis kommen.

### Präfix 20261112

| Datei | Inhalt / Abhängigkeit | Bewertung |
|---|---|---|
| `20261112_pfms_legacy_org_manager_guard.sql` | Definiert `can_manage_org(uuid)` für `organization_memberships` mit Rollen owner/club_admin/agency_admin. | Legacy-Tabellen fehlen im aktuellen Staging. |
| `20261112_private_scout_workspaces.sql` | Erstellt `pfss_scout_players`, `pfss_scout_reports`, `pfss_scout_media`, RLS/Storage und nutzt `pfms_is_admin()`. | Die erwarteten drei Tabellen fehlen; Staging besitzt andere Tabellen wie `pfss_players` und `pfss_scouting_reports`. Diese sind nicht ohne Daten-/Spalten-/Policy-Abgleich austauschbar. Zusätzlich verändert die Datei Storage-Bucket-/Policy-Zustand. |

**Ergebnis:** Manager-Guard ist Legacy-abhängig. Private Scout Workspaces sind ein eigenständiger Daten-/Storage-Baustein und erfordern gesonderte Prüfung der vorhandenen Storage-Policies.

### Präfixe 20261115–20261118

- `20261115_admin_global_member_directory.sql` erweitert das Legacy-Modell und ruft `pfms_is_admin()` auf; es setzt `organization_memberships`, `organizations` und Profil-/Auth-Verknüpfungen voraus.
- `20261115_pfms_global_player_catalogue.sql` und `20261115_pfms_platform_owner_bootstrap.sql` wurden bereits oben als fehlende Tabellen-/Funktionsbasis dokumentiert.
- `20261116_pfms_legacy_admin_compat.sql` ersetzt `is_admin()` durch einen Wrapper auf `pfms_is_admin()`. Das ist eine sicherheitsrelevante Funktionsüberschreibung und setzt die kanonische Helper-Funktion voraus.
- `20261116_pfms_owner_bootstrap_registration_guard.sql` setzt `pfms_platform_owner` voraus, die in einer anderen Datei angelegt wird; es gewährt `pfms_claim_initial_owner(uuid)` ausschließlich `service_role`.
- `20261117_pfms_system_event_hardening.sql` setzt die zuvor anzulegende Tabelle `pfms_system_events` voraus und ersetzt deren Triggerfunktion. Es kann nicht vor der Monitoring-Basismigration laufen.
- `20261118_pfms_legacy_org_manager_guard.sql` ist inhaltlich identisch mit der Datei vom 12.11.2026 (gleiche Funktionssignatur und gleiche Definition). Das ist eine echte inhaltliche Dublette über verschiedene Versionspräfixe, nicht eine zweite unabhängige Funktion.
- `20261118_pfms_scout_force_rls.sql` setzt die drei Tabellen aus `20261112_private_scout_workspaces.sql` voraus und erzwingt anschließend FORCE RLS. Ohne die Basistabellen bricht es ab.

### Vorläufige Abhängigkeitskette aus Runde 1

1. Legacy-Mitgliedschafts-/Organisationsschema muss zunächst eindeutig als tatsächlich unterstütztes Modell identifiziert werden.
2. Danach können Legacy-Helper (`is_admin`, `can_manage_org`) und Legacy-Admin-/Einladungs-RPCs bewertet werden.
3. Die Scout-Workspace-Härtung ist strikt nach Erstellung der Scout-Workspace-Tabellen zu betrachten.
4. System-Event-Härtung ist strikt nach Erstellung der Event-Tabelle und Triggerbasis zu betrachten.
5. Owner-Bootstrap-Registrierung ist strikt von der Owner-Basistabelle und einem abgesicherten Service-Role-Prozess abhängig.

### Noch offene Punkte

- Die restlichen Kollisionsgruppen und sämtliche Nicht-Kollisionsmigrationen sind noch nicht vollständig einzeln klassifiziert.
- Die exakten Definitionen der Auth-Trigger, Storage-Policies und vorhandenen Funktions-ACLs müssen vor jeder Freigabe gegen die jeweiligen SQL-Dateien verglichen werden.
- Keine Migration wurde angewendet, umbenannt oder aus der Historie als ausgeführt markiert.
- Die aktuelle Analyse bestätigt bereits mehrere harte Blocker: fehlende Legacy-Basistabellen, konkurrierende Organisationsmodelle, echte doppelte Helper-Definition und Reihenfolgeabhängigkeiten zwischen Basis-/Hardening-Migrationen.
