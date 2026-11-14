# PFMS – Staging-Deployment und Abnahme

Diese Anleitung gilt ausschließlich für die getrennte PFMS-Testumgebung. Sie ist keine Freigabe für `main`, Produktions-Supabase oder die Live-Render-Domain.

Die Wiederherstellung eines verschlüsselten PostgreSQL-Backups ist separat in [`docs/BACKUP_RESTORE.md`](BACKUP_RESTORE.md) dokumentiert. Sie darf ausschließlich in eine neu angelegte, isolierte Testdatenbank erfolgen; Storage-Binärdateien sind gesondert zu berücksichtigen.

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

Die Migration `20261118_pfms_legacy_org_manager_guard.sql` stellt den serverseitigen Organisationsverwalter-Check bereit, den die Einladungs-RPC verwendet. Sie muss in der regulären chronologischen Migrationenfolge nach `20261111_fix_invitation_admin_access.sql` angewendet werden; nicht isoliert vorziehen oder auslassen.

## 3.1 Username-Login-Rate-Limit vorbereiten

Vor dem Deploy der Username-Login-Function müssen eine eigene Upstash-Redis-Datenbank für Staging sowie diese drei Supabase-Function-Secrets im Staging-Projekt eingerichtet sein:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PFMS_RATE_LIMIT_HMAC_KEY` (zufällig, mindestens 32 Zeichen)

Das Limit zählt nur fehlgeschlagene Anmeldungen; erfolgreiche Logins verbrauchen kein Kontingent. Die Erstellung und Secret-Befüllung ist in [EDGE_FUNCTION_CONFIGURATION.md](EDGE_FUNCTION_CONFIGURATION.md#2-username-login-gemeinsames-rate-limit) beschrieben. Ohne diese Werte antwortet die Function absichtlich mit HTTP 503; es gibt keinen ungeschützten Fallback.

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

## 3.2 Passkey/WebAuthn im Staging vorbereiten

Passkeys dürfen erst nach Festlegung der endgültigen Staging-Domain aktiviert werden. Supabase verlangt eine konfigurierte Relying Party (RP): Display Name, RP-ID und erlaubte Origins. Registrierung ist nur für angemeldete, bestätigte, nicht-anonyme Konten möglich.

1. Zuerst den tatsächlichen Hostnamen des Render-Stagingdienstes im Render-Dashboard feststellen. Nicht aus dem Dienstnamen ableiten.
2. Im Supabase-Dashboard ausschließlich das Projekt `PFSS-Test` öffnen: **Authentication → Passkeys**.
3. Für Staging einen eigenen RP-Displaynamen festlegen, z. B. `PFMS Test`.
4. Als RP-ID den vollständigen Staging-Hostnamen ohne Schema, Port oder Pfad verwenden, sofern kein dediziertes PFMS-Staging-Custom-Domain eingerichtet wurde.
5. Als erlaubte Origin exakt die Staging-Origin mit HTTPS eintragen, z. B. `https://<tatsaechlicher-staging-host>`. Keine Produktions-Origin und keine pauschalen Wildcards hinzufügen.
6. Passkey-Authentifizierung erst nach Prüfung der RP-Konfiguration aktivieren.

**Wichtige Render-Domain-Regel:** `onrender.com` ist als Public Suffix registriert. Deshalb darf `onrender.com` nicht als gemeinsame RP-ID verwendet werden. Der vollständige konkrete Staging-Hostname kann als eigene RP-ID verwendet werden; ein eigenes PFMS-Custom-Domain ist für eine langfristig stabile RP-ID vorzuziehen. Die WebAuthn-Spezifikation verlangt, dass die RP-ID zur Origin passt. Eine Änderung der RP-ID macht bereits registrierte Passkeys unbrauchbar. Staging- und Produktionsdomain erhalten getrennte Passkey-Zugänge; keine Staging-Credentials als Produktions-Recovery einplanen.

Vor dem ersten Passkey-Test dokumentieren: tatsächlicher Render-Hostname, RP-ID, erlaubte Origin(s), Supabase-Projektname `PFSS-Test` und Datum der Konfiguration. Keine Passkeys für reale Benutzer registrieren, bevor die Staging-Tests abgeschlossen sind.

## 4. Read-only Schema-Audit

Die Datei `supabase/STAGING_READ_ONLY_AUDIT.sql` im SQL-Editor des **Staging-Projekts** ausführen. Die Abfrage liest Tabellen-/Spalteninformationen, Policies, Grants und Tabellenstatistiken; sie ist kein Ersatz für einen Funktionstest.

Ergebnisse sichern und insbesondere prüfen:

- Legacy- und neues Organisationsmodell sind nicht unbeabsichtigt vermischt.
- RLS ist für alle neuen PFMS-Tabellen aktiviert und die Policies entsprechen den erwarteten Rollen.
- Storage-Bucket `pfss-scout-private` bleibt privat; Objektpfade sind benutzergebunden.
- Neue Tabellen: globaler Spielerkatalog, Haupt-Scoutingberichte, Hauptmedien, persönliche Aufgaben und Supporttickets.
- Security-Definer-Funktionen besitzen einen festen `search_path` und passende Grants.
- Der Audit listet zusätzlich die effektiven `EXECUTE`-Berechtigungen aller PFMS-/PFSS-RPCs und Security-Definer-Funktionen auf. Keine unbeabsichtigten `PUBLIC`-/`anon`-Freigaben akzeptieren; jede Freigabe an `authenticated` muss mit einer internen Rollen-/Eigentümerprüfung oder einer eng begrenzten Helferfunktion begründet sein. Der Owner-Claim-RPC darf ausschließlich durch `service_role` ausführbar sein.

**Zusätzlicher read-only Abnahmebericht:** Nach dem Anwenden der Feature-Migrationen und nach dem normalen Schema-Audit zusätzlich `supabase/STAGING_ACCEPTANCE_READ_ONLY.sql` im SQL-Editor des dedizierten Staging-Projekts ausführen. Die Abfrage liefert je Prüfung `check_name`, `passed` und `details`. Jede Zeile muss `passed = true` liefern, bevor die jeweilige Funktion in den positiven Rollen-/Negativtests freigegeben wird. Das Skript liest ausschließlich Kataloge, Privilegien und Metadaten; es verändert weder Schema noch Nutzerdaten. Ein fehlgeschlagener Check ist ein Stop-Kriterium, keine Aufforderung, Rechte im Dashboard spontan zu öffnen.

## 5. Funktionale Abnahme

Die Tests ausschließlich mit getrennten Staging-Konten durchführen: Plattformadministrator, Vereins-/Agenturleitung, Scout, Trainer, Co-Trainer, Betreuer und normales Mitglied. Keine Produktivkonten oder echten personenbezogenen Daten verwenden.

### Abrechnung und Registrierungssperre
- Vereins-, Agentur- und Einzelscout-Tarife sind bis zur Anbieter- und Vertragsfreigabe reine Vorschau. Preise sind Entwürfe und dürfen nicht als verbindliches Angebot oder aktivierte Testphase verstanden werden.
- Beim Klick auf die Tarifvorschau darf weder ein Supabase-Auth-Konto angelegt noch ein Vertrag, eine Testphase oder eine Abbuchung ausgelöst werden.
- Es dürfen keine `trial_days`- oder `billing_cycle`-Metadaten als tatsächliche Vertragsdaten gespeichert werden.
- Die Adminseite muss deutlich „Keine Abbuchungen aktiv“ und „Kein Zahlungsanbieter verbunden“ anzeigen. Kein externer Checkout-Button darf aktiv sein.
- Vor Aktivierung sind Anbieter, Preis-/USt.-Logik, signierte Webhooks, Kündigungs- und Erstattungsprozesse, Rechnungsdaten, Datenschutz und rechtliche Vertragsbedingungen abzunehmen. Test- und Live-Schlüssel sind getrennt und ausschließlich serverseitig zu halten.
- Ohne vollständige Anbieterintegration, erfolgreiche Testzahlungen und ausdrückliche Produktionsfreigabe bleibt die Zahlungsfunktion deaktiviert.

### In-App-Mitteilungen
- Eine neue Zuweisung einer Teamaufgabe erzeugt eine Mitteilung nur beim Empfänger; Selbstzuweisungen erzeugen keine eigene Mitteilung.
- Beim Abschließen einer Aufgabe erhalten Ersteller und zugewiesene Person (außer dem ausführenden Konto) jeweils eine eigene Mitteilung.
- Wenn ein Administrator eine Antwort zu einem Support-Ticket speichert, erhält nur der Ticketinhaber eine Mitteilung mit direktem Weg zum eigenen Ticket. Wird ein Ticket ohne neue Antwort auf erledigt gesetzt, erhält ebenfalls nur der Ticketinhaber eine Mitteilung.
- Ein anderes Benutzerkonto darf weder die Support-Mitteilung noch das zugehörige Ticket lesen. Der Support-Trigger darf von Browserrollen nicht direkt ausgeführt werden.
- Mitteilungen werden nur im persönlichen In-App-Posteingang dieses Kontos angezeigt. Ein anderes Konto darf die Datensätze weder lesen noch verändern.
- Browserkonten dürfen Mitteilungen nicht einfügen oder löschen. Sie dürfen ausschließlich das eigene `is_read`-Feld ändern; `read_at` wird serverseitig gesetzt.
- Abmeldung/Kontowechsel leert den lokalen Benachrichtigungszustand und die Badge-Zahl. Die Seitenleiste zeigt nach Anmeldung die Zahl ungelesener Mitteilungen.
- Push-, E-Mail- und externe Zustellkanäle sind in diesem Arbeitsschritt nicht enthalten.

### Gemeinsame Teamaufgaben
- Ein Konto mit `tasks.view` darf nur Aufgaben der eigenen Mannschaft lesen. Ohne Leserecht muss der List-RPC scheitern.
- Mit `tasks.edit` Aufgaben anlegen, bearbeiten, Status ändern und löschen. Beim Erstellen alle Anfangsstatus (`open`, `in_progress`, `done`, `cancelled`) testen; bei `done` muss `completed_at` gesetzt, bei allen anderen Status null sein. Ohne dieses Recht müssen alle Schreib-RPCs serverseitig scheitern.
- Die `EXECUTE`-Freigabe für `pfms_create_legacy_team_task` muss exakt zur siebenstelligen Signatur passen. Ein Aufruf mit dem gewählten `p_status` muss den gewählten Anfangsstatus unverändert speichern.
- Aufgaben dürfen nur aktiven Trainern, Co-Trainern oder Betreuern derselben Mannschaft zugewiesen werden. Versuche mit einem Mitarbeiter aus einer anderen Mannschaft oder einem inaktiven/entfernten Mitarbeiter müssen scheitern.
- Beim Löschen einer Staff-Zuordnung bleibt die Teamaufgabe erhalten und wird automatisch unzugewiesen; Aufgaben dürfen nicht kaskadierend mit Staff-Mitgliedern gelöscht werden.
- Teamaufgaben sind strikt von privaten persönlichen Aufgaben getrennt. Ein normales Mitglied ohne Teamaufgabenrecht darf die Teamliste nicht lesen und persönliche Aufgaben anderer Konten nie sehen.

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


### Mandantentrennung für Teams und Organisationsmitglieder

- Migration `20261211_pfms_legacy_team_membership_scope.sql` nach Backup und Prüfung der tatsächlichen Migrationshistorie anwenden.
- `legacy_team_access_requires_active_org_membership` muss im Read-only-Abnahmeskript `passed = true` melden.
- Positivtest: aktive Vereinsleitung und aktiver Trainer sehen ausschließlich Teams der eigenen freigegebenen/aktiven Organisation; der Trainer benötigt eine aktive Organisationsmitgliedschaft mit der Rolle `trainer`, passend zur Teamzuordnung.
- Negativtest: Teamzugriff muss scheitern, sobald die Organisationsmitgliedschaft gesperrt/entzogen oder die Organisation nicht mehr `approved`/`active` ist. Ein weiterhin vorhandener aktiver Team-Personaldatensatz darf den Zugriff nicht aufrechterhalten.
- Negativtest: Rollenwechsel der Organisationsmitgliedschaft ohne passende Änderung der Teamzuordnung darf keinen Trainerzugriff gewähren.
- Negativtest: Nutzer einer zweiten Organisation dürfen weder Teams noch Kader, Trainings-, Finanz-, Veranstaltungs-, Aufgaben- oder Analyseinformationen der ersten Organisation lesen oder ändern.
- Plattformadministratoren behalten nur den ausdrücklich implementierten globalen Verwaltungszugriff. Ergebnisse mit Testkonto, Rolle, Organisations-ID, Team-ID, Zeit und Request-/SQL-Fehler dokumentieren.

### Zusätzliche Inhaber- und Profilrechte-Abnahme

Vor einer Staging-Freigabe auch die neuen Inhaber-Schutzprüfungen ausführen:

- Migration `20261210_pfms_owner_integrity_hardening.sql` erst nach Backup und Prüfung der tatsächlichen Migrationshistorie anwenden.
- Mit einem zweiten Plattformadministrator versuchen, die Rolle und den Status des designierten Plattforminhabers über die normale Profilverwaltungs-RPC zu ändern. Der Aufruf muss serverseitig abgewiesen werden.
- Als normal angemeldetes Konto prüfen, dass direkte UPDATE-Rechte auf `profiles.role` und `profiles.status` nicht bestehen. Die Abnahmeprüfung `profile_authority_columns_protected` muss `passed = true` melden. Falls nicht, zuerst die vorhandenen Profil-Policies, Spaltenrechte und legitimen Profiländerungsabläufe prüfen; keine pauschale Rechteänderung ohne diesen Audit.
- Zwei parallele Administratorvorgänge simulieren, die unterschiedliche aktive Inhabermitgliedschaften derselben Organisation herabstufen. Die Organisationszeilensperre muss die Vorgänge serialisieren; am Ende muss mindestens ein aktiver Inhaber verbleiben.
- Die Read-only-Abnahme muss `platform_owner_admin_protection` und `legacy_owner_updates_serialized` als bestanden ausweisen.

## 7. Freigabegrenze

Erst nach erfolgreicher Datenbank-, RLS-, Storage-, Rollen-, Browser-, Backup-/Restore- und Datenschutzabnahme darf ein separater Produktionsfreigabeplan erstellt werden. Zahlungsabwicklung bleibt deaktiviert, bis Anbieter, Gebühren, Webhooks, Rechnungs-/Steueranforderungen und rechtliche Texte geprüft und ausdrücklich freigegeben wurden.


### Private Scout-Arbeitsbereiche, Medien und Einladungen

- Read-only-Abnahme: `private_scout_tables_force_rls`, `private_scout_owner_policies`, `private_scout_storage_isolated` und `invitation_redemption_status_guard` müssen jeweils `passed = true` melden.
- Mit zwei getrennten Scout-Testkonten prüfen: Scout A kann eigene Spieler, Berichte und Medien lesen; Scout B kann diese Datensätze weder lesen noch ändern. Ein Bericht oder Medium darf nicht an einen Spieler des jeweils anderen Scouts angehängt werden.
- Storage-Negativtest: Upload und Lesen unter dem UID-Ordner eines anderen Kontos müssen scheitern. Der Bucket `pfss-scout-private` muss privat bleiben; keine öffentlichen URLs oder öffentlichen Buckets für diese Dateien verwenden.
- Einladungstests: gültiger Code genau einmal; derselbe Code ein zweites Mal; widerrufener Code; abgelaufener Code; Organisation im gesperrten Status; parallele Einlösung desselben Codes. Nur der erste gültige Vorgang bei aktiver/freigegebener Organisation darf eine Mitgliedschaft erzeugen.
- Der globale Spielerkatalog ist absichtlich für freigegebene Konten lesbar; Schreiboperationen bleiben Plattformadministratoren vorbehalten. Die Team-Kaderzuordnung und private Scout-Kopien sind davon getrennte Datensätze. Bei der Abnahme daher globale Katalogsichtbarkeit nicht mit Zugriff auf fremde Teamdaten oder private Scout-Arbeitsbereiche verwechseln.
- Tests mit Testkonto, Benutzer-ID, Tabellen-/Objekt-ID, erwarteter Berechtigung und tatsächlichem Ergebnis protokollieren. Diese Tests sind erst nach separatem Staging-Setup auszuführen; keine Produktionsdaten verwenden.


### Teamaufgaben: Empfängerstatus und Organisationsmitgliedschaft

- `team_task_assignee_current_membership` muss im Read-only-Abnahmeskript `passed = true` melden.
- Positivtest: Ein aktiver Teammitarbeiter mit aktiver Organisationsmitgliedschaft und übereinstimmender Rolle kann als Aufgabenempfänger ausgewählt werden.
- Negativtests: Eine weiterhin aktive Team-Personalzuordnung darf nicht ausreichen, wenn die Organisationsmitgliedschaft entzogen/gesperrt, die Rolle geändert oder die Organisation gesperrt wurde. Erstellung und Änderung einer Aufgabe müssen die Zuweisung in allen diesen Fällen serverseitig ablehnen.
- Auch bei einem Wechsel der Mitgliedschaft zwischen Formularanzeige und Speichern muss die Datenbankprüfung maßgeblich sein. Ergebnisse mit zwei Testkonten dokumentieren.


### Trainingszyklen: Datumsintegrität von Trainingseinheiten

- Read-only-Abnahme: `training_cycle_session_date_integrity` muss `passed = true` melden.
- Positivtest: Eine Trainingseinheit innerhalb des Start-/Enddatums ihrer zugeordneten Mikrozykluswoche muss gespeichert werden können.
- Negativtests: Nach Zuordnung darf das Datum nicht vor den Wochenbeginn oder nach das Wochenende verschoben werden. Eine Zuordnung zu einer Woche eines anderen Teams muss ebenfalls scheitern.
- Die Tests über die regulären Trainings-RPCs mit zwei Team-Testkonten ausführen und Ergebnisse protokollieren. Noch nicht in Produktion oder auf einer realen Staging-Datenbank angewendet.


### Spieltagsaufstellungen: Teamgrenzen

- Read-only-Abnahme: `match_lineup_same_team_integrity` muss `passed = true` melden.
- Positivtest: Ein Spieler aus dem Kader desselben Teams kann in die Aufstellung aufgenommen werden.
- Negativtests: Eine Aufstellungszeile mit einem Spieler eines anderen Teams muss auf Datenbankebene abgewiesen werden, auch wenn ein direkter Schreibversuch außerhalb der regulären Oberfläche simuliert wird.
- Vor Anwendung die vorhandenen Aufstellungsdaten auf Teamkonflikte prüfen. Die Migration bricht absichtlich ab, wenn bestehende Zeilen Spiel und Kaderzuordnung aus unterschiedlichen Teams verbinden.
