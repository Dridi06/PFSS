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

**Zusätzliche Absicherung des R2-Verbindungstests:** Die Edge Function `r2-connection-check` verlangt ein gültiges Benutzer-JWT und prüft zusätzlich `public.pfms_is_admin()`. In `supabase/config.toml` ist `verify_jwt = true` explizit gesetzt. Im Staging muss mit einem Admin-Konto ein erfolgreicher Aufruf und mit einem Scout-/Mitgliedskonto ein erwarteter HTTP-403-Test erfolgen. Die Funktion führt nur einen begrenzten List-Bucket-Aufruf aus und gibt keine Provider-Antwortkörper oder Zugangsdaten zurück.

## 4. Read-only Schema-Audit

Die Datei `supabase/STAGING_READ_ONLY_AUDIT.sql` im SQL-Editor des **Staging-Projekts** ausführen. Die Abfrage liest Tabellen-/Spalteninformationen, Policies, Grants und Tabellenstatistiken; sie ist kein Ersatz für einen Funktionstest.

Ergebnisse sichern und insbesondere prüfen:

- Legacy- und neues Organisationsmodell sind nicht unbeabsichtigt vermischt.
- RLS ist für alle neuen PFMS-Tabellen aktiviert und die Policies entsprechen den erwarteten Rollen.
- Storage-Bucket `pfss-scout-private` bleibt privat; Objektpfade sind benutzergebunden.
- Neue Tabellen: globaler Spielerkatalog, Haupt-Scoutingberichte, Hauptmedien, persönliche Aufgaben und Supporttickets.
- Security-Definer-Funktionen besitzen einen festen `search_path` und passende Grants.
- Der Audit listet zusätzlich die effektiven `EXECUTE`-Berechtigungen aller PFMS-/PFSS-RPCs und Security-Definer-Funktionen auf. Keine unbeabsichtigten `PUBLIC`-/`anon`-Freigaben akzeptieren; jede Freigabe an `authenticated` muss mit einer internen Rollen-/Eigentümerprüfung oder einer eng begrenzten Helferfunktion begründet sein. Der Owner-Claim-RPC darf ausschließlich durch `service_role` ausführbar sein.

## 5. Funktionale Abnahme

Die Tests ausschließlich mit getrennten Staging-Konten durchführen: Plattformadministrator, Vereins-/Agenturleitung, Scout, Trainer, Co-Trainer, Betreuer und normales Mitglied. Keine Produktivkonten oder echten personenbezogenen Daten verwenden.

### Training und Trainingszyklen
- Mit `training.view` Trainingszyklen, Wochen, Übungen und Einheitenpläne der eigenen Mannschaft lesen; ohne dieses Recht muss der Lese-RPC scheitern.
- Mit `training.edit` einen Zyklus über maximal 364 Tage anlegen. Die Wochen müssen ohne Lücken erzeugt und im Zykluszeitraum gehalten werden. Wochenziele, Schwerpunkt, Trainerhinweise und Belastungsstufe 1–5 speichern und wieder laden.
- Eine Einheit nur einer Woche derselben Mannschaft und nur dann zuordnen, wenn ihr Datum innerhalb der Woche liegt. Fremde Team-IDs, falsche Wochenzeiträume und fehlende Bearbeitungsrechte müssen serverseitig abgewiesen werden.
- Mit `attendance.view/edit` Anwesenheit getrennt von `training.view/edit` prüfen. Teamfremde Kaderzuordnungen müssen scheitern.

### Taktik- und Videoanalyse
- Mit `analysis.view` nur Analysen der eigenen Mannschaft lesen; ohne Leserecht muss der RPC scheitern.
- Mit `analysis.edit` taktische Auswertungen und Videoanalysen anlegen, bearbeiten und löschen. Spielbezug darf nur auf ein Spiel derselben Mannschaft zeigen.
- Videoanalyse erfordert eine HTTPS-Quelle mit gültigem Host. HTTP, leere Hosts und URLs mit eingebetteten Zugangsdaten müssen abgewiesen werden. Zeitmarken müssen zwischen 0 und 86.400 Sekunden liegen.
- Ohne `analysis.edit` müssen Speichern, Bearbeiten und Löschen serverseitig scheitern. Wechsel zu einer anderen Mannschaft oder einem anderen Konto darf keine zuvor angezeigten Analyseinhalte im UI zurücklassen.

### Spiele, Kalender und Veranstaltungen
- `matches.view/edit` und `calendar.view/edit` getrennt testen. Spiele, Ergebnisse, Aufstellungen und Mannschaftskalender dürfen nur im jeweiligen Berechtigungsbereich gelesen oder geändert werden.
- Mit `events.view` nur Turniere und allgemeine Veranstaltungen der eigenen Mannschaft sehen; Spiele und Besprechungen müssen verborgen bleiben. `calendar.view` muss weiterhin den vollständigen Mannschaftskalender abdecken.
- Mit `events.edit` Veranstaltungen anlegen, bearbeiten und löschen. Ohne dieses Recht müssen alle Änderungen serverseitig scheitern.
- Teilnehmerlisten dürfen nur Kaderspieler derselben Mannschaft enthalten. RSVP-Status `invited/confirmed/declined/attended/absent` testen. Teamfremde Spieler, teamfremde Veranstaltungen und direkte Tabellen-Schreibversuche müssen abgewiesen werden.
- Anmeldeschluss, Treffpunkt, Transportart, Kosten und Kapazität prüfen. Das Kapazitätslimit darf weder beim Hinzufügen noch beim RSVP-Statuswechsel überschritten werden.

### Veranstaltungsfahrtplan
- Mit `events.view` nur Fahrtpläne der eigenen Mannschaft lesen; ohne Leserecht muss der RPC scheitern.
- Mit `events.edit` Abfahrtsort, Ziel, Treffzeit, Abfahrt, Ankunft, Rückfahrt, Anbieter, Fahrzeug, Sitzplätze, Gesamtkosten und Hinweise speichern und löschen.
- Treffzeit darf nicht nach Abfahrt, Ankunft nicht vor Abfahrt und Rückfahrt nicht vor Ankunft liegen. Sitzplatzlimit 1–80 und Gesamtkosten 0–100.000 € prüfen.
- Die Fahrzeugkapazität darf nicht unter die bereits aktiven Einladungen/Zusagen/Teilnahmen fallen. Diese Grenze muss auch bei RSVP-Statuswechseln unter Event-Zeilensperre gelten.
- Ein Verweis auf ein anderes Team oder einen Kalendereintrag vom Typ Spiel/Besprechung muss scheitern. Treffpunkt und Transportart bleiben in der gemeinsamen Event-Logistik und dürfen nicht dupliziert werden.

### Gesamt-Abnahme
| Bereich | Positivtest | Negativtest |
|---|---|---|
| Authentifizierung | Reload erhält Sitzung; Passwort-Wiederherstellung funktioniert | Nicht freigegebenes Konto erreicht keinen Workspace |
| Owner-Bootstrap | Genau ein vorgesehener Owner kann den Claim abschließen | Zweiter Claim und falsches Geheimnis werden abgewiesen |
| Organisationen | Leitung sieht und verwaltet nur eigene Organisationen | Fremde Organisation kann nicht gelesen oder geändert werden |
| Mitglieder/Einladungen | Gültiger Einmal-Link wird einmal eingelöst | Gesperrte Organisation, abgelaufener oder wiederverwendeter Link wird abgewiesen |
| Globaler Spielerkatalog | Freigegebene Konten lesen; Admin verwaltet | Scout kann globale Stammdaten nicht ändern |
| Scout-Arbeitsbereich | Scout verwaltet eigene Spieler, Berichte und Medien | Scout A kann keine privaten Daten von Scout B lesen |
| Hauptmedien | Upload, signierter Abruf und Löschen | Fremde Storage-Pfade und nicht erlaubte MIME-Typen scheitern |
| Mannschaftskasse | Buchung, Kassenstand und begründete Stornierung | Ohne `finance.edit` keine Änderungen; Originalbuchungen bleiben erhalten |
| Persönliche Aufgaben | Anlegen, Statuswechsel und Löschen | Fremdes Konto sieht keine Aufgaben |
| Support | Nutzer erstellt Ticket und sieht eigene Antwort | Nutzer sieht keine fremden Tickets; nur Admin antwortet |
| Backup | R2-Backup und isolierter Restore | Restore überschreibt niemals Produktionsdaten |

Jeden Test mit Testkonto/Rolle, Zeit, Ergebnis und gegebenenfalls Request-/SQL-Fehler dokumentieren. Vor der Abnahme keine Migration als angewendet markieren, solange die tatsächliche Staging-Historie und der Dry-Run nicht geprüft wurden.

## 6. Frontend und Render-Staging

### Verbindliche Supabase-Build-Konfiguration

Das Frontend enthält keine fest eingetragene Projekt-URL und keinen fest eingetragenen Publishable Key mehr. Der Static-Site-Build erzeugt `dist/pfms-config.js` aus den Render-Umgebungswerten:

- `PFMS_BUILD_TARGET=staging` (wird durch die Blueprint-Konfiguration festgelegt)
- `PFMS_STAGING_PROJECT_REF`: die dedizierte, 20-stellige Projekt-Referenz aus dem **Staging**-Supabase-Dashboard
- `PFSS_SUPABASE_URL`: exakt `https://<PFMS_STAGING_PROJECT_REF>.supabase.co`
- `PFSS_SUPABASE_KEY`: ausschließlich der öffentliche Publishable-/anon-Key dieses Staging-Projekts

Der Build bricht ab, wenn Werte fehlen, URL und Projekt-Referenz nicht exakt übereinstimmen oder ein Secret-/Service-Role-Key verwendet wird. Der Schlüssel ist im Browser sichtbar und muss deshalb ein öffentlicher Publishable-/anon-Key sein. Niemals einen Service-Role-/Secret-Key verwenden. Render fragt Werte mit `sync: false` nur beim erstmaligen Erstellen des Blueprints ab. Bei einem bereits bestehenden Render-Dienst müssen die drei Werte manuell im Dashboard ergänzt werden. Sie werden nicht in Git gespeichert.

GitHub CI verwendet ausschließlich `PFMS_BUILD_TARGET=ci` mit einer ungültigen Platzhalter-URL und einem Platzhalter-Key. Dadurch wird der vollständige Paket-Build getestet, ohne echte Supabase-Projektinformationen einzubetten. Ein lokaler Staging-Build benötigt dieselben vier Staging-Werte wie Render.


### Reproduzierbarer Static-Site-Build

- `render.yaml` definiert den getrennten Dienst `pfms-staging-static` auf `feature/pfss-complete-platform-build`.
- Der Render-Build-Befehl führt Syntaxprüfung, einen echten Staging-Build und anschließend die Smoke-, Accessibility- und SQL-Tests aus. Der normale `npm test`-Lauf nutzt dagegen ausschließlich eine CI-Platzhalterkonfiguration.
- `scripts/build-static.mjs` kopiert ausschließlich `index.html`, `rechtliches.html`, beide CSS-Dateien, beide JavaScript-Dateien, das PFMS-Logo und das Willkommens-Hintergrundbild nach `dist/` und erzeugt zusätzlich die projektgebundene `pfms-config.js`. SQL-Migrationen, Tests, interne Dokumentation und Repository-Konfigurationen werden nicht veröffentlicht.
- Render veröffentlicht ausschließlich `./dist`. Automatische Deployments sind auf erfolgreiche Checks begrenzt (`autoDeployTrigger: checksPass`).
- Die Staging-Response-Header enthalten eine Content-Security-Policy: Scripts sind auf lokale Dateien und `cdn.jsdelivr.net` begrenzt; Stylesheets dürfen zusätzlich die in `styles.css` verwendete Quelle `fonts.googleapis.com` laden; Font-Dateien sind über `font-src https:` erlaubt; Verbindungen sind auf lokale Origins und Supabase-Subdomains begrenzt; Frames und Plugin-Inhalte sind gesperrt. Die Richtlinie muss nach dem Deployment im Browser auf Auth, Storage und Medien geprüft werden. Bei einem legitimen blockierten Dienst wird nur die erforderliche konkrete Quelle ergänzt, nicht pauschal `*` freigegeben.
- Die Blueprint-Datei provisioniert oder ändert keinen Dienst allein durch einen Git-Commit. Vor dem Anwenden in Render müssen Repository, Branch, Dienstname und Zielumgebung kontrolliert werden.
- **Wichtige Typgrenze:** Der PFMS-Client ist eine statische Website. Render unterscheidet statische Websites (Blueprint: `type: web`, `runtime: static`) von normalen Web Services. Der Servicetyp kann nach der Erstellung nicht geändert werden. Ist der vorhandene Testdienst als normaler Web Service angelegt, muss ein separater Static-Site-Dienst erstellt werden; der bestehende Live-Dienst bleibt unverändert.

- GitHub Actions muss beide Jobs grün melden: Node-Syntax-/Smoke-Tests und Deno-Typprüfung aller Edge Functions.
- Render-Service-Typ im Dashboard verifizieren. Nicht allein aus der URL ableiten, ob es ein Static Site- oder Web-Service ist.
- Staging-Service explizit auf den Entwicklungsbranch setzen.
- Build/Publish-Konfiguration und Umgebungsvariablen prüfen; anschließend Login, Reload, mobile Navigation, Medien und Support im Browser testen.
- Health-/Deploy-Logs sichern. Produktionsservice und Produktions-Branch bleiben unverändert.

## 7. Freigabegrenze

Erst nach erfolgreicher Datenbank-, RLS-, Storage-, Rollen-, Browser-, Backup-/Restore- und Datenschutzabnahme darf ein separater Produktionsfreigabeplan erstellt werden. Zahlungsabwicklung bleibt deaktiviert, bis Anbieter, Gebühren, Webhooks, Rechnungs-/Steueranforderungen und rechtliche Texte geprüft und ausdrücklich freigegeben wurden.
