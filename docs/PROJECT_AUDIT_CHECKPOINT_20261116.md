# PFMS – Gesamtprojekt-Audit / Checkpoint 16.11.2026

## Arbeitsgrenzen
- Produkt: **Professional Football Management System (PFMS)**; PFMS ist die Abkürzung.
- Repository: `Dridi06/PFSS`
- Arbeitsbranch: `feature/pfss-complete-platform-build`
- Audit-Basis-HEAD: `d95300a46a8afa0aedf11d78457af18920167eb0`
- Dokumentations-Checkpoint: `94b513a41d47c68cbbe193e061e7615dce7e6cb5`
- Render-Staging: `pfss-staging`, https://pfss-staging.onrender.com/
- Render-Service: `srv-dbr1oou7bikc73fj9f4g`; Auto-Deploy OFF.
- Zugeordnetes Supabase-Staging: `oolvpbzbqiojioazsoun` (PFFS-Test, eu-west-1, ACTIVE_HEALTHY).
- Produktion, `main`, produktive Daten und produktive Deployments wurden nicht verändert.

## Vorläufiger Gesamtfortschritt
**76 % – unverändert und vorläufig.** Diese Audit-Runde allein erhöht den Wert nicht. Ein höherer Wert setzt verifizierte Runtime- und Produktabnahmen voraus.

## Repository und CI
- Der Feature-Branch enthält statisches HTML/CSS/JS, Supabase-Migrationen, Edge-Function-Quellen, Sicherheits-/Buildtests, Backup-/Restore-Skripte und Betriebsdokumentation.
- Rekursiver Repository-Baum: 68 Einträge unter `supabase/migrations/` einschließlich Hilfsmanifesten.
- `package.json` definiert Syntax-, Build-, Smoke-, Accessibility-, Migration-, RPC-, Tenant-Isolation-, Berechtigungs- und Backuptests.
- Render meldet den letzten Staging-Deploy auf Commit `d95300a...` als `live`.
- Nach dem Audit-Dokumentations-Commit `94b513a...` sind sowohl GitHub Push-CI als auch PR-CI erfolgreich abgeschlossen: Runs [43774922402](https://github.com/Dridi06/PFSS/actions/runs/43774922402) und [43774926568](https://github.com/Dridi06/PFSS/actions/runs/43774926568).
- CI-Erfolg belegt die Repository-Prüfungen, nicht den Runtime- oder Mandantenschutz in der Live-Staging-Datenbank.

## Supabase-Staging – Read-only-Befunde
- Projektstatus: `ACTIVE_HEALTHY`, PostgreSQL 17.11.
- 15 Tabellen im Schema `public`; die Tabellenübersicht meldet für alle 15 RLS aktiviert.
- `supabase_migrations.schema_migrations` existiert in diesem Projekt aktuell nicht (Read-only-Prüfung via `to_regclass` ergab NULL). Der Supabase-Migrationslisten-Endpunkt lieferte ebenfalls eine leere Liste, obwohl Tabellen und Funktionen vorhanden sind. **Harter Blocker:** Vor jeder Migration muss die Herkunft/Versionierung des bestehenden Schemas geklärt und eine belastbare, nicht erfundene Baseline hergestellt werden. Keine Migration blind anwenden und keine Historie reparieren/umschreiben.
- Es existieren 26 SECURITY DEFINER-Funktionen im public-Schema.
- Security Advisor meldet:
  - 1 Funktion, die laut Advisor für `anon` ausführbar ist: `public.rls_auto_enable()`.
  - 23 SECURITY DEFINER-Funktionen, die laut Advisor für `authenticated` ausführbar sind. Das ist nicht pauschal ein bestätigter Exploit; jede Funktion muss anhand von Zweck, AuthZ-Prädikaten, Suchpfad und effektiven Grants geprüft werden.
  - Leaked-Password-Protection ist laut Advisor deaktiviert.
- Read-only-Katalogabfrage: `rls_auto_enable()` ist SECURITY DEFINER, Eigentümer `postgres`, `search_path=pg_catalog`, ACL NULL. Die effektive EXECUTE-Prüfung lieferte TRUE für `anon` und `authenticated`; die Funktion ist vom Typ `event_trigger`. Der Feature-Branch enthält bereits die passende Hardening-Migration `20261228_pfms_ddl_rls_fail_closed.sql`, die Browser-EXECUTE widerruft und DDL bei RLS-Aktivierungsfehlern abbrechen lässt. Staging enthält erkennbar noch die ältere Definition. Die tatsächliche RPC-Aufrufbarkeit und Event-Trigger-Dispatch-Funktion müssen gezielt getestet werden.
- Frühere TRUNCATE-Sorge am Audit-Log wurde neu geprüft: `service_role`, `anon` und `authenticated` haben aktuell laut `has_table_privilege` kein TRUNCATE-Recht auf `public.pfss_audit_log`. Der ältere Befund ist im aktuellen Staging-Stand nicht bestätigt.
- Performance Advisor meldet 16 unindizierte Foreign Keys, 7 RLS-Policies mit unnötiger wiederholter Auth-Funktionsauswertung, 6 Gruppen mehrfach permissiver Policies und 6 ungenutzte Indizes. Indexe nicht blind löschen; erst Workload und Query-Pläne prüfen.
- Health Advisor lieferte keine Befunde.

## Render-Staging – Konfiguration
- Static Site; Build: `npm run check:syntax && npm run build && npm run test:dist`; Publish-Verzeichnis `dist`.
- Auto-Deploy OFF; nach Codeänderungen ist ein gezielter manueller Staging-Deploy nötig.
- IP-Allowlist: `0.0.0.0/0`; Staging ist öffentlich erreichbar. Das ist nicht automatisch ein Fehler, aber echte Produktionsdaten/Secrets gehören nicht in Staging und AuthZ muss serverseitig wirksam sein.

## Produkt- und Frontend-Befund
- Bestehende Login-/Registrierungsansicht besitzt links den Executive-Arena-Brand-Bereich und rechts die Authentifizierungs-Card. Die bestehenden IDs, Formulare, fünf Registrierungswege und Auth-Logik dürfen bei der Header-Integration nicht beschädigt werden.
- Die ausgewählte neue Header-Grafik liegt lokal in hoher Auflösung vor, ist aber noch nicht als Repository-Asset integriert. Der derzeitige GitHub-Datei-Connector unterstützt Textdatei-Uploads, aber keinen direkten Upload der lokalen Binärdatei; deshalb wurde kein Ersatzbild als vermeintlich identisches Asset ausgegeben.
- Designvorgabe bleibt: Schwarz/Anthrazit/Champagner-Gold, dezent fußballbezogen, lesbar, barrierearm und responsiv. Menü- und Seitenreihenfolge bleibt erhalten.

## Priorisierte Arbeitsliste
1. Sicherheitsprüfung aller SECURITY DEFINER-Funktionen: Datenzugriff, AuthZ, search_path, EXECUTE-Grants und tatsächliche Aufrufbarkeit; Event-Trigger-Funktion gezielt absichern und Regressionstest ergänzen.
2. Migrationsintegrität: fehlende `supabase_migrations.schema_migrations`-Tabelle und Schema-Herkunft klären; tatsächliches Schema gegen Branch-Migrationen reconciled dokumentieren. Keine Migration bis zur Freigabe.
3. Mandantentrennung: zwei getrennte Testidentitäten/-organisationen; positive und negative Tests für Tabellen, RPCs, Storage/Medien und Adminpfade.
4. Frontend-/Produktqualität: Header-Asset integrieren, bestehende Login-Verträge erhalten; Desktop-/Mobile-/Accessibility- und Auth-Roundtrip-Tests.
5. Fachmodule: Scouting, Spieler-/Teamverwaltung, Kalender, Aufgaben, Medien, Benachrichtigungen und Admin-Arbeitsbereich anhand echter End-to-End-Akzeptanzkriterien testen.
6. Betrieb: Backup-/Restore-Probe, Monitoring, Fehlerbehandlung, Performance sowie Datenschutz-/Rechtsprüfung.
7. Release-Gate: PR #1 bleibt Draft; kein Merge und keine Produktion ohne ausdrückliche Freigabe.

## Änderungsnachweis
Dieser Checkpoint dokumentiert eine Bestandsaufnahme. Supabase-Abfragen waren lesend; keine Datenbankrechte, Tabellen, Policies, Funktionen, Migrationen oder Render-Einstellungen wurden verändert.
