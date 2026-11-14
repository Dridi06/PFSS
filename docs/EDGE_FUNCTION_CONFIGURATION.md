# PFMS Edge Function – Staging-Konfiguration

Diese Anleitung betrifft ausschließlich die Supabase-Edge-Functions. Die Functions werden nicht automatisch durch Änderungen am Frontend deployt.

## 1. CORS-Allowlist

Die Functions `username-login`, `r2-connection-check` und `pfms-owner-bootstrap` verwenden den gemeinsamen Helfer `supabase/functions/_shared/cors.ts`.

Die erlaubten Origins werden aus dem Supabase-Function-Secret `PFMS_ALLOWED_ORIGINS` gelesen. Der Wert ist eine kommaseparierte Liste vollständiger Origins (Schema + Host + optional Port), ohne Pfad und ohne abschließenden Slash.

Beispiel für die **Staging-Umgebung** (Domains durch die tatsächliche Render-Staging-Domain ersetzen):

```text
https://<tatsaechliche-staging-domain>
```

Wenn das Secret fehlt, erlaubt der Code-Fallback ausschließlich localhost auf Port 3000. Eine Produktions- oder Staging-Domain wird niemals automatisch freigegeben. Deshalb muss `PFMS_ALLOWED_ORIGINS` in jedem Supabase-Projekt explizit gesetzt werden und alle Origins enthalten, von denen dessen Frontend aus die Functions aufruft.

Staging und Produktion sind getrennt zu konfigurieren. Das Secret enthält keine Zugangsdaten, gehört aber trotzdem nicht in den Quellcode.

## 2. Deploy-Reihenfolge

1. Tatsächliche Staging-URL und Staging-Supabase-Projekt-ID feststellen.
2. `PFMS_ALLOWED_ORIGINS` im **Staging-Supabase-Projekt** setzen.
3. Die Functions aus dem geprüften Feature-Branch in das Staging-Projekt deployen:
   - `username-login`
   - `r2-connection-check`
4. Login per E-Mail und Benutzername, fehlerhafte Anmeldedaten, unbekannte Origin und R2-Verbindungsprüfung testen.
5. Für den Owner-Bootstrap beide Datenbankmigrationen in dieser Reihenfolge anwenden: `20261115_pfms_platform_owner_bootstrap.sql`, danach `20261116_pfms_owner_bootstrap_registration_guard.sql`. Sie müssen **vor** der ersten Owner-Registrierung installiert sein, damit der Auth-Trigger die ursprüngliche Registrierungsart unveränderbar protokolliert.
6. Ein mindestens 40 Zeichen langes, kryptografisch zufälliges `PFMS_OWNER_BOOTSTRAP_TOKEN` ausschließlich als Supabase Function Secret setzen. Die Owner-Function deployen und den Inhaber-Claim mit einem frisch registrierten Testkonto (E-Mail bestätigt) prüfen.
7. Den Einmalcode niemals in GitHub, HTML, Browser-Konfiguration, Issue-Tracker oder Chat speichern. Nach erfolgreichem Claim das Secret entfernen oder rotieren.
8. Erst nach dokumentiertem Staging-Erfolg die Produktionskonfiguration getrennt prüfen und – nur nach ausdrücklicher Freigabe – deployen.

Beispielbefehl (Platzhalter vor Ausführung ersetzen):

```bash
supabase secrets set PFMS_ALLOWED_ORIGINS="https://<tatsaechliche-staging-domain>" --project-ref <STAGING_PROJECT_REF>
supabase functions deploy username-login --project-ref <STAGING_PROJECT_REF>
supabase functions deploy r2-connection-check --project-ref <STAGING_PROJECT_REF>
supabase functions deploy pfms-owner-bootstrap --project-ref <STAGING_PROJECT_REF>
```

## 3. Owner-Bootstrap-Secret

Vor dem Deploy der Owner-Function ist im Staging-Projekt ein kryptografisch zufälliger Wert mit mindestens 40 Zeichen als `PFMS_OWNER_BOOTSTRAP_TOKEN` zu setzen. Der Wert wird nur serverseitig gelesen und nie in der Datenbank gespeichert. Der registrierte Benutzer muss sich mit einer gültigen Supabase-Sitzung anmelden; die Function ermittelt die User-ID ausschließlich aus dem geprüften JWT. Die SQL-RPC nimmt nur Aufrufe mit `auth.role() = 'service_role'` an und erlaubt genau einen Claim. Die Migration `20261116_pfms_owner_bootstrap_registration_guard.sql` protokolliert die Wahl des Inhaberzugangs beim ursprünglichen `auth.users`-INSERT in einer gesperrten Tabelle. Eine spätere Änderung von `user_metadata` kann diese Berechtigung nicht nachträglich erzeugen.

```bash
supabase secrets set PFMS_OWNER_BOOTSTRAP_TOKEN="<mindestens-40-zeichen-zufaelliger-wert>" --project-ref <STAGING_PROJECT_REF>
```

Nach erfolgreicher Inhabereinrichtung das Secret löschen bzw. rotieren.

Die Owner-Registrierung muss nach Installation beider Migrationen neu erfolgen. Ein zuvor registriertes Konto erhält die unveränderbare Registrierungsmarkierung nicht rückwirkend.

## 4. Sicherheitsverhalten

- Origins außerhalb der Allowlist erhalten HTTP 403.
- Requests ohne `Origin`-Header werden für Server-zu-Server-Aufrufe zugelassen. Das ist keine Authentifizierung und ersetzt keine serverseitige Berechtigungsprüfung.
- `username-login` bleibt in `supabase/config.toml` bewusst `verify_jwt = false`, weil es die Login-Session erst aus Benutzername und Passwort erzeugt. Die Zugangsdaten werden im Function-Code validiert; der Aufruf darf keine administrativen Daten ausgeben.
- `r2-connection-check` nutzt weiterhin die Standard-JWT-Prüfung von Supabase.
- Die Origin-Allowlist ist kein Rate-Limit. Ein belastbarer Missbrauchsschutz für Username-Lookups und Login-Versuche bleibt eine gesonderte Aufgabe.

**Wichtig:** Diese Änderungen liegen im GitHub-Entwicklungszweig. Die aktuell deployed Functions sind damit noch nicht geändert.
