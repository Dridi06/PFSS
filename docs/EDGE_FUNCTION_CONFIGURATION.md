# PFMS Edge Function – Staging-Konfiguration

Diese Anleitung betrifft ausschließlich die Supabase-Edge-Functions. Die Functions werden nicht automatisch durch Änderungen am Frontend deployt.

## 1. CORS-Allowlist

Beide Functions `username-login` und `r2-connection-check` verwenden den gemeinsamen Helfer `supabase/functions/_shared/cors.ts`.

Die erlaubten Origins werden aus dem Supabase-Function-Secret `PFMS_ALLOWED_ORIGINS` gelesen. Der Wert ist eine kommaseparierte Liste vollständiger Origins (Schema + Host + optional Port), ohne Pfad und ohne abschließenden Slash.

Beispiel für die **Staging-Umgebung** (Domains durch die tatsächliche Render-Staging-Domain ersetzen):

```text
https://pfss-scouting.onrender.com,https://<tatsaechliche-staging-domain>
```

Wenn das Secret fehlt, gilt der Code-Fallback: bekannte Produktionsdomain sowie localhost auf Port 3000. Sobald das Secret gesetzt ist, ersetzt seine Liste den Fallback vollständig. Deshalb müssen in einem Projekt alle Origins aufgenommen werden, von denen dessen Frontend aus die Functions aufruft.

Staging und Produktion sind getrennt zu konfigurieren. Das Secret enthält keine Zugangsdaten, gehört aber trotzdem nicht in den Quellcode.

## 2. Deploy-Reihenfolge

1. Tatsächliche Staging-URL und Staging-Supabase-Projekt-ID feststellen.
2. `PFMS_ALLOWED_ORIGINS` im **Staging-Supabase-Projekt** setzen.
3. Die Functions aus dem geprüften Feature-Branch in das Staging-Projekt deployen:
   - `username-login`
   - `r2-connection-check`
4. Login per E-Mail und Benutzername, fehlerhafte Anmeldedaten, unbekannte Origin und R2-Verbindungsprüfung testen.
5. Erst nach dokumentiertem Staging-Erfolg die Produktionskonfiguration getrennt prüfen und – nur nach ausdrücklicher Freigabe – deployen.

Beispielbefehl (Platzhalter vor Ausführung ersetzen):

```bash
supabase secrets set PFMS_ALLOWED_ORIGINS="https://pfss-scouting.onrender.com,https://<tatsaechliche-staging-domain>" --project-ref <STAGING_PROJECT_REF>
supabase functions deploy username-login --project-ref <STAGING_PROJECT_REF>
supabase functions deploy r2-connection-check --project-ref <STAGING_PROJECT_REF>
```

## 3. Sicherheitsverhalten

- Origins außerhalb der Allowlist erhalten HTTP 403.
- Requests ohne `Origin`-Header werden für Server-zu-Server-Aufrufe zugelassen. Das ist keine Authentifizierung und ersetzt keine serverseitige Berechtigungsprüfung.
- `username-login` bleibt in `supabase/config.toml` bewusst `verify_jwt = false`, weil es die Login-Session erst aus Benutzername und Passwort erzeugt. Die Zugangsdaten werden im Function-Code validiert; der Aufruf darf keine administrativen Daten ausgeben.
- `r2-connection-check` nutzt weiterhin die Standard-JWT-Prüfung von Supabase.
- Die Origin-Allowlist ist kein Rate-Limit. Ein belastbarer Missbrauchsschutz für Username-Lookups und Login-Versuche bleibt eine gesonderte Aufgabe.

**Wichtig:** Diese Änderungen liegen im GitHub-Entwicklungszweig. Die aktuell deployed Functions sind damit noch nicht geändert.
