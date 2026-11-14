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

## 5. Funktionale Abnahme mit getrennten Testkonten

Mindestens folgende Konten verwenden: Plattformadministrator, Vereins-/Agenturleitung, Scout, Trainer/Co-Trainer/Betreuer und normales Mitglied. Keine Produktivkonten verwenden.

| Bereich | Positivtest | Negativtest |
|---|---|---|
| Authentifizierung | Reload erhält die Sitzung; Passwort-Wiederherstellung | nicht freigegebenes Konto erreicht keinen Workspace |
| Owner-Bootstrap | genau ein vorgesehener Owner kann den Claim abschließen | zweiter Claim und falsches Geheimnis werden abgewiesen |
| Organisationen | berechtigte Leitung sieht nur verwaltbare Organisationen | fremde Organisation kann nicht gelesen oder geändert werden |
| Mitglieder/Einladungen | aktiver Verein: gültiger Einmal-Link wird einmal eingelöst | Verein nach Ausstellung sperren: Einlösung muss scheitern; abgelaufener oder wiederverwendeter Link wird ebenfalls abgewiesen |
| Globaler Spielerkatalog | freigegebene Konten lesen; Admin verwaltet | Scout kann globale Stammdaten nicht ändern |
| Scout-Arbeitsbereich | Scout verwaltet eigene Spieler, Berichte und Medien | Scout A kann keine privaten Daten von Scout B lesen |
| Hauptmedien | Upload, signierter Abruf und Löschen | fremde Storage-Pfade und nicht erlaubte MIME-Typen scheitern |
| Mannschaften | Rollenrechte für Kader, Training, Anwesenheit, Kalender, Spiele, Finanzen und Analyse; Trainingszyklen mit automatisch erzeugten Wochen und Belastungsstufen; Taktik-/Videoanalyse mit Spielbezug und Zeitmarke | Ohne `training.edit` keine Zyklus-/Wochenänderungen; ohne `analysis.edit` keine Analyseänderungen; teamfremde Spiele und Datenzugriffe werden serverseitig abgewiesen; Videoanalyse ohne HTTPS-Quelle scheitert |
| Persönliche Aufgaben | Anlegen, Statuswechsel, Löschen | fremdes Konto sieht keine Aufgaben |
| Support | Nutzer erstellt Ticket und sieht eigene Antwort | Nutzer sieht keine fremden Tickets; nur Admin antwortet |
| Backup | R2-Backup und isolierter Restore | Restore überschreibt niemals Produktionsdaten |

Jeden Test mit Konto, Zeit, Ergebnis und gegebenenfalls Request-/SQL-Fehler dokumentieren.

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
