# PFMS – Projekt- und Sicherheitskontrollpunkt
**Stand:** 15.11.2026  
**Projekt:** Professional Football Management System (PFMS)  
**Repository:** Dridi06/PFSS  
**Arbeitsbranch:** feature/pfss-complete-platform-build  
**Umgebung der aktuellen SQL-Prüfungen:** Supabase STAGING  
**Gesamtfortschritt:** 76 % vorläufig (unverändert; keine Neubewertung allein aufgrund der SQL-Prüfungen)

## 1. Aktueller Prüfstand

Die schrittweise Supabase-STAGING-Sicherheitsprüfung wurde bis zur Prüfung der Audit-Tabellenrechte fortgeführt. Alle nachfolgend als ausgeführt bezeichneten SQL-Änderungen wurden vom Benutzer im Supabase SQL Editor ausgeführt und durch Folgeabfragen verifiziert.

### Verifizierte Änderungen
1. `REVOKE TRUNCATE, TRIGGER` auf allen 15 Anwendungstabellen für `authenticated`; Folgeprüfung bestätigte für alle 15 Tabellen `can_truncate=false` und `can_create_trigger=false`.
2. Dasselbe Recht wurde für `public.profiles` separat entzogen und verifiziert.
3. `PUBLIC` wurde EXECUTE auf `public.pfms_provision_new_account()` entzogen. Folgeprüfung: anon=false, authenticated=false, postgres=true.
4. `pfms_provision_new_account()` erhielt den Suchpfad `pg_catalog, public`; die Einstellung wurde verifiziert.
5. `authenticated` wurde USAGE auf `public.pfss_audit_log_id_seq` entzogen. Folgeprüfung: anon=false, authenticated=false, postgres=true.

**Wichtig:** Diese Änderungen sind manuell auf STAGING ausgeführt. Sie sind noch nicht als versionierte, geprüfte GitHub-Migration dokumentiert oder auf Produktion angewendet.

## 2. Geprüfte Architektur und Befunde

### Anwendungstabellen und RLS
- 15 Anwendungstabellen in `public`; alle 15 hatten RLS aktiviert.
- Keine der 15 Tabellen hatte FORCE ROW LEVEL SECURITY aktiviert.
- Insgesamt 25 RLS-Policies wurden zuvor erfasst.
- Die direkten Tabellenrechte und Policies wurden teilweise geprüft. Für `profiles` war UPDATE auf Spalten `display_name` und `username` begrenzt; kein Update-Recht auf `role` oder `status`.

### Organisations- und Mitgliedschaftsfunktionen
Folgende sieben Funktionen wurden auf Definitionen, SECURITY DEFINER und EXECUTE-ACL geprüft:
- `pfss_create_organization(text,text,text)`
- `pfss_has_org_role(uuid,text[])`
- `pfss_org_list_invitations(uuid)`
- `pfss_org_list_members(uuid)`
- `pfss_org_remove_member(uuid)`
- `pfss_org_revoke_invitation(uuid)`
- `pfss_org_update_member(uuid,text,text)`

Für alle sieben: SECURITY DEFINER=true, anon EXECUTE=false, authenticated EXECUTE=true; ACL nennt postgres und authenticated, nicht PUBLIC.

Berechtigungslogik der Mitgliedschaftsfunktionen:
- Mitglieder- und Einladungslisten verlangen aktive owner/admin-Mitgliedschaft.
- Entfernung und Aktualisierung schützen owner-Mitgliedschaften.
- Ein admin kann keine anderen admin-Mitgliedschaften verwalten.
- Einladungswiderruf ermittelt zuerst die Organisations-ID und prüft danach owner/admin.
- Die drei schreibenden Funktionen protokollieren die Änderungen im Audit-Log.

Offene Detailpunkte:
- `pfss_create_organization`: NULL-Validierung des Organisationstyps sowie Slug-Format/Längenvalidierung in der Funktion weiter prüfen.
- Fehlermeldungen bei fremden/unbekannten IDs könnten Existenzinformationen offenlegen; bislang kein nachgewiesener IDOR.
- `pfss_org_list_members` verwendet `auth` im search_path. Schema-Prüfung ergab: anon/authenticated haben dort USAGE, aber kein CREATE. Ebenso haben sie in public kein CREATE.
- Alle drei Schreibfunktionen laufen SECURITY DEFINER und gehören postgres.

### Mitgliedschafts- und Organisationstabellen
- `pfss_memberships`: PK, FK zu Organisation und auth.users, Rollen- und Status-CHECKs, UNIQUE(organization_id,user_id), zusätzlicher UNIQUE(organization_id,id), aktiver User/Org-Index.
- Datenabfrage fand eine Organisation mit genau einem aktiven owner. Das beweist nicht, dass die Datenbank zukünftige Mehrfach-Owner oder owner-lose Organisationen verhindert.
- `pfss_organizations`: CHECK für Name, erlaubte Organisationstypen und Status; FK `created_by` zu auth.users mit ON DELETE RESTRICT; UNIQUE slug.
- Spalten: id UUID NOT NULL mit gen_random_uuid(), name/type/status/created_by NOT NULL, slug optional, created_at/updated_at NOT NULL mit now().
- Slug-Prüfung: 0 ungültige, 0 leere; eine erste Duplikat-Zählabfrage war irreführend. Direkte GROUP BY/HAVING-Abfrage lieferte keine Zeilen; keine tatsächlichen doppelten Slugs festgestellt.
- Indizes: PK id und UNIQUE slug.

### Audit-Log
- `pfss_audit_log`: RLS aktiv; SELECT-Policy beschränkt auf aktive owner/admin der Organisation.
- INSERT-Policy verlangt actor_id=auth.uid(), organization_id NOT NULL und Organisationsmitgliedschaft. Direkte INSERT-Rechte für authenticated fehlen; SELECT ist vorhanden; UPDATE/DELETE-Policies fehlen.
- `authenticated` hat kein direktes INSERT/UPDATE/DELETE-Recht auf die Tabelle.
- Spalten: id bigint NOT NULL als GENERATED ALWAYS AS IDENTITY; organization_id und actor_id nullable; action/entity_type NOT NULL; metadata NOT NULL DEFAULT '{}'; created_at NOT NULL DEFAULT now().
- Keine benutzerdefinierten Trigger auf Audit-Tabelle gefunden.
- Drei Funktionen schreiben Audit-Einträge: `pfss_org_remove_member`, `pfss_org_revoke_invitation`, `pfss_org_update_member`.
- authenticated hatte USAGE auf `pfss_audit_log_id_seq`; wurde entzogen und verifiziert.
- **Aktueller kritischer Restbefund:** `has_table_privilege('service_role','public.pfss_audit_log','TRUNCATE') = true`; SELECT/INSERT/UPDATE/DELETE für service_role wurden als false zurückgegeben. TRUNCATE umgeht RLS und könnte die gesamte Audit-Tabelle leeren. Das ist ein Risiko bei Missbrauch eines serverseitigen service_role-Schlüssels. Noch NICHT entzogen; Herkunft (direkte ACL, PUBLIC/Role-Vererbung, Default ACL/Provisioning) und vorgesehene Backend-Nutzung müssen zuerst geprüft werden. Keine voreilige Änderung.

## 3. Unmittelbar nächster Arbeitsschritt im neuen Chat

**Weiter strikt Schritt für Schritt; pro Nachricht nur eine SQL-Abfrage oder eine Aktion.**

Als Nächstes die Herkunft von `service_role`-TRUNCATE auf `pfss_audit_log` feststellen:
- effektive Rechte vs. direkte ACL-Einträge und geerbte Rechte getrennt untersuchen;
- prüfen, ob service_role Mitglied anderer Rollen ist und ob Rechte aus PUBLIC oder Default ACL stammen;
- nicht annehmen, dass fehlende SELECT/INSERT/UPDATE/DELETE automatisch fehlendes Risiko bedeutet;
- vor einem REVOKE klären, ob das Backend oder Wartungs-/Retention-Jobs TRUNCATE benötigen;
- nur nach Befund eine gezielte STAGING-Änderung erwägen und anschließend verifizieren.

Danach:
1. übrige privilegierte Rollen/Tabellenrechte und RPC-Schreibpfade prüfen;
2. Audit-Integrität, Backup/Restore und Service-Key-Schutz bewerten;
3. manuelle STAGING-Änderungen als kontrollierte Migration dokumentieren, aber erst nach Auflösung des Migrations-Ledger-/Versionskonflikt-Blockers;
4. keine Migration anwenden und keine Produktionsdatenbank ändern, bevor Ledger, Backup und Reconciliation freigegeben sind.

## 4. Repository-/Release-Kontext aus dem letzten bestätigten Checkpoint

- GitHub: `Dridi06/PFSS`
- Branch: `feature/pfss-complete-platform-build`
- PR #1: Draft, Zielbranch main.
- Letzter zuvor bekannter HEAD: `6d725733123f2e480051402393a7c352c8197682` (vor diesem Kontrollpunkt nicht erneut verifiziert).
- Letzter zuvor bekannter CI-Lauf: `43744580472`, erfolgreich abgeschlossen (Syntax/Smoke und Supabase Edge Function Deno type-check).
- Migrationsbestand damals: 66 timestamped SQL-Dateien, 50 verschiedene 8-stellige Präfixe, 11 kollidierende Präfixgruppen mit insgesamt 16 zusätzlichen Dateien. Versionskollisionen müssen gegen tatsächliches STAGING-Migrationsledger und Schema-Reconciliation aufgelöst werden.
- Die Relation `supabase_migrations.schema_migrations` war in STAGING bei einer früheren Abfrage nicht vorhanden; CLI-Befehl `supabase migration list` wurde versehentlich im SQL Editor eingegeben. Das ist ein CLI-Befehl, kein SQL.
- Kein Production-Deploy, keine Migrationen angewendet. Keine Historie umschreiben, kein Rebase/Merge als Abkürzung.

## 5. Fortschritt und offene Freigabekriterien

- Gesamtprojektfortschritt bleibt **76 % vorläufig**.
- Diese STAGING-Sicherheitsprüfung ist ein Teilbereich und darf nicht mit dem Gesamtfortschritt verwechselt werden.
- Noch offen: Service-role TRUNCATE-Risiko, vollständige RPC-/RLS-Prüfung, Browser-/E2E-Tests, reale Staging-Tenant-Abnahme, Backup-Restore-Test, Migration-Ledger-Abgleich und versionierte Migration der manuellen STAGING-Änderungen.
- Keine Aussage „produktionsbereit“, solange diese Freigabekriterien offen sind.

## 6. Arbeitsweise
- Sprache: Deutsch.
- Schritt-für-Schritt: genau eine Abfrage/Aktion je Nachricht; auf das Ergebnis warten und es auswerten.
- Vor jeder Änderung zuerst lesen und prüfen; keine unbestätigten Annahmen.
- STAGING und Produktion strikt trennen.
- Bestehendes PFMS-Branding: ausgeschrieben **Professional Football Management System**, PFMS nur als Abkürzung.
