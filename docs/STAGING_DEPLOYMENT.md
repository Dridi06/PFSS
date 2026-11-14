# PFMS – Staging-Deployment und Abnahme

Diese Anleitung gilt ausschließlich für die getrennte PFMS-Testumgebung. Sie ist keine Freigabe für `main`, Produktions-Supabase oder die Live-Render-Domain.

## 1. Vorbedingungen

- Der Code liegt auf `feature/pfss-complete-platform-build`.
- Staging-Supabase-Projekt und Staging-Render-Service sind eindeutig identifiziert.
- Vor Änderungen existiert ein aktuelles, extern gespeichertes Staging-Backup.
- Der Staging-Projekt-Ref wurde aus dem Supabase-Dashboard übernommen. Keine Produktions-URL verwenden.
- Supabase CLI ist installiert und mit dem richtigen Konto authentifiziert.

## 2. Migrationsstand prüfen

Im Repository-Verzeichnis:

```bash
supabase login
supabase link --project-ref <STAGING_PROJECT_REF>
supabase migration list
supabase db push --dry-run
```

**Sofort stoppen**, wenn das verknüpfte Projekt nicht eindeutig Staging ist, Migrationen fehlen, die Remote-Historie abweicht oder ein unerwarteter SQL-Plan angezeigt wird. Keine Migration-Historie manuell als erledigt markieren und kein `--include-all` ohne Schema-Audit verwenden.

Wenn der Dry-Run vollständig geprüft wurde:

```bash
supabase db push
```

Die CLI wendet alle noch ausstehenden, versionierten Migrationen in ihrer Reihenfolge an. Keine einzelne Migration überspringen.

## 3. Edge Functions bereitstellen

Nach erfolgreichem Datenbank-Push:

```bash
supabase functions deploy username-login
supabase functions deploy r2-connection-check
supabase functions deploy pfms-owner-bootstrap
```

Die Staging-Function-Secrets im Supabase-Dashboard prüfen. Benötigte projektspezifische Variablen:

- `PFMS_ALLOWED_ORIGINS`: ausschließlich die Staging-Frontend-Origin(s) und ausdrücklich benötigte lokale Entwicklungs-Origin(s).
- `PFMS_OWNER_BOOTSTRAP_TOKEN`: separates, starkes Einmal-/Bootstrap-Geheimnis; nicht im Repository, Chat oder Frontend ablegen.
- `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`: nur wenn der R2-Backup-/Verbindungstest in Staging ausgeführt wird.

Supabase stellt die projektbezogenen `SUPABASE_URL`- und Schlüsselvariablen für Edge Functions bereit. Niemals Service-Role-Schlüssel im Browser verwenden.

## 4. Read-only Schema-Audit

Die Datei `supabase/STAGING_READ_ONLY_AUDIT.sql` im SQL-Editor des **Staging-Projekts** ausführen. Die Abfrage liest Tabellen-/Spalteninformationen, Policies, Grants und Tabellenstatistiken; sie ist kein Ersatz für einen Funktionstest.

Ergebnisse sichern und insbesondere prüfen:

- Legacy- und neues Organisationsmodell sind nicht unbeabsichtigt vermischt.
- RLS ist für alle neuen PFMS-Tabellen aktiviert und die Policies entsprechen den erwarteten Rollen.
- Storage-Bucket `pfss-scout-private` bleibt privat; Objektpfade sind benutzergebunden.
- Neue Tabellen: globaler Spielerkatalog, Haupt-Scoutingberichte, Hauptmedien, persönliche Aufgaben und Supporttickets.
- Security-Definer-Funktionen besitzen einen festen `search_path` und passende Grants.

## 5. Funktionale Abnahme mit getrennten Testkonten

Mindestens folgende Konten verwenden: Plattformadministrator, Vereins-/Agenturleitung, Scout, Trainer/Co-Trainer/Betreuer und normales Mitglied. Keine Produktivkonten verwenden.

| Bereich | Positivtest | Negativtest |
|---|---|---|
| Authentifizierung | Reload erhält die Sitzung; Passwort-Wiederherstellung | nicht freigegebenes Konto erreicht keinen Workspace |
| Owner-Bootstrap | genau ein vorgesehener Owner kann den Claim abschließen | zweiter Claim und falsches Geheimnis werden abgewiesen |
| Organisationen | berechtigte Leitung sieht nur verwaltbare Organisationen | fremde Organisation kann nicht gelesen oder geändert werden |
| Mitglieder/Einladungen | gültiger Einmal-Link wird einmal eingelöst | abgelaufener oder wiederverwendeter Link wird abgewiesen |
| Globaler Spielerkatalog | freigegebene Konten lesen; Admin verwaltet | Scout kann globale Stammdaten nicht ändern |
| Scout-Arbeitsbereich | Scout verwaltet eigene Spieler, Berichte und Medien | Scout A kann keine privaten Daten von Scout B lesen |
| Hauptmedien | Upload, signierter Abruf und Löschen | fremde Storage-Pfade und nicht erlaubte MIME-Typen scheitern |
| Mannschaften | Rollenrechte für Kader, Training, Anwesenheit, Kalender, Spiele und Finanzen | Benutzer ohne Modulrecht erhalten serverseitig 403/42501 |
| Persönliche Aufgaben | Anlegen, Statuswechsel, Löschen | fremdes Konto sieht keine Aufgaben |
| Support | Nutzer erstellt Ticket und sieht eigene Antwort | Nutzer sieht keine fremden Tickets; nur Admin antwortet |
| Backup | R2-Backup und isolierter Restore | Restore überschreibt niemals Produktionsdaten |

Jeden Test mit Konto, Zeit, Ergebnis und gegebenenfalls Request-/SQL-Fehler dokumentieren.

## 6. Frontend und Render-Staging

- GitHub Actions muss beide Jobs grün melden: Node-Syntax-/Smoke-Tests und Deno-Typprüfung aller Edge Functions.
- Render-Service-Typ im Dashboard verifizieren. Nicht allein aus der URL ableiten, ob es ein Static Site- oder Web-Service ist.
- Staging-Service explizit auf den Entwicklungsbranch setzen.
- Build/Publish-Konfiguration und Umgebungsvariablen prüfen; anschließend Login, Reload, mobile Navigation, Medien und Support im Browser testen.
- Health-/Deploy-Logs sichern. Produktionsservice und Produktions-Branch bleiben unverändert.

## 7. Freigabegrenze

Erst nach erfolgreicher Datenbank-, RLS-, Storage-, Rollen-, Browser-, Backup-/Restore- und Datenschutzabnahme darf ein separater Produktionsfreigabeplan erstellt werden. Zahlungsabwicklung bleibt deaktiviert, bis Anbieter, Gebühren, Webhooks, Rechnungs-/Steueranforderungen und rechtliche Texte geprüft und ausdrücklich freigegeben wurden.
