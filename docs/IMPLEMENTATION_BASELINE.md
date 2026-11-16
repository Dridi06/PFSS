# PFMS – Implementierungs-Baseline und Arbeitsplan

Stand: 14.11.2026 – nach Umsetzung des persistenten PFMS-Katalogs, der privaten Hauptmedien und der Konto-Isolation
Arbeitsbranch: feature/pfss-complete-platform-build
Basisbranch: main
Produktionsumgebung: unverändert; kein Deployment durch diesen Arbeitsschritt.

## 1. Verbindliche Produktvorgaben

Dieses Dokument setzt das PFMS-Gesamtkonzept Version 1.0 (13.11.2026) und die ergänzten Produktentscheidungen um:
- Bestehende Navigationsstruktur und Reihenfolge als Ausgangspunkt erhalten.
- Premium-Markenbild: Schwarz, Anthrazit und Gold mit zurückhaltenden Fußball-/Stadiondetails.
- Login und Registrierung professionell und responsiv überarbeiten.
- Modularer, individuell erweiterbarer Aufbau; neue Module verwenden gemeinsame Identitäts-, Organisations- und Berechtigungsdienste.
- Mobile und Desktop gleichwertig unterstützen.
- Keine Demo-/Platzhalterfunktion als fertig ausweisen.
- Entwicklung und Tests zuerst in einer getrennten Staging-Umgebung; Produktion erst nach dokumentierter Abnahme und ausdrücklicher Freigabe.

## 2. Repository-Baseline

Beim ersten Read-only-Inventar des GitHub-Repositories Dridi06/PFSS wurde festgestellt:
- Das Frontend liegt derzeit im Wesentlichen als statische HTML-, CSS- und JavaScript-Anwendung vor.
- Zentrale Dateien sind index.html, app.js, styles.css, scout-workspace.js und scout-workspace.css.
- Supabase wird im Browser über die veröffentlichbare Client-Konfiguration eingebunden; die Username-Login-Edge-Function verwendet serverseitige Laufzeit-Secrets.
- Es existieren mehrere SQL-Migrationen für Organisationen, Mitgliedschaften, Rollen-/Adminfunktionen, Einladungen und private Scout-Arbeitsbereiche.
- Der ursprüngliche Baseline-Befund zu `localStorage` ist inzwischen überholt: Die Haupt-Spielerdatenbank und Haupt-Scoutingberichte verwenden im Feature-Branch `pfms_global_players` und `pfms_main_scouting_reports` mit serverseitiger RLS. Lokale Altbestände werden nur nach ausdrücklicher Admin-Bestätigung über eine transaktionale Import-RPC übernommen. Der private Scout-Bereich und die Haupt-Medienbibliothek verwenden separate, benutzergebundene Supabase-Datenmodelle und private Storage-Pfade. Diese Änderungen sind im Repository und in CI geprüft, aber noch nicht in der externen Staging-Datenbank abgenommen.
- Der vorhandene Code enthält bereits Login per E-Mail oder Benutzername, Passwort-Reset, Registrierungsabläufe und mehrere vorbereitete Ansichten.
- Im HTML sind noch uneinheitliche Produktbezeichnungen PFMS/PFSS wurden im Bestand vorgefunden; die sichtbare Marke wird auf PFMS vereinheitlicht. Produktname, Seitentitel, Logo-Alttexte und sichtbare Texte müssen konsistent auf die freigegebene Marke gebracht werden.
- Die bestehende Datenbankhistorie enthält parallel gewachsene Namensräume/Modelle. Vor neuen Fachmodulen ist das kanonische Datenmodell festzulegen.

Diese Befunde sind eine erste Repository-Sichtung, keine vollständige Funktions-, Sicherheits- oder Datenbankabnahme.

## 3. Architekturprinzipien

1. Zentrale Authentifizierung und Profilidentität.
2. Organisation-/Mandantenkontext wird bei jeder geschützten Operation serverseitig geprüft.
3. Least Privilege: Rollen und Einzelberechtigungen werden nicht aus frei manipulierbaren Client-Metadaten abgeleitet.
4. RLS und serverseitige Autorisierung schützen Daten unabhängig von der Sichtbarkeit der Navigation.
5. Fachmodule verwenden gemeinsame Plattformdienste statt eigener, voneinander abweichender Rollenlogik.
6. Konfigurierbare Felder/Skalen werden kontrolliert und typisiert modelliert; beliebige unvalidierte JSON-Felder sind kein Ersatz für ein Datenmodell.
7. Migrationen sind versioniert, überprüfbar und mit Rollback-/Wiederherstellungsweg versehen.
8. Keine Secrets in Browsercode, Repository oder öffentlich ausgelieferten Dateien.

## 4. Umsetzungsphasen und Quality Gates

### Phase 0 – Bestandsaufnahme und Stabilisierung
- Vollständiges Inventar aller Dateien, Views, Eventhandler, Tabellen, Policies, RPCs, Edge Functions und Storage-Buckets.
- Development/Staging/Production eindeutig zuordnen und Konfigurationen trennen.
- Kanonisches Datenmodell und Migrationsstrategie beschließen.
- Testgerüst und reproduzierbare Staging-Baseline herstellen.
Gate 0: Bestandsaufnahme, Datenmodellentscheidung, Umgebungsübersicht und Testplan dokumentiert.

### Phase 1 – Foundation
- Profile, Organisationen, Mitgliedschaften, Einladungen, Rollen und Einzelberechtigungen.
- Audit-Protokoll und Organisationskontext.
- Widerruf, Sperrung, Rollenwechsel und Einladungsablauf.
- Positive und negative Mandantentests.
Gate 1: Ende-zu-Ende-Tests für Organisation, Einladung, Mitgliedschaft, Rollenwechsel und Widerruf bestanden; RLS-/Negativtests nachgewiesen.

### Phase 2 – Core Football und Scouting
- Mannschaften und Staff mit zeitlich begrenzten Zuordnungen.
- Spieler-Stammdaten und Historisierung.
- Mehrere unveränderlich nachvollziehbare Scouting-Beobachtungen pro Spieler.
- Bewertungsskalen, Shortlists und sichere Medienzuordnung.
Gate 2: Fachliche Abnahme und Mandantentests für Spieler, Mannschaften, Berichte und Medien bestanden.

### Phase 3 – Operations und Business
- Kalender, Aufgaben und systeminterne Benachrichtigungen.
- Finanzübersichten und Freigaben; ausdrücklich kein Ersatz für Buchhaltung/Steuerberatung.
- Export-, Reporting- und Integrationsgrundlagen.
Gate 3: Workflows, Rollen, Datenintegrität und Exporte getestet.

### Phase 4 – Pilot und Produktionsfreigabe
- Pilotfeedback, Performance- und Lasttests.
- Datenschutz-/Rechtsprüfung anhand tatsächlicher Datenflüsse.
- Backup-/Restore in isolierter Umgebung.
- Monitoring, Incident-Prozess, Betriebshandbuch, Rollback-Plan.
- Formale Go-live-Entscheidung.
Gate 4: Kein kritischer Fehler offen; Abnahmeprotokoll und ausdrückliche Produktionsfreigabe liegen vor.

## 5. Erste technische Risiken / offene Prüfungen

- Die lokale Browser-Datenhaltung für Spieler/Berichte muss durch organisations- bzw. eigentümergebundene Datenbankzugriffe ersetzt oder als ausdrücklich lokaler Entwurfsmodus isoliert werden.
- Historische und neue Tabellen-/Funktionsnamen dürfen nicht parallel unkontrolliert weiterwachsen.
- RLS-Policies, Grants, Security-Definer-Funktionen und Storage-Policies müssen vollständig inventarisiert und mit Angriffs-/Negativtests geprüft werden.
- Die Login-Edge-Function hat aktuell permissive CORS-Antworten; zulässige Origins, Rate Limits und Missbrauchsschutz sind zu überprüfen.
- Registrierung, Tarifdarstellung und Trial-Texte sind nicht mit echter Abrechnung gleichzusetzen. Zahlungsabwicklung bleibt deaktiviert, bis Anbieter, rechtliche Angaben und serverseitige Webhook-Verarbeitung umgesetzt und getestet sind.
- Vorhandene SQL-Migrationen werden nicht blind erneut auf eine Datenbank angewandt. Zuerst wird der tatsächliche Staging-Schema-Stand ermittelt.

## 6. Testprinzip

Jede Funktion benötigt fachliche Akzeptanzkriterien, positive Tests, negative Berechtigungs-/Mandantentests, Validierungs- und Fehlerfalltests, mobile und Desktop-Prüfung sowie ein dokumentiertes Ergebnis.
Ein Menüpunkt, eine Vorschau oder ein erfolgreicher Seitenaufruf ist allein kein Funktionsnachweis.

## 7. Änderungs- und Freigaberegel

Alle Arbeiten erfolgen zunächst auf dem Feature-Branch. Kein direkter Eingriff in main, keine Änderung an produktiven Daten und kein Live-Deployment ohne gesonderte Prüfung und Freigabe. Zugangsdaten/Secrets werden niemals im Chat oder in Commit-Dateien abgelegt.