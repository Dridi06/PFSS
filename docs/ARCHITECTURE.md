# Zielarchitektur

## Leitbild
Modularer Monolith mit klaren Fachmodulen und einer gemeinsamen, zentralen Daten- und Identitätsschicht. Erst wenn Skalierung oder Teamorganisation es erfordern, werden einzelne Dienste ausgelagert.

## Zielschichten
1. Presentation: responsive Weboberfläche, Navigation, Formulare, Tabellen, Karten und Dialoge.
2. Application: fachliche Anwendungsfälle, Validierung, Berechtigungsprüfung und Workflows.
3. Domain: Nutzer, Organisationen, Mitgliedschaften, Spieler, Mannschaften, Berichte, Aufgaben und Vorgänge.
4. Data: PostgreSQL/Supabase, versionierte Migrationen, Indizes, Constraints und Row Level Security.
5. Storage: private Medienobjekte mit nicht erratbaren Pfaden und zeitlich begrenzten Zugriffen.
6. Operations: Protokollierung, Backups, Monitoring, Deployment und Wiederherstellungsabläufe.

## Bestehender Bestand – bekannte Hinweise
- Das Repository verwendet aktuell eine statische Weboberfläche mit JavaScript.
- Supabase JS v2 wird im HTML eingebunden.
- app.js hält Spieler und Berichte teilweise in localStorage; das ist keine organisationsübergreifende persistente Datenbasis.
- Es existiert eine Scout-Migrationsdatei unter supabase/migrations/20261112_private_scout_workspaces.sql. Sie wurde laut Projektstand noch nicht in Supabase ausgeführt.
- Die Scout-Oberfläche ist derzeit eine grafische Vorschau mit Beispieldaten, keine bestätigte produktive Datenanbindung.
- index.html enthält in den Script-/Stylesheet-Zeilen sichtbare literale Backslash-n-Sequenzen. Vor weiteren UI-Erweiterungen ist der tatsächliche HTML-Inhalt zu bereinigen und zu testen.
- Die Variable pfssSupabase ist in app.js als const angelegt. Ein Zugriff über window.pfssSupabase ist damit nicht automatisch gegeben.

## Architekturregeln
- Kein Vertrauen auf im Browser versteckte Buttons oder Rollenwerte: jede Datenoperation wird serverseitig/RLS-seitig geschützt.
- Keine direkte Änderung globaler Spieler-Stammdaten durch private Scouts.
- Organisationszugehörigkeit immer über Membership-Datensätze und aktive Organisation.
- Jede Tabelle mit Organisationsdaten erhält eine klare Tenant-Strategie.
- Fremdschlüssel, eindeutige Constraints und Datenbank-Checks sichern Datenintegrität.
- Migrationen sind vorwärtsgerichtet, nachvollziehbar und auf einer Testumgebung zu prüfen.
- Secrets gehören ausschließlich in geschützte Umgebungsvariablen.
- Keine kostenpflichtige Infrastruktur ohne Freigabe.

## Vorgeschlagene Repository-Struktur (schrittweise, nicht sofortige Umstellung)
    /
      index.html
      app.js
      styles.css
      modules/ (auth, dashboard, scout, club, agency, admin)
      shared/ (api, components, permissions, validation)
      supabase/ (migrations, seed, tests)
      docs/

Eine Umstrukturierung erfolgt erst nach Bestandsaufnahme und mit kleinen, überprüfbaren Schritten.
