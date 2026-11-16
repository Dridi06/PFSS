# PFMS – Projektcheckpoint und Teststatus (16.11.2026)

## 1. Gesicherter Projektstand

- Produktname: **Professional Football Management System (PFMS)**.
- Repository: `Dridi06/PFSS` (historischer Repository-Name bleibt vorerst bestehen).
- Arbeitsbranch: `feature/pfss-complete-platform-build`.
- Aktueller Branch-HEAD zum Checkpoint: `274a6eed20dce5f07022a8c83182c71061b66a44`.
- Letzter Code-Commit mit Sicherheitsänderungen: `4238f758429b88a967489d6997e093fdf7dc70dd`.
- Letzter Dokumentations-Commit: `274a6eed20dce5f07022a8c83182c71061b66a44`.
- Push-CI und Pull-Request-CI für HEAD `274a6ee`: beide erfolgreich.
- PR #1 bleibt Draft und ist nicht gemergt.

## 2. Unveränderliche Sicherheits- und Arbeitsgrenzen

- Ausschließlich Test-/Staging-Umgebung verwenden.
- `main`, Produktions-Supabase, produktives Render und produktive Nutzerdaten nicht ändern.
- Keine Produktionsdeployments, kein Merge von PR #1 ohne neue ausdrückliche Freigabe.
- Keine zusätzliche kostenpflichtige Supabase-Branch-Infrastruktur ohne vorherige Zustimmung.
- Vorhandene Staging-Nutzer/Profil-Datensätze nicht löschen oder verändern.
- Keine Auth-Benutzer in `auth.users` direkt per SQL anlegen.
- Testkonten nur über einen unterstützten sicheren Auth-Provisionierungsweg anlegen.
- Keine echten Test-Logins behaupten, solange kein Browser-/Auth-E2E-Lauf durchgeführt wurde.

## 3. In diesem Arbeitsabschnitt erledigte Sicherheitsarbeiten

### SECURITY DEFINER und EXECUTE-Rechte
- 23 SECURITY DEFINER-Funktionen im Staging-Inventar geprüft.
- Effektive EXECUTE-Rechte für `anon` und `authenticated`, Funktionsdefinitionen, Besitzer, `search_path` und Aufrufpfade untersucht.
- `rls_auto_enable()` gegen direkte Ausführung durch PUBLIC, anon und authenticated gesperrt; der Event Trigger `ensure_rls` bleibt funktionsfähig.
- 11 Admin-/Einladungs-RPC-Aufrufe mit zufälliger, nicht privilegierter JWT-Identität geprüft; alle wurden mit SQLSTATE `42501` verweigert.

### Organisations- und Profilfreigabe
Folgende Staging-Funktionen wurden angepasst:
1. `pfms_is_org_member(uuid)`
2. `pfss_has_org_role(uuid,text[])`
3. `pfss_create_organization(text,text,text)`
4. `pfss_org_remove_member(uuid)`
5. `pfss_org_update_member(uuid,text,text)`
6. `pfss_is_platform_admin()`

Zentrale Regel: Eine aktive Mitgliedschaft allein reicht nicht. Geschützte Mandantenpfade verlangen jetzt ein zugehöriges Profil mit Status `approved`; Organisationsmitgliedschaft und Organisation müssen ebenfalls aktiv sein. Der alternative Plattform-Admin-Pfad über `pfss_platform_roles` verlangt dieselbe Profilfreigabe.

Zusätzlich:
- Owner-Schutz und Admin-Hierarchie der Mitgliederverwaltung erhalten.
- Audit-Logging in den Mitgliederverwaltungs-RPCs erhalten.
- Leerer `search_path` in den gehärteten SECURITY DEFINER-Funktionen.
- PUBLIC/anon EXECUTE für die betroffenen Funktionen entzogen; authenticated erhält nur die vorgesehenen RPC-Rechte.
- Plattformrollen-Tabelle geprüft: Browsernutzer haben keine Selbstvergabe von Plattformrollen; die vorhandene Lesepolicy beschränkt den Zugriff auf den eigenen Eintrag.

## 4. Tatsächlich ausgeführte Staging-Laufzeittests

Die folgenden Prüfungen wurden per SQL auf dem Staging-Projekt `oolvpbzbqiojioazsoun` ausgeführt:

- `pfss_has_org_role`: freigegebener aktiver Owner zugelassen.
- Rollen-Allowlist: nicht erlaubte Rolle abgewiesen.
- Fremde Organisations-ID: abgewiesen.
- Fehlender JWT-Subject: abgewiesen.
- `pfms_is_org_member`: freigegebene aktive Mitgliedschaft zugelassen; unbekannte Identität und fehlender JWT-Subject abgewiesen.
- 11 Admin-/Einladungs-RPC-Aufrufe: zufällige Nicht-Admin-Identität bei allen mit `42501` blockiert.
- `pfss_create_organization`: nicht freigegebene/zufällige Identität abgewiesen; Anzahl der Organisationen blieb unverändert.
- `pfss_org_remove_member`: freigegebener Owner gelangte bis zur Owner-Schutzprüfung; Nicht-Mitglied abgewiesen.
- `pfss_org_update_member`: freigegebener Owner gelangte bis zur Owner-Schutzprüfung; Nicht-Mitglied abgewiesen.
- `pfss_is_platform_admin`: vorhandener freigegebener Admin zugelassen; zufällige Identität und fehlender JWT-Subject abgewiesen.
- DDL-RLS-Event-Trigger: Probetabelle angelegt, automatisches RLS-Verhalten geprüft, Probetabelle anschließend entfernt.
- Effektive EXECUTE-Rechte nach den Änderungen erneut abgefragt.

**Testgrenze:** Ein zufälliger JWT-Subject ohne Profil wurde als nicht freigegebene Identität simuliert. Ein bestehendes Pending-Profil wurde nicht verändert. Die SQL-Definitionen verlangen explizit `profiles.status='approved'`; ein vollständiger Browser-Direct-REST-Test mit realem Pending-Auth-Konto ist noch offen.

## 5. CI- und Repository-Testabdeckung

Der aktuelle Push- und Pull-Request-CI-Lauf für `274a6ee` war erfolgreich:
- Push run: [43781399328](https://github.com/Dridi06/PFSS/actions/runs/43781399328)
- Pull request run: [43781403574](https://github.com/Dridi06/PFSS/actions/runs/43781403574)

Beide enthalten den Job zum Type-Check der Supabase Edge Functions und den Job für Syntax-/Projekt-Smoke-Tests.

Die in `package.json` eingebundene Testabdeckung umfasst:
- JavaScript-Syntaxprüfung für App, Workspace, Build-Skripte und Testskripte.
- Build- und Distribution-Smoke-Tests.
- Auth-Branding, Session-Lifecycle und Connection-Status.
- Accessibility und Design-System.
- Benutzerbezogene Daten-RLS, Mandantenisolation und Team-Berechtigungen.
- Frontend-RPC-Verträge und Tenant-Write-Boundaries.
- Funktions-EXECUTE-Rechte und SECURITY DEFINER ACL.
- Kritische Funktionsdefinitionen und effektive Autorisierung.
- DDL-Event-Trigger-/RLS-Härtung.
- Migrationssyntax, Abhängigkeitsgraph, Ledger-Preflight und Versionskollisionen.
- Staging-Acceptance-SQL-Vertrag und Testpersona-Vertrag.
- RPC-Inventar und RPC-Deprecation-Prüfung.
- Backup-HMAC/Integrität, Storage-Preflight, Storage-Inventar, Supabase-Adapter, Archive/Kryptografie und R2-Adapter.
- Neu ergänzter Regressionstest für aktive Organisationen und Profilfreigabe: `tests/pfss-active-organization-rpc-guard-smoke.mjs).

CI-Erfolg bedeutet: die oben eingebundenen Repository-Prüfungen sind für den betreffenden Commit erfolgreich gelaufen. Es bedeutet **nicht**, dass jede Rolle bereits in einem echten Browser angemeldet und jeder UI-Workflow manuell end-to-end durchgespielt wurde.

## 6. Staging-Datenbestand nach den Tests

Letzte Bestandskontrolle:
| Tabelle | Anzahl |
|---|---:|
| `auth.users` | 1 |
| `public.profiles` | 1 |
| `public.pfms_organizations` | 1 |
| `public.pfms_memberships` | 1 |
| `public.pfss_organizations` | 1 |
| `public.pfss_memberships` | 1 |
| `public.pfss_audit_log` | 0 |

Die Laufzeittests haben keine fachlichen Bestandsdaten verändert. Die 41 vorgesehenen Rollen-Testpersonen (Scout, Verein, Trainer, Co-Trainer, Agentur, Agenturscout, Betreuer, Spieler – je maximal fünf – plus ein Admin) wurden **noch nicht als echte Auth-Nutzer angelegt**.

## 7. Offene Punkte und Blocker

1. **Echte Auth-/Browser-E2E-Tests:** Testregistrierung, Login, Rollenmenüs, Berechtigungen und Workflows für alle vorgesehenen Rollen. Vorher klären, ob Staging-E-Mail-Bestätigung erforderlich ist, und einen sicheren Provisionierungsweg nutzen.
2. **Auth-Passwortschutz:** Supabase Leaked Password Protection ist noch deaktiviert. Die Einstellung konnte über die aktuell verfügbaren Projektwerkzeuge nicht sicher geändert werden; im Staging-Auth-Dashboard prüfen/aktivieren.
3. **Migrationen:** Staging-Migrationsledger ist nicht vorhanden bzw. nicht nachweisbar; 66 SQL-Migrationen und Versionskollisionen sind dokumentiert. Keine unkontrollierte Migration anwenden, bevor Ledger-/Baseline-Plan geklärt ist.
4. **Supabase Advisor:** verbleibende generische SECURITY DEFINER-Hinweise für authenticated, Performance-Hinweise (u. a. FK-Indizes und Policy-Optimierung) einzeln bewerten. Keine pauschalen Rechteentzüge oder Indexlöschungen.
5. **UI-Funktionstests:** Die visuellen und fachlichen Flows der acht Rollen sind noch nicht in einem realen Browser geprüft.
6. **Headergrafik:** Die vom Nutzer ausgewählte PFMS-Headergrafik ist noch nicht nachweislich in Login/Registrierung integriert.
7. **Online-Präsenz / Last Editor:** echtes Scout-Online-Presence-Tracking und Last-Editor-Nachverfolgung sind noch nicht nachweislich implementiert.
8. **Testpersona-Matrix:** synthetische Persona-Fixtures und Read-only Acceptance-SQL sind vorhanden/konzipiert; keine echten Testkonten oder Auth-Identitäten daraus ableiten.

## 8. Nächster sinnvoller Arbeitsplan

1. Aktuellen Branch-HEAD und CI vor Wiederaufnahme verifizieren.
2. Auth-Bestätigungsmodus im Staging klären und sicheren Testkonto-Provisionierungsweg bestimmen.
3. Bestehende Testpersona-/Acceptance-SQL nur lesend prüfen; keine vorhandenen Nutzer/Profiles verändern.
4. Migration-Ledger-/Versionskollisionsproblem separat lösen, bevor weitere Schema-Migrationen ausgeführt werden.
5. E2E-Testmatrix für die acht Rollen vorbereiten und echte Browsertests erst nach sicherer Kontenerstellung durchführen.
6. UI-/Designarbeit fortsetzen, einschließlich Login-Headergrafik, ohne das bestehende Menü-/Seitenlayout unnötig umzubauen.
7. Online-Präsenz und Last-Editor-Funktionalität implementieren und mit Mandantenisolation testen.

## 9. Fortsetzungsanweisung

Beim nächsten Chat mit diesem Projektcheckpoint fortfahren. Zuerst Branch `feature/pfss-complete-platform-build`, HEAD, offene CI-Läufe und Staging-Sicherheitsstatus erneut prüfen. Alle oben genannten Sicherheits- und Produktionsgrenzen bleiben bestehen.
