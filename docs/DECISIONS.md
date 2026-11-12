# Architekturentscheidungen – Register

| ID | Thema | Status | Entscheidung / nächster Schritt |
|---|---|---|---|
| ADR-001 | Architekturform | Vorschlag | Modularer Monolith; keine Microservices im MVP |
| ADR-002 | Datenbank | Bestand | Supabase/PostgreSQL bleibt vorerst bestehen; Schema/RLS vollständig prüfen |
| ADR-003 | Spieleridentität | Offen | globaler kanonischer Spieler vs. organisationsgebundene Profile fachlich entscheiden |
| ADR-004 | Scout-Privatsphäre | Vorschlag | private Scoutnotizen sind standardmäßig nur für Eigentümer sichtbar |
| ADR-005 | Organisationsmodell | Vorschlag | Memberships verbinden Nutzer mit Clubs/Agencies; aktive Organisation im Kontext |
| ADR-006 | Medien | Offen | Bucket, Limits, Retention und Kostenobergrenzen vor Aktivierung freigeben |
| ADR-007 | Abrechnung | Zurückgestellt | keine Zahlungsabwicklung im Entwicklungs-MVP |
| ADR-008 | Externe Fußballdaten | Zurückgestellt | Anbieter, Lizenz, Kosten und Nutzungsrechte gesondert prüfen |

## Freigabepflichtige Entscheidungen
- Produktionsmigrationen oder Löschungen
- Änderungen an Auth, Rollen, RLS oder Storage-Berechtigungen
- Zusammenführung oder Veröffentlichung privater Scout-/Spielerdaten
- kostenpflichtige Dienste und Tarifwechsel
- Aktivierung von Zahlungsabwicklung oder externen Datenlizenzen
