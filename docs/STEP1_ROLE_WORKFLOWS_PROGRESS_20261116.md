# PFMS – Schritt 1: Rollen- und Organisationsworkflows

Stand: 16.11.2026

## Ergebnis

Die Implementierung der zentralen Rollen- und Organisationsworkflow-Schicht ist im Entwicklungsbranch umgesetzt und die automatisierten Repository-Prüfungen sind auf dem dokumentierten Stand erfolgreich. Es wurde kein Produktionssystem geändert und kein Deployment ausgelöst.

- Repository: `Dridi06/PFSS`
- Branch: `feature/pfss-complete-platform-build`
- Implementierungsstand: `cfb15de3bcd0a160fa89f21396a56c761b04b6b8`
- CI Push: Run [43784176407](https://github.com/Dridi06/PFSS/actions/runs/43784176407) – erfolgreich
- CI Pull Request: Run [43784181983](https://github.com/Dridi06/PFSS/actions/runs/43784181983) – erfolgreich
- PR #1: offen, Draft, nicht gemergt

## Umgesetzte Funktionen

### Zentrale Rollenauflösung
Die neue Datei `pfms-role-workflows.js` enthält die zentrale Rollen- und Routenmatrix. Die Berechtigungssicht wird aus dem freigegebenen Profil, aktiven Organisationsmitgliedschaften und aktiven Teamzuweisungen abgeleitet. Der Rollenwert aus frei änderbaren Registrierungsmetadaten wird nicht als alleinige Berechtigungsquelle verwendet.

Erkannte Rollen und Kontexte:
- Plattformadministrator
- Vereinsleitung (Owner / Club Admin)
- Agenturleitung (Owner / Agency Admin)
- Vereinsscout
- Agenturscout
- Trainer
- Co-Trainer
- Betreuer
- Spieler-Mitglied

Die Startansicht und sichtbare Menüpunkte richten sich nach dem effektiven Kontext. Eine aktive Teamzuweisung ist Voraussetzung für den Team-Arbeitsbereich. Eine bloße Trainer-/Co-Trainer-/Betreuer-Kennzeichnung reicht dafür nicht aus. Gesperrte Mitgliedschaften oder Organisationen erhalten keine Leitungsrechte. Unbekannte Routen werden verweigert.

### Organisations- und Scout-Workflows
- Getrennte Vereins- und Agenturübersichten für tatsächliche Leitungsmitglieder.
- Agentur-Selbstverwaltungsbereich statt einer ausschließlich administrativen Platzhalterseite.
- Mitglieder-, Einladungs- und Scout-Aktionen werden je Organisation angeboten und bleiben durch bestehende serverseitige RPC-/RLS-Prüfungen geschützt.
- Scout-Auswahl merkt sich die aus der Organisationskarte geöffnete Organisation; unnötige doppelte Ladevorgänge wurden entfernt.
- Organisationsnavigation wird auch für berechtigte Agenturleitungen verfügbar gemacht.
- Agenturübersicht, Organisationsauswahl und Scout-Auswahl werden beim Kontowechsel/Logout zurückgesetzt, damit keine alten Organisationsdaten sichtbar bleiben.

### Authentifizierter Rollen-Kontext in Supabase
Neue additive Migration:
`supabase/migrations/20270101_pfms_authenticated_role_context.sql`

Die Funktion `pfms_get_my_role_context()` ist:
- `STABLE` und ausschließlich lesend,
- an `auth.uid()` gebunden,
- auf Profile mit Status `approved` begrenzt,
- auf eigene aktive Mitgliedschaften und aktive Teamzuweisungen begrenzt,
- mit leerem `search_path` und qualifizierten Objektnamen definiert,
- für `PUBLIC` und `anon` gesperrt und für `authenticated` freigegeben.

Die Teamzuweisungen erfordern zusätzlich eine aktive Mitgliedschaft in der zugehörigen Organisation. Die Funktion verändert keine Geschäftsdatensätze.

Der Frontend-Aufruf ist an Benutzer-ID und Auth-Generation gebunden, damit verspätete Antworten eines alten Kontos nicht den Rollen-Kontext eines neu angemeldeten Kontos überschreiben. Bei noch nicht installierter Migration greift ein protokollierter Kompatibilitätspfad auf die vorhandenen Rollen-/Team-RPCs zurück.

## Automatisierte Prüfungen

Für Commit `cfb15de3bcd0a160fa89f21396a56c761b04b6b8` sind beide CI-Läufe erfolgreich:

- Syntax- und Projekt-Smoke-Tests – erfolgreich
- Supabase-Edge-Function-Type-Check – erfolgreich
- Neue Rollenmatrix-Tests – erfolgreich
- Neue authenticated-role-context Vertragsprüfung – erfolgreich
- Bestehende Build-/Distribution-, Accessibility-, Design-System-, Auth-Session-, RPC-, Tenant-Isolation-, RLS-/Berechtigungs- und Migrations-Preflight-Tests – im Projekt-CI erfolgreich

Die Rollenmatrix prüft u. a. Vereins-/Agenturleitung, Scout/Agenturscout, Trainer/Co-Trainer/Betreuer, Spieler-Mitglied, Teamzuweisung, gesperrte Mitgliedschaft/Organisation, Multi-Organisation-Kontext, Administratorzugriff und unbekannte Routen.

## Reale Staging-Abnahme – ausdrücklich noch offen

Die Staging-Datenbank `oolvpbzbqiojioazsoun` wurde nur lesend geprüft. Dabei ergab sich:

- `pfms_get_my_role_context()` ist dort noch nicht installiert.
- `public.organizations`, `public.organization_memberships`, `public.pfms_legacy_team_staff`, `public.pfms_legacy_teams`, `public.pfms_legacy_team_players` und `public.pfms_global_players` sind dort aktuell nicht vorhanden.
- `auth.users` und `profiles` enthalten weiterhin jeweils nur den einen zuvor vorhandenen Datensatz.

Die Staging-Migrationshistorie war bereits zuvor nicht nachweisbar und die Repository-Migrationen weisen Versionspräfix-Kollisionen auf. Deshalb wurde die neue Migration nicht isoliert oder zusammen mit einem unklaren Altbestand eingespielt. Bestehende Staging-Nutzer und Daten wurden nicht verändert.

**Folge:** Die automatisierte Code-/Build-Prüfung ist bestanden. Ein echter Staging-Login- und Browser-End-to-End-Lauf für alle Rollen sowie die Laufzeitprüfung der neuen RPC-Migration sind noch nicht erfolgt. Dafür muss zuerst ein kontrollierter Staging-Schema-/Migration-Baseline-Plan hergestellt werden. Es wurden keine Test-Auth-Benutzer angelegt.

## Grenzen und weitere fachliche Abnahme

- Die Frontend-Routenmatrix ist keine Ersatz-Berechtigung: Datenzugriffe und Schreibvorgänge bleiben durch Datenbank-RLS und serverseitige RPCs zu schützen.
- Die Spielerrolle wird im Rollen-Kontext erkannt. Eine persönliche Verknüpfung eines Auth-Kontos mit genau einem Datensatz aus dem globalen Spielerkatalog ist im gegenwärtigen Schema noch nicht vorhanden; daher wird kein Zugriff auf den globalen Spielerkatalog für Spieler freigeschaltet.
- Echte Registrierungs-/Login- und Workflow-Abnahmen je Rolle sind erst nach dem Staging-Schemaabgleich und der sicheren Bereitstellung von Testkonten möglich.

## Unveränderte Sicherheitsgrenzen

- Keine Änderung an `main`, Produktions-Supabase oder produktivem Render.
- Kein Deployment.
- PR #1 bleibt Draft.
- Keine bestehende Staging-Identität oder Geschäftsdaten verändert.
- Keine Migrationen auf Verdacht eingespielt.

## Fortsetzung

Beim nächsten Arbeitsschritt zuerst den Staging-Migrations-/Schemaabgleich kontrolliert lösen und anschließend die reale Rollen-E2E-Abnahme vorbereiten. Erst danach sollte Schritt 1 als vollständig abgenommen gelten. Die Design-/UI-Politur bleibt Schritt 2.
