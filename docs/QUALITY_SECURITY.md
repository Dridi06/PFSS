# Qualität, Tests und Sicherheit

## Testpyramide
1. Statische Prüfung: HTML-Validierung, JavaScript-Syntax, CSS-/Asset-Referenzen.
2. Datenbanktests: Constraints, Fremdschlüssel, Trigger und Migrationen.
3. RLS-Tests: Nutzer A/B, Organisation X/Y, Admin, Scout privat, nicht angemeldeter Nutzer.
4. Funktionstests: Formulare, Filter, Navigation, CRUD, Fehlerzustände.
5. End-to-End: Registrierung, Einladung, Organisationswechsel, Scoutbericht, Club-Kader und Agency-Aufgabe.
6. Responsive/Accessibility: Mobil, Tablet, Desktop, Tastatur und Kontrast.

## Mindest-Sicherheitsmatrix
| Test | Erwartung |
|---|---|
| Nicht angemeldet liest geschützte Tabelle | verweigert |
| Nutzer A liest private Daten von Nutzer B | verweigert |
| Mitglied in Organisation X liest Daten aus Y | verweigert |
| Scout ändert globale Stammdaten | verweigert |
| Nutzer ändert eigene Rolle/organization_id im Browser | verweigert |
| Manipulierter Storage-Pfad zu fremdem Objekt | verweigert |
| Admin-Zugriff auf private Scoutnotizen | nur nach expliziter, dokumentierter Regel |
| Abgelaufener/verbrauchter Einladungscode | verweigert |
| Gelöschter Nutzer | definierte Lösch-/Anonymisierungsregeln greifen |

## Datenschutzgrundsätze
- Zweckbindung und Datenminimierung.
- Minderjährige besonders schützen.
- Keine sensiblen Daten ohne gesonderte Rechtsgrundlage, Schutzkonzept und Freigabe.
- Export-, Berichtigungs- und Löschprozesse definieren.
- Aufbewahrungsfristen und Verantwortlichkeiten dokumentieren.
- Auftragsverarbeitung und Hosting-Standort vor Produktion prüfen.

## Release-Checkliste
- [ ] Migrationen versioniert und auf Testbasis erfolgreich
- [ ] RLS-Tests mit mindestens zwei getrennten Nutzern/Organisationen bestanden
- [ ] Keine Secrets im Repository oder Client-Bundle
- [ ] Fehler- und Berechtigungszustände verständlich
- [ ] Mobile Prüfung abgeschlossen
- [ ] Backup und Wiederherstellung praktisch getestet
- [ ] Kostenlimits und Speichergrenzen geprüft
- [ ] Datenschutztexte und rechtliche Verantwortlichkeiten geprüft
- [ ] Rollback-/Notfallplan dokumentiert
