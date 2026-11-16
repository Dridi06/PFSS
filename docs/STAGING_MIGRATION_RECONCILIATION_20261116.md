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
