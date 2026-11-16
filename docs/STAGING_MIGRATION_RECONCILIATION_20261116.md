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
