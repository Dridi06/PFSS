# PFMS – Prüfung und Härtung der SECURITY DEFINER-RPCs (16.11.2026)

## Geltungsbereich
- Ausschließlich Supabase-Staging: Projekt `oolvpbzbqiojioazsoun`.
- Quelle der Funktionsprüfung: tatsächliche PostgreSQL-Definitionen aus `pg_proc` / `pg_get_functiondef`, effektive EXECUTE-Rechte und Supabase Security Advisor.
- Keine Änderungen an Produktion, `main`, Auth-Benutzern oder produktiven Deployments.
- Die Prüfung bezieht sich auf den gegenwärtigen Staging-Schema-Stand. Dieser ist nachweislich nicht vollständig mit dem Feature-Branch-Migrationsstand synchronisiert.

## Inventar und effektive Rechte
Im Schema `public` wurden 23 SECURITY DEFINER-Funktionen gefunden:
- 22 für `authenticated` aufrufbare RPCs/Autorisierungshelfer.
- 3 Triggerfunktionen ohne direkte EXECUTE-Rechte für Browserrollen.
- `anon` ist bei allen 23 Funktionen effektiv von EXECUTE ausgeschlossen.
- `rls_auto_enable()` ist zusätzlich für `PUBLIC`, `anon` und `authenticated` gesperrt; der Eigentümer `postgres` behält EXECUTE für den Event Trigger.

Die 22 authentifizierten Endpunkte wurden anhand ihrer tatsächlichen Definitionen und ihrer Autorisierungspfade geprüft:

### Plattformadministration
- `is_admin()` delegiert an `pfss_is_platform_admin()`.
- `pfms_admin_list_legacy_org_members`, `pfms_admin_list_legacy_scouts`, `pfms_admin_search_legacy_organizations` und `pfms_admin_update_legacy_membership` verlangen die Plattform-Administratorprüfung.
- `pfss_admin_list_profiles` und `pfss_admin_update_profile` verlangen ebenfalls die Plattform-Administratorprüfung.
- `pfms_admin_list_org_members`, `pfms_admin_list_scouts`, `pfms_admin_search_organizations` und `pfms_admin_update_membership` verlangen die freigegebene PFMS-Administratorprüfung.
- Die beiden reinen Prädikate `pfms_is_admin()` und `pfss_is_platform_admin()` liefern nur das Ergebnis für den aktuellen JWT-Aufrufer.

### Mandanten- und Mitgliedschaftsprüfung
- `pfms_is_org_member` prüft aktive Mitgliedschaft und aktive Organisation.
- `pfss_has_org_role` prüft jetzt zusätzlich explizit authentifizierten Aufrufer, nicht-leere Organisations-ID, aktive Mitgliedschaft, aktive Organisation und optionale Rollen-Allowlist.
- `pfss_org_list_invitations`, `pfss_org_list_members` und `pfss_org_revoke_invitation` hängen an dieser Rollenprüfung.
- `pfms_create_legacy_invitation` verlangt Authentifizierung, Rollen-Allowlist, Ablaufzeit zwischen 1 und 30 Tagen und aktive Owner-/Admin-Berechtigung.
- `pfss_org_remove_member` und `pfss_org_update_member` prüfen jetzt die aktive Mitgliedschaft des Aufrufers zusammen mit dem Status der Organisation.
- `pfss_create_organization` ist eine bewusst authentifizierte Self-Service-Funktion zur Organisationsanlage; sie gibt keine fremden Mandantendaten frei.

### Triggerfunktionen
- `pfms_provision_new_account()`, `pfss_apply_signup_invitation()` und `pfss_handle_new_auth_user()` sind Triggerfunktionen. Browserrollen besitzen keine direkte EXECUTE-Berechtigung.

## Gefundene und korrigierte Schwachstellen
1. `rls_auto_enable()` war als SECURITY DEFINER direkt für Browserrollen ausführbar. EXECUTE wurde für `PUBLIC`, `anon` und `authenticated` entzogen. Der Event Trigger `ensure_rls` blieb aktiv. Ein DDL-Probelauf bestätigte, dass neue Tabellen weiterhin automatisch RLS erhalten.
2. `pfss_has_org_role()` prüfte vor der Korrektur aktive Mitgliedschaft, aber nicht den Status der Organisation. Die Funktion wurde durch eine fail-closed Version mit aktivem Organisationsstatus und leerem `search_path` ersetzt. PUBLIC/anon bleiben gesperrt; authenticated behält den vorgesehenen RPC-Zugriff.
3. `pfss_org_remove_member()` und `pfss_org_update_member()` prüften bisher nur die aktive Mitgliedschaft und nicht den Status der Organisation. Beide Funktionen wurden so ersetzt, dass sie authentifizierte Aufrufer, aktive Mitgliedschaft in einer aktiven Organisation, Rollen-Allowlist, Owner-Schutz und Audit-Logging prüfen. Der `search_path` ist leer und vollständig qualifizierte Objektnamen werden verwendet. PUBLIC/anon bleiben gesperrt.

Die manuelle Staging-SQL liegt unter:
`supabase/manual-staging-hardening/20261116_pfss_active_organization_membership_guard.sql`
Sie ist absichtlich **keine** Migration und liegt nicht unter `supabase/migrations`, weil das Staging-Migrationsledger fehlt und die Versionskollisionen noch nicht bereinigt sind.

## Ausgeführte Verifikation
- `pfss_has_org_role`: positiver Test für aktive Owner-Mitgliedschaft bestanden; falsche Rollen-Allowlist abgewiesen; fremde Organisations-ID und fehlender JWT-Aufrufer abgewiesen.
- 11 Admin-/Einladungs-RPC-Aufrufe wurden mit einer zufälligen, nicht privilegierten JWT-Identität ausgeführt; alle wurden mit SQLSTATE `42501` abgewiesen.
- `pfss_org_remove_member` / `pfss_org_update_member`: aktiver Owner gelangt bis zum jeweiligen Owner-Schutz; zufälliger Nicht-Mitglieds-Aufrufer wird mit `42501` abgewiesen.
- `rls_auto_enable`: DDL-Probelauf erfolgreich; RLS wurde automatisch eingeschaltet und die kurzlebige Probe-Tabelle anschließend entfernt.
- Bestandskontrolle nach den Tests: `auth.users` = 1, `profiles` = 1, `pfss_organizations` = 1, `pfss_memberships` = 1, `pfss_audit_log` = 0, `pfms_organizations` = 1 und `pfms_memberships` = 1. Die Testläufe haben keine fachlichen Datensätze verändert.
- Neuer statischer Regressionstest: `tests/pfss-active-organization-rpc-guard-smoke.mjs`.

## Verbleibende Hinweise
- Supabase Security Advisor meldet weiterhin 22 SECURITY DEFINER-Funktionen, die für `authenticated` aufrufbar sind. Das ist ein generischer Linter-Hinweis auf erhöhte Rechte, kein Nachweis eines offenen anonymen Zugangs. Diese Endpunkte sind absichtlich für angemeldete Aufrufer verfügbar und wurden durch Berechtigungsprüfungen abgesichert. Ein pauschales REVOKE würde legitime Funktionen brechen.
- Leaked Password Protection ist in Supabase Auth weiterhin deaktiviert. Über die verfügbaren Projektwerkzeuge steht keine sichere Auth-Konfigurationsänderung zur Verfügung; die Einstellung bleibt ein separater Auth-Dashboard-Schritt.
- Ein tatsächlicher Browser-Login-/E2E-Test pro Rolle ist noch offen. Die 41 Testpersonen sind synthetische Fixtures ohne Auth-Identität und ohne Login-Recht.
- Kein pauschales Ändern der übrigen SECURITY DEFINER-Funktionen; ein solcher Eingriff erfordert jeweils einen konkreten Funktions- und Frontend-Abgleich.
