# PFMS – Verbindlicher Projektstatus

Stand: 14.11.2026  
Arbeitsbranch: `feature/pfss-complete-platform-build`  
Produktivbranch: `main`  
Produktionsfreigabe: **nicht erteilt**  
Grundsatz: Alle Implementierungen und Tests laufen zunächst ausschließlich im Entwicklungszweig bzw. in einer getrennten Testumgebung.

## 1. Gesamtbefund

Der vorhandene Stand ist ein umfangreicher statischer Frontend-Prototyp mit Supabase-Authentifizierung und mehreren Datenbankmigrationen. Er ist noch kein durchgehend integriertes Fußballmanagementsystem.

Die Repository-Bestandsaufnahme umfasst aktuell 33 Einträge einschließlich Verzeichnissen. Es gibt derzeit keine erkennbare Projekt-/Build-Konfiguration (`package.json`), kein automatisiertes Anwendungstest-Verzeichnis, keine zentrale CI-Qualitätsprüfung und keine im Repository abgelegte Render-/Container-Konfiguration. Die tatsächliche Render-Service-Konfiguration muss im Render-Konto geprüft werden.

## 2. Vorhandene technische Bausteine

### Frontend und Oberfläche
- `index.html`: Hauptanwendung mit ca. 18 Hauptansichten und 141 DOM-IDs.
- `app.js`: zentrale Anwendungslogik, Navigation, Authentifizierung, Dashboard, lokale Spieler-/Berichtsfunktionen und Administrator-RPCs.
- `styles.css`, `scout-workspace.css`: Designbasis.
- `scout-workspace.js`: separater Scout-Bereich; derzeit eine grafische Vorschau mit Beispieldaten, ohne Datenbankanbindung.
- `rechtliches.html`: Rechts-/Informationsseite; Impressum, Kontakt und weitere Angaben sind ausdrücklich noch nicht veröffentlichungsfertig.

### Authentifizierung und Benutzer
- Supabase Auth über den Browser-Client.
- Anmeldung per E-Mail oder Benutzername; Benutzername wird über die Edge Function `username-login` aufgelöst.
- Passwort-Wiederherstellung und Registrierung sind im Frontend vorhanden.
- Profile werden aus `public.profiles` geladen.
- Administrator-Benutzerverwaltung nutzt `pfss_admin_list_profiles` und `pfss_admin_update_profile`.
- Sitzungs-Persistenz ist explizit konfiguriert.
- Regulärer Seiten-Reload zeigt nach dem letzten Fix nicht mehr die 4,5-Sekunden-Willkommenssequenz; die Wiederherstellung muss noch im Browser getestet werden.

### Datenbank und Edge Functions
Vorhandene Migrationen betreffen:
- Admin-Kontrollfunktionen und Benutzername-Registrierung.
- Bestehende Organisationsverwaltung und Mitgliedschafts-Einladungen.
- Ein zusätzliches neues Organisations-/Mitgliedschaftsmodell.
- Private Scout-Spieler, Berichte, Medien und einen privaten Storage-Bucket.
- Edge Functions: `username-login`, `r2-connection-check`.

### Sicherung
- GitHub-Actions-Workflow für verschlüsselte Datenbank-Backups nach Cloudflare R2 ist vorhanden.
- Die tatsächliche Ausführung hängt von korrekt gesetzten Repository-Secrets sowie einem erfolgreichen Restore-Test ab.

## 3. Verifiziert offene bzw. unvollständige Bereiche

| Bereich | Tatsächlicher Stand | Nächster Nachweis |
|---|---|---|
| Haupt-Spielerdatenbank | Daten in `localStorage` (`pfss_players_v1`) | Supabase-Persistenz, Mandantenzuordnung, CRUD-Tests |
| Haupt-Scoutingberichte | Daten in `localStorage` (`pfss_reports_v1`) | Persistente Datenbank, Beziehungen, CRUD-Tests |
| Haupt-Medienbereich | Objekt-URLs nur im aktuellen Browserfenster | Privater Upload, Metadaten, signierte Abrufe, Löschen |
| Scout-Arbeitsbereich | Beispieldaten und Vorschau | Anbindung an private Scout-Tabellen und Storage |
| Vereine/Agenturen | Ansichten und Admin-RPCs teilweise vorhanden | Besitzer-/Leitungsworkflows, Einladungen, Mitgliederverwaltung |
| Mannschaften/Staff | Teile der Oberfläche, überwiegend Platzhalter | Tabellen, Zuweisungen, Rollen und vollständige Workflows |
| Trainer-/Team-Workspace | Geplante Modulübersicht | Kader, Training, Anwesenheit, Spiele und Rechte |
| Vereinsmitgliedschaften | Teilweise Oberflächen und ältere Datenbankfunktionen | Aufnahme, Beiträge, Status, Kündigung/Wechsel und Rechte |
| Vereins-Scouting | Übersicht/Oberfläche | Scout-Zuordnung, Beobachtungsgebiete, Freigaben |
| Administration | Benutzerverwaltung und Organisationssuch-RPCs teilweise vorhanden | vollständige Verwaltung, Audit, Sperren, Fehler-/Supportprozesse |
| Zahlungen | Vorschau; kein Zahlungsanbieter | Anbieterentscheidung, Webhooks, Steuer-/Rechtsprüfung |
| Kalender/Aufgaben/Nachrichten | nur geplant bzw. Platzhalter | Datenmodell, Rollen, Benachrichtigungslogik |
| Sicherheit | einige RLS-Policies und Security-Definer-Funktionen | vollständige Policy-/Grant-/Storage-/Negativtests |
| Backup | Workflow vorhanden | Secret-Prüfung und Restore-Probe |
| Render | Service nicht abschließend verifiziert | korrekter Static-Site-/Web-Service-Typ, Build/Start, Health-Test |
| Qualitätssicherung | kein automatisiertes Frontend-Testgerüst | Syntax-, UI-, Integrations- und Mandantentests |

## 4. Architekturentscheidungen, die vor weiteren Fachmodulen nötig sind

### 4.1 Ein kanonisches Organisationsmodell

Die Migrationen zeigen zwei Modelle:
- ältere, von vorhandenen Anwendungs-RPCs verwendete Tabellen `organizations` und `organization_memberships`;
- neuere Tabellen `pfms_organizations`, `pfms_memberships` und `pfms_scout_profiles`.

Die Admin-Oberfläche nutzt aktuell RPCs auf dem älteren Modell; die neuere Migration erzeugt ein separates Modell. Vor weiteren Modulen muss anhand des tatsächlichen Staging-Schemas und der bestehenden Testdaten festgelegt werden, welches Modell kanonisch ist. Keine automatische Datenmigration und kein Löschen ohne Schema-Audit und Backup.

### 4.2 Datenhoheit und Rollen

- Rollen und Mitgliedschaftsrechte müssen serverseitig geprüft werden.
- Client-Metadaten dürfen keine administrativen Rechte vergeben.
- Jede Organisationsressource erhält eine eindeutige Organisationszuordnung.
- Private Scout-Daten bleiben strikt eigentümergebunden, sofern keine explizite Freigabe erfolgt.
- Owner-Erstregistrierung und Besitzübertragung benötigen einen sicheren, einmaligen Claim-/Provisioning-Prozess.

### 4.3 Integrationen und Sicherheit

- `username-login` verwendet aktuell permissive CORS-Antworten (`*`) und weist in der eingesehenen Funktion kein eigenes Rate-Limit auf.
- RLS, Grants, Security-Definer-Funktionen und Storage-Policies müssen im tatsächlichen Datenbankzustand geprüft werden.
- Für Medien werden private Storage-Objekte und kurzlebige signierte URLs benötigt.
- Zahlungsfunktionen bleiben deaktiviert, bis Provider, Webhooks und die rechtlichen Voraussetzungen umgesetzt und getestet sind.

## 5. Entwicklungsreihenfolge und Abnahmekriterien

1. **Stabilisierung und Qualitätsbasis:** Branch-/Umgebungsinventar, Reproduzierbarkeit, Syntaxprüfung, automatisierte Smoke-Tests, Render-Testumgebung.
2. **Identität und Organisation:** Profil, sicherer Owner-Claim, ein Organisationsmodell, Mitgliedschaften, Rollen, Rechte, Einladungen, Audit.
3. **Fußball-Stammdaten:** Vereine/Agenturen, Mannschaften, Staff, Spielerprofile und Historie.
4. **Scouting:** private Scout-Daten, organisationsbezogene Berichte, Bewertungsskalen, Shortlists, Medien und Freigaben.
5. **Betrieb:** Training, Anwesenheit, Spiele, Kalender, Aufgaben, Kommunikation, Finanzen und Exporte.
6. **Geschäft und Betrieb:** Abos/Zahlungen, Monitoring, Backups/Restore, Datenschutz-/Rechtsprüfung und Produktionsfreigabe.

Ein Modul ist erst fertig, wenn Oberfläche, Datenbank, serverseitige Rechte, Fehlerfälle, Tests und Dokumentation zusammen funktionieren. Ein Platzhalter, Menüpunkt oder erfolgreicher Seitenaufruf zählt nicht als Funktionsnachweis.

## 6. Aktueller Änderungsstand

Auf dem Feature-Branch wurden zuletzt:
- PFMS-Markenangaben in mehreren sichtbaren Bereichen vereinheitlicht;
- Supabase-Sitzungspersistenz explizit konfiguriert;
- die Willkommensanimation beim normalen Reload übersprungen;
- ein sichtbarer Schreibfehler in der Sidebar-Markenbezeichnung korrigiert;
- die Scout-Workspace-Kurzmarke auf PFMS umgestellt.

Diese Änderungen sind noch nicht im Produktivbranch und wurden noch nicht im echten Browser bzw. in Render-End-to-End getestet.

## 7. Änderungsregeln

- Keine direkte Änderung an `main` oder produktiven Daten.
- Vor einer SQL-Migration: tatsächliches Staging-Schema, bestehende Policies und Daten prüfen.
- Keine Secrets im Repository oder Chat.
- Änderungen klein genug halten, dass Ursache und Wirkung nachvollziehbar bleiben.
- Jede Funktion nach Fertigstellung mit positiven und negativen Tests belegen.
- Produktionsdeployment nur nach dokumentierter Abnahme und ausdrücklicher Freigabe.
