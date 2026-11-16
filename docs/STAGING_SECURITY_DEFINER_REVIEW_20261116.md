# PFMS – Prüfung und Härtung der SECURITY DEFINER-RPCs (16.11.2026)

## Geltungsbereich
- Ausschließlich Supabase-Staging: Projekt `oolvpbzbqiojioazsoun`.
- Quelle der Funktionsprüfung: tatsächliche PostgreSQL-Definitionen aus `pg_proc` / `pg_get_functiondef`, effektive EXECUTE-Rechte, RLS-Policies und Supabase Security Advisor.
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
- Die reinen Prädikate `pfms_is_admin()` und `pfss_is_platform_admin()` liefern nur das Ergebnis für den aktuellen JWT-Aufrufer.

### Mandanten- und Mitgliedschaftsprüfung
- `pfms_is_org_member()` verlangt jetzt einen authentifizierten Aufrufer, eine aktive Mitgliedschaft, eine aktive Organisation und ein zugehöriges Profil mit Status `approved`.
- `pfss_has_org_role()` verlangt jetzt zusätzlich zum authentifizierten Aufrufer, zur aktiven Mitgliedschaft, aktiven Organisation und optionalen Rollen-Allowlist ein Profil mit Status `approved`.
- Die bestehenden PFSS-RLS-Policies für Organisationen, Mitgliedschaften, Spieler, Scouting-Berichte, Teams, Aufgaben, Kalender, Medien und Einladungen greifen auf `pfss_has_org_role()` zurück. Die Profilfreigabe wird damit serverseitig auch bei direkten REST-Zugriffen berücksichtigt.
- Die PFMS-Mitgliedschafts-RLS-Policies verwenden `pfms_is_org_member()`; auch dort ist die Profilfreigabe serverseitig Teil der Entscheidung.
- `pfss_org_list_invitations`, `pfss_org_list_members` und `pfss_org_revoke_invitation` hängen an der gehärteten Rollenprüfung.
- `pfms_create_legacy_invitation` verlangt Authentifizierung, Rollen-Allowlist, Ablaufzeit zwischen 1 und 30 Tagen und aktive Owner-/Admin-Berechtigung.
- `pfss_org_remove_member` und `pfss_org_update_member` verlangen ein freigegebenes Profil sowie aktive Mitgliedschaft und aktive Organisation; Owner-/Admin-Hierarchie und Audit-Logging bleiben erhalten.
- `pfss_create_organization` verlangt jetzt zusätzlich ein Profil mit Status `approved`; ein authentifiziertes, aber noch nicht freigegebenes Konto kann nicht selbst eine aktive Organisation und Owner-Mitgliedschaft anlegen.

### Triggerfunktionen
- `pfms_provision_new_account()`, `pfss_apply_signup_invitation()` und `pfss_handle_new_auth_user()` sind Triggerfunktionen. Browserrollen besitzen keine direkte EXECUTE-Berechtigung.
- Der Signup-Trigger kann bei Registrierung initiale Mitgliedschaftsdatensätze erzeugen, bevor die manuelle Profilfreigabe abgeschlossen ist. Die geschützten Datenpfade prüfen nun zusätzlich `profiles.status='approved'`; die bloße Existenz einer aktiven Mitgliedschaft reicht nicht mehr aus.

## Gefundene und korrigierte Schwachstellen
1. `rls_auto_enable()` war als SECURITY DEFINER direkt für Browserrollen ausführbar. EXECUTE wurde für `PUBLIC`, `anon` und `authenticated` entzogen. Der Event Trigger `ensure_rls` blieb aktiv. Ein DDL-Probelauf bestätigte, dass neue Tabellen weiterhin automatisch RLS erhalten.
2. `pfss_has_org_role()` prüfte zuvor aktive Mitgliedschaft, aber nicht den Status der Organisation. Die Funktion verlangt jetzt aktive Organisation und freigegebenes Profil. `search_path` ist leer; PUBLIC/anon bleiben gesperrt.
3. `pfss_org_remove_member()` und `pfss_org_update_member()` prüften zuvor weder den Status der Organisation noch die Profilfreigabe des handelnden Mitglieds. Beide Funktionen verlangen jetzt aktive Mitgliedschaft in aktiver Organisation und `profiles.status='approved'`. Owner-Schutz, Admin-Hierarchie und Audit-Logging bleiben erhalten. `search_path` ist leer; PUBLIC/anon bleiben gesperrt.
4. Die Login-Oberfläche blockierte Profile mit Status `pending`, die zentrale serverseitige Autorisierung tat dies zuvor jedoch nicht durchgängig. Da der Auth-Signup-Trigger Organisationsmitgliedschaften bereits vor der manuellen Freigabe anlegen kann, bestand ein möglicher Direct-REST-Bypass. Jetzt prüfen `pfms_is_org_member()` und `pfss_has_org_role()` explizit das zugehörige Profil mit Status `approved`; `pfss_create_organization()` und die Mitgliederverwaltungs-RPCs verlangen die Freigabe ebenfalls. Die betroffenen Rollen-/Tenant-RLS-Policies greifen auf diese Helfer zurück.

Die manuelle Staging-SQL liegt unter:
`supabase/manual-staging-hardening/20261116_pfss_active_organization_membership_guard.sql`
Sie ist absichtlich **keine** Migration und liegt nicht unter `supabase/migrations`, weil das Staging-Migrationsledger fehlt und die Versionskollisionen noch nicht bereinigt sind. Sie ist ausschließlich für den dokumentierten Staging-Abgleich gedacht.

## Ausgeführte Verifikation
- `pfss_has_org_role()`: positiver Test für aktive Owner-Mitgliedschaft mit freigegebenem Profil bestanden; falsche Rollen-Allowlist, fremde Organisations-ID und fehlender JWT-Aufrufer abgewiesen.
- `pfms_is_org_member()`: aktives PFMS-Mitglied mit freigegebenem Profil zugelassen; unbekannte Identität und fehlender JWT-Aufrufer abgewiesen.
- 11 Admin-/Einladungs-RPC-Aufrufe wurden mit einer zufälligen, nicht privilegierten JWT-Identität ausgeführt; alle wurden mit SQLSTATE `42501` abgewiesen.
- `pfss_create_organization()`: zufällige Identität ohne freigegebenes Profil wurde mit `42501` abgewiesen; Organisationsanzahl blieb unverändert.
- `pfss_org_remove_member()` / `pfss_org_update_member()`: der freigegebene aktive Owner gelangte bis zum jeweiligen Owner-Schutz; zufälliger Nicht-Mitglieds-Aufrufer wurde mit `42501` abgewiesen.
- `rls_auto_enable()`: DDL-Probelauf erfolgreich; RLS wurde automatisch eingeschaltet und die kurzlebige Probe-Tabelle anschließend entfernt.
- Bestandskontrolle nach den Tests: `auth.users` = 1, `profiles` = 1, `pfss_organizations` = 1, `pfss_memberships` = 1, `pfss_audit_log` = 0, `pfms_organizations` = 1 und `pfms_memberships` = 1. Die Testläufe haben keine fachlichen Datensätze verändert.
- Regressionstest: `tests/pfss-active-organization-rpc-guard-smoke.mjs`; Paketprüfung integriert.
- Der Push- und Pull-Request-CI-Lauf für Commit `9d188648fcb42f8b1c3d23ddda6f56e933ea1385` ist erfolgreich.

**Testgrenze:** Die nicht freigegebene Identität wurde als zufälliger JWT-Subject ohne Profil simuliert. Ein vorhandenes Pending-Profil wurde nicht verändert, um den Staging-Bestand unangetastet zu lassen. Die explizite Bedingung `profile.status='approved'` wurde direkt in den aktiven Funktionsdefinitionen geprüft.

## Verbleibende Hinweise
- Supabase Security Advisor meldet weiterhin 22 SECURITY DEFINER-Funktionen, die für `authenticated` aufrufbar sind. Das ist ein generischer Linter-Hinweis auf erhöhte Rechte, kein Nachweis eines offenen anonymen Zugangs. Diese Endpunkte sind absichtlich für angemeldete Aufrufer verfügbar und wurden durch Berechtigungsprüfungen abgesichert. Ein pauschales REVOKE würde legitime Funktionen brechen.
- Leaked Password Protection ist in Supabase Auth weiterhin deaktiviert. Über die verfügbaren Projektwerkzeuge steht keine sichere Auth-Konfigurationsänderung zur Verfügung; die Einstellung bleibt ein separater Auth-Dashboard-Schritt. [Supabase-Dokumentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- Ein tatsächlicher Browser-Login-/E2E-Test pro Rolle ist noch offen. Die 41 Testpersonen sind synthetische Fixtures ohne Auth-Identität und ohne Login-Recht.
- Kein pauschales Ändern der übrigen SECURITY DEFINER-Funktionen; ein solcher Eingriff erfordert jeweils einen konkreten Funktions- und Frontend-Abgleich.
- Keine Migration wurde auf die gemeinsam genutzte Staging-Datenbank angewendet. Der Migration-Ledger- und Versionskollisions-Blocker bleibt bestehen.
