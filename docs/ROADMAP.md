# Roadmap und Meilensteine

Die Zeitplanung ist ein Arbeitskorridor, keine Lieferzusage. Die Dauer hängt von verfügbarer gemeinsamer Arbeitszeit, Bestandsschäden und Supabase-Prüfungen ab.

| Phase | Ziel | Ergebnis / Gate |
|---|---|---|
| 0 – Bestandsaufnahme | Code, DB, RLS, Hosting und UX inventarisieren | dokumentierter Ist-Zustand, keine ungeprüften Änderungen |
| 1 – Plattformfundament | Auth, Profile, Organisationen, Memberships, Rollen | Tenant-/Permission-Modell abgenommen |
| 2 – Scout MVP | privater Scoutbereich, Suche, Profile, Reports | RLS-Tests bestanden, keine Demo-Daten im Produktivpfad |
| 3 – Club MVP | Vereine, Teams, Kader, Staff, Einladungen | Organisationsgrenzen nachgewiesen |
| 4 – Agency MVP | Agenturteam, Portfolio, Kontakte, Tasks, Pipeline | Zugriff und Datenbeziehungen getestet |
| 5 – Gemeinsame Dienste | Aufgaben, Kalender, Benachrichtigungen, Audit | nachvollziehbare Workflows |
| 6 – Medien und Analyse | private Medien, Uploadregeln, Analysewerkzeuge | Storage-Policies und Kostenlimits geprüft |
| 7 – Produktionsreife | Datenschutz, Backups, Monitoring, Last-/Sicherheitstests | Release-Freigabe und Wiederherstellungstest |

## Gate-Regel
Keine Phase gilt als abgeschlossen, nur weil die Oberfläche sichtbar ist. Erforderlich sind Datenbankanbindung, Berechtigungstests, Fehlerzustände, mobile Prüfung und dokumentierte Abnahme.

## Fortschrittsmessung
- 0%: nicht begonnen
- 25%: Konzept/UX festgelegt
- 50%: implementiert, noch nicht vollständig integriert
- 75%: integriert, Tests/Fehlerbehebung offen
- 100%: Abnahmekriterien erfüllt

Ein sichtbarer Prototyp zählt nicht als 100% fertige Funktion.
