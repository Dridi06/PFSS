# Datenmodell – fachlicher Entwurf

**Wichtig:** Dies ist ein logischer Entwurf, keine ausführbare Migration. Vor Umsetzung sind bestehende Tabellen, Fremdschlüssel, Policies und Funktionen vollständig zu inventarisieren.

## Identitäts- und Organisationskern
- profiles: 1:1-Ergänzung zum Auth-Nutzer.
- organizations: Club- oder Agency-Mandant mit Typ und Status.
- organization_memberships: user_id, organization_id, role_id, status, joined_at.
- roles: definierte Rollen; keine alleinige Autorisierung durch frei änderbare Clientwerte.
- permissions: einzelne Fähigkeiten, die Rollen zugeordnet werden.
- organization_invitations: gehashter Einladungs-Token, Ablauf, Zielorganisation, erlaubte Rolle, Nutzungsstatus.

## Fußball-Fachdaten
- players: kanonischer Spieler-Stammdatensatz mit minimal erforderlichen Angaben.
- player_organization_links: Beziehung Spieler ↔ Organisation, Status, Zeitraum und Sichtbarkeitsregeln.
- teams: Organisation, Saison, Alters-/Leistungsklasse.
- team_memberships: Spieler ↔ Team mit Gültigkeitszeitraum und Status.
- staff_assignments: Trainer/Betreuer ↔ Team mit Funktion und Zeitraum.

## Scouting
- scouting_reports: Spieler, Autor, Organisation/privater Eigentümer, Beobachtungsdatum, Kriterien, Text und Sichtbarkeit.
- scout_assignments: Auftrag, zuständiger Scout, Zielspieler/Spiel, Termin, Status.
- shortlists und shortlist_items: persönliche oder organisationsbezogene Listen.
- player_media: Metadaten und private Storage-Referenz; keine öffentliche URL als Standard.

## Agency / CRM
- contacts: Kontakte mit Organisationsbezug.
- player_agency_relationships: Zuständigkeit und Status.
- opportunities: Transfer-/Vermittlungsvorgänge mit Pipeline-Stufe.
- tasks: Verantwortlicher, Frist, Status und Bezug zu Fachobjekt.
- activity_log: fachliche Aktivitäten, getrennt vom Sicherheits-Audit.

## Betrieb
- audit_log: Actor, Aktion, Zieltyp/-ID, Zeit, Metadaten ohne unnötige Geheimnisse.
- notifications: Empfänger, Typ, Payload-Minimum, gelesen am.
- data_export_jobs: angeforderte Exporte und Status, falls erforderlich.

## Schlüsselregeln
1. Organisationsdaten tragen einen organization_id-Bezug.
2. RLS prüft die aktive Mitgliedschaft und die konkrete Berechtigung.
3. Private Scout-Daten verwenden einen separaten Owner-/Privacy-Pfad und sind nicht automatisch für Organisationsadmins sichtbar.
4. Berichte dürfen nur auf Spieler verweisen, die der Autor im jeweiligen Kontext sehen darf.
5. Spieler- und Teamzuordnungen werden zeitlich historisiert.
6. Minderjährige erhalten restriktive Standard-Sichtbarkeit; unnötige Kontaktdaten werden vermieden.
7. Lösch- und Aufbewahrungsregeln werden je Datenkategorie definiert.
8. owner_id und organization_id dürfen nicht durch Client-Updates auf fremde Werte umgeschrieben werden.

## Offene Punkte
- Bestehende players, profiles, scouting_reports, audit_log und rechte vollständig abgleichen.
- Admin-Funktion is_admin() auf SECURITY DEFINER, search_path und Berechtigungen prüfen.
- Alle vorhandenen RLS-Policies auf Rekursion, Umgehbarkeit und Mandantentrennung prüfen.
- Entscheiden, ob Spieler-Stammdaten global oder organisationsgebunden angelegt werden dürfen.
