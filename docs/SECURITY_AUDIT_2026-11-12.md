# PFSS – Sicherheits-Bestandsaufnahme

Stand: 12.11.2026
Basis: GitHub-Branch `main`, statische Quelltextprüfung. Die produktive Supabase-Datenbank wurde noch nicht direkt ausgelesen.

## Zweck und Grenzen

Diese Bestandsaufnahme dokumentiert sichtbare Befunde aus dem Repository. Sie ist kein Penetrationstest und keine Bestätigung, dass die Live-Datenbank dieselben Migrationen bereits ausgeführt hat. Es wurden keine produktiven Daten oder Einstellungen verändert.

## Bereits vorhandene Bausteine

- Supabase Auth mit E-Mail-/Passwort-Anmeldung.
- Benutzername-Anmeldung über die Edge Function `username-login`.
- Passwort-Wiederherstellung und Passwortänderung.
- Profilstatusprüfung über `profiles.status`; nur `approved` gelangt in die Anwendung.
- Benutzername-Synchronisierung aus Auth-Metadaten.
- Organisationsmitgliedschaften und Einladungen mit gehashtem Einmal-Code.
- Admin-RPC-Funktionen mit serverseitiger Admin-Prüfung.
- Private Scout-Workspace-Migration als Entwurf im Repository.

## Festgestellte Risiken und offene Prüfungen

### S1 – Mehrere konkurrierende Organisationsmodelle

Im Repository existieren sowohl `organizations` / `organization_memberships` als auch zusätzliche Tabellen `pfms_organizations` / `pfms_memberships`. Parallel existieren `profiles.role` und organisationsbezogene Rollen.

**Risiko:** Uneinheitliche Berechtigungsentscheidungen, doppelte Identitäten und versehentliche Zugriffsfreigaben.

**Maßnahme:** Vor neuen Tabellen ein kanonisches Modell festlegen. Bestehende produktive Tabellen und Daten nicht löschen oder automatisch migrieren. Erst nach Schema-Inventar und Datenabgleich eine kontrollierte Konsolidierung planen.

### S1 – Signup-Trigger und Einladung müssen gemeinsam getestet werden

Die Migration zur Benutzername-Synchronisierung und die Einladungs-Migration hängen beide an `auth.users`. Die Einladungsfunktion erstellt eine Mitgliedschaft und setzt das Profil auf `approved`.

**Risiko:** Trigger-Reihenfolge, E-Mail-Bestätigung, Rollenzuordnung und Fehler-Rollback können voneinander abhängen.

**Maßnahme:** Trigger-Reihenfolge und tatsächliche Live-Definitionen auslesen. Testfälle für bestätigte und unbestätigte E-Mail-Adressen, ungültige/abgelaufene/widerrufene/einmal verwendete Einladungen und wiederholte Requests definieren. Einladung darf keine privilegierte Rolle vergeben.

### S1 – Scout-Migration benötigt Korrektur vor Ausführung

`20261112_private_scout_workspaces.sql` verwendet `public.is_admin()`, ohne dass diese Funktion in dieser Migration abgesichert oder ihre konkrete Definition geprüft wird. Die UPDATE-Policy für Berichte muss außerdem auf eindeutige Klammerung und unveränderliche Eigentümerschaft geprüft werden. Die Storage-Policies haben unterschiedliche Admin-Regeln.

**Risiko:** Migration kann scheitern oder Admin-/Eigentümerzugriffe inkonsistent behandeln.

**Maßnahme:** Nicht unverändert ausführen. Admin-Helferfunktion und Policies gegen das Live-Schema prüfen; Eigentümerfelder gegen Manipulation schützen; Storage-Lesen, Schreiben, Aktualisieren und Löschen konsistent regeln.

### S1 – Username-Login Edge Function

`supabase/functions/username-login/index.ts` nutzt serverseitig einen Secret Key, um den Benutzernamen aufzulösen und anschließend einen normalen Passwort-Login auszuführen. Die Antwort enthält Sitzungstokens. CORS ist auf `*` gesetzt; eine eigene Rate-Limit-Prüfung und eine Request-Body-Größenbegrenzung sind im Quelltext nicht erkennbar.

**Risiko:** Erhöhte Missbrauchsfläche für automatisierte Login-Versuche und unnötig breite Browser-Freigabe. CORS allein ist keine Authentifizierung und kein Schutz gegen Bots.

**Maßnahme:** Origin-Allowlist für die tatsächlich verwendeten PFSS-Domains, Request-Größenlimit, strikte JSON-/Typvalidierung, Rate-Limits nach IP und normalisiertem Benutzernamen über einen geeigneten serverseitigen Mechanismus, generische Fehlermeldungen und sichere Logs. Secret Key bleibt ausschließlich in Supabase Function Secrets.

### S2 – R2-Verbindungstest

`r2-connection-check` akzeptiert laut Methodenkontrolle GET und POST und hat ebenfalls `Access-Control-Allow-Origin: *`. Im Quelltext ist keine Benutzer- oder Admin-Authentifizierung vorgeschaltet.

**Risiko:** Unbefugte können den Status des internen R2-Zugangs abfragen; die Funktion ist nicht als öffentliches Diagnose-API geeignet.

**Maßnahme:** Auf Admin-/Service-Authentifizierung umstellen, nur notwendige Methode erlauben, Origin-Allowlist und Rate-Limit ergänzen. Keine Provider-Details oder Secrets ausgeben.

### S2 – Clientseitige Berechtigungsdarstellung

Das Frontend blendet Navigationspunkte anhand von `profiles.role` aus. Das ist nur Darstellung und darf niemals die eigentliche Zugriffskontrolle ersetzen.

**Maßnahme:** Jede Datenabfrage, RPC und Storage-Aktion muss serverseitig und durch RLS/Policies autorisiert werden. Negativtests mit fremden Benutzer- und Organisations-IDs sind Pflicht.

### S2 – Lokale Datenhaltung und Demo-Workspace

`app.js` speichert Spieler und Berichte in `localStorage`; `scout-workspace.js` bezeichnet sich selbst als grafische Vorschau ohne Datenbankanbindung.

**Risiko:** Lokale Daten sind nicht zentral geschützt, synchronisiert oder organisationsübergreifend kontrolliert. Demo-Daten dürfen nicht als echte Daten erscheinen.

**Maßnahme:** Datenbankanbindung schrittweise einführen, Datenmigration/Export planen, Demo-Kennzeichnung beibehalten, bis echte Datenquelle getestet ist.

### S2 – Frontend-Abhängigkeiten und HTML

`index.html` lädt Supabase JS über ein CDN ohne sichtbare Subresource-Integrity-Angabe. In den HTML-Referenzen sind wörtliche `\\n`-Sequenzen vorhanden, die bereinigt werden müssen.

**Maßnahme:** Abhängigkeit pinnen und Integritäts-/CSP-Strategie prüfen; HTML-Referenzen korrigieren und automatisiert validieren.

## Architekturentscheidungen für die Umsetzung

1. Supabase Auth bleibt die einzige Identitäts- und Sitzungsquelle.
2. Benutzerprofil (`profiles`), Spielerprofil (`players`) und Organisationsmitgliedschaft bleiben getrennte Konzepte.
3. Ein Spieler kann ohne Login als Vereinsdatensatz existieren; ein Benutzerkonto wird optional sicher mit genau dem Spielerprofil verknüpft.
4. Organisationen und Mandantentrennung werden zentral modelliert. Keine parallelen Rollenwahrheiten.
5. Einladungen sind einmalig, gehasht, zeitlich begrenzt, widerrufbar und rollenbeschränkt.
6. Rollen und Berechtigungen werden ausschließlich serverseitig geprüft.
7. Minderjährige Spieler erhalten restriktive Standardfreigaben und besondere Datenschutz-/Löschregeln.
8. Keine Service-/Secret Keys im Browser, GitHub, Logs oder Fehlermeldungen.
9. Jede Migration ist versioniert, überprüfbar, möglichst additiv und mit Rollback-/Wiederherstellungsplan.
10. Vor Produktion: negative RLS-/API-Tests, Abhängigkeitsprüfung, Auth-Tests, Backup- und Restore-Test.

## Noch benötigte Live-Daten

Die folgenden Punkte können aus GitHub allein nicht verifiziert werden: tatsächlich ausgeführte Migrationen, aktuelle Tabellen-/Spaltenstruktur, RLS-Status, Policies, Grants, Trigger-Reihenfolge, Funktionsdefinitionen, Storage-Buckets/-Policies, Auth-Provider-Einstellungen, Rate-Limits und vorhandene Daten.

Dafür dient `supabase/preflight/00_schema_security_inventory.sql`. Das Skript liest Metadaten und verändert keine Daten oder Einstellungen.

## Freigaberegel

Keine Migration wird automatisch in der produktiven Supabase-Datenbank ausgeführt. Erst nach Live-Inventar, Review, Test auf einer getrennten Testumgebung und ausdrücklicher Freigabe.
