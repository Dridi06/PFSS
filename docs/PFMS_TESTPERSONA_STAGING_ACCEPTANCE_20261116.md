# PFMS – Testpersona-Staging-Abnahme (16.11.2026)

## Ziel und Sicherheitsrahmen
- Zielsystem: Supabase-Staging-Projekt `oolvpbzbqiojioazsoun` (PFFS-Test).
- Ausschließlich lesende Abfragen; keine Auth-Benutzer angelegt, keine Profile verändert, keine Produktionssysteme berührt.
- Die vorhandenen Testpersonen sind synthetische Datensätze in `public.pfms_test_personas`, keine anmeldbaren Konten.

## Tatsächlich vorgefundener Bestand
| Rolle | Anzahl |
|---|---:|
| Scout | 5 |
| Verein | 5 |
| Trainer | 5 |
| Co-Trainer | 5 |
| Agentur | 5 |
| Agenturscout | 5 |
| Betreuer | 5 |
| Spieler | 5 |
| Admin | 1 |
| **Gesamt** | **41** |

Alle 41 Datensätze haben `is_test = true` und `login_enabled = false`.

## Sicherheitsprüfungen – Live-Ergebnis
Alle 9 read-only Acceptance-Gates bestanden:
1. Alle neun Rollen mit den erwarteten Stückzahlen vorhanden.
2. Genau 41 Testdatensätze.
3. Alle Datensätze als Testdaten markiert.
4. Alle Test-Logins deaktiviert.
5. Keine Spalten `email`, `auth_user_id` oder `user_id` in der Testpersonen-Tabelle.
6. RLS aktiviert und FORCE ROW LEVEL SECURITY aktiviert.
7. Keine direkten Tabellenrechte für `anon` oder `authenticated`.
8. Anzahl bestehender `auth.users` unverändert bei 1.
9. Anzahl bestehender `public.profiles` unverändert bei 1.

Die Tabelle besitzt eine Deny-all-Policy `pfms_test_personas_deny_client_access` für alle Operationen mit `USING (false)` und `WITH CHECK (false)`.

## Was damit ausdrücklich NICHT getestet wurde
- Es wurden keine echten Supabase-Auth-Konten für die 41 Rollen angelegt.
- Login, Registrierung, E-Mail-Bestätigung, Passwort-Reset und Session-Roundtrip wurden nicht mit diesen Personas ausgeführt.
- Rollenbezogene UI- und Mandanten-Workflows sind damit noch nicht als E2E abgenommen.
- Die bestehende Auth- und Profilbasis blieb bei jeweils einem Datensatz.

## Nächste Schritte
1. Auth-Testkonten ausschließlich über einen sicheren, unterstützten Supabase-Auth-Admin-Provisionierungsweg in isolierter Staging-Umgebung anlegen.
2. Vorher E-Mail-Bestätigungsmodus und erlaubte Testdomäne prüfen; keine echten Adressen oder produktiven Zugangsdaten verwenden.
3. Rollen- und Mandantenzuordnung über die vorgesehenen Provisionierungs-/Einladungswege herstellen.
4. Browserbasierte E2E-Tests je Rolle ausführen und positive wie negative Berechtigungsfälle dokumentieren.
5. Keine Änderungen an Produktion, `main` oder produktiven Daten; PR #1 bleibt Draft.

## CI-Bezug
- Branch: `feature/pfss-complete-platform-build`
- Commit der grünen Persona-Smoke-Testkorrektur: `d658ae6a856d9b2edd8c316d23f394fdff64b170`
- Push- und Pull-Request-CI für diesen Commit erfolgreich.
