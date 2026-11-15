# PFMS – Render-Staging-Abgleich (15.11.2026)

## Gesicherter Stand

- Repository: `Dridi06/PFSS`
- Entwicklungsbranch: `feature/pfss-complete-platform-build`
- Vorheriger Feature-HEAD: `359833ecb59ca12fa0ff2da3dd152e602a065dd9`
- Bestehender Render-Dienst laut Nutzerangabe: **Staging**
- Pull Request: #1, Draft, Zielbranch `main`; nicht gemergt.
- CI für den vorherigen Feature-HEAD: GitHub Actions Run `43759651108`, erfolgreich.
- Es wurde kein Render-Deployment und keine Supabase-Migration ausgelöst.

## Befund zur Branch-Integration

Der Feature-Branch basiert auf dem gemeinsamen Commit `34b7a0f74dbddea225a9c1750f998e3c1c7ac5e8` und weicht von `main` ab. GitHub meldet für den Vergleich mit `main` 1.425 Commits auf dem Feature-Zweig und 2 Commits Rückstand. Der offene Draft-PR ist laut GitHub als mergeable markiert, bleibt aber ausdrücklich nicht zur Zusammenführung freigegeben.

Die älteren Branches `foundation/permissions-v1` und `foundation/secure-platform-v1` sind keine geeignete Deployment-Basis für den aktuellen Feature-Stand. Keine automatische Zusammenführung oder Rebase durchführen.

## Render-Blueprint – noch nicht mit dem Dashboard abgeglichen

Die Datei `render.yaml` auf dem Feature-Branch definiert derzeit:
- Blueprint-Service-Name: `pfms-staging-static`
- Runtime: `static`
- Deployment-Branch: `feature/pfss-complete-platform-build`
- Build: Syntaxprüfung, statischer Build und Distributionstests
- Veröffentlichungsverzeichnis: `./dist`
- Auto-Deploy erst nach erfolgreichen Checks
- Staging-Umgebungsvariablen werden nicht im Repository gespeichert.

**Wichtige Abweichung:** Der tatsächliche vorhandene Render-Dienst heißt laut Nutzer **Staging**, nicht `pfms-staging-static`. Der tatsächliche Render-Service-Typ, seine Blueprint-Zuordnung, die verbundene Repository-URL und der aktuell konfigurierte Deployment-Branch konnten über die verfügbaren GitHub-Zugänge nicht im Render-Dashboard verifiziert werden.

Daher darf `render.yaml` noch nicht umbenannt oder mit „Sync Blueprint“ angewendet werden. Eine abweichende Service-Art oder ein nicht blueprint-verwalteter Dienst könnte sonst zu einem zweiten Dienst statt zur Aktualisierung des vorhandenen Dienstes führen.

## Nächste sichere Schritte

1. Im Render-Dashboard den vorhandenen Dienst **Staging** öffnen.
2. Nur diese Metadaten abgleichen: Service Type (Static Site oder Web Service), Repository, Branch und ob der Dienst von einem Blueprint verwaltet wird.
3. Erst nach diesem Abgleich die Blueprint-Datei passend aktualisieren. Keine Zugangsdaten oder Secrets in GitHub/Chat übertragen.
4. Sicherstellen, dass ausschließlich die Staging-Supabase-URL und der Staging-Publishable-Key verwendet werden.
5. Build und CI erneut vollständig abwarten.
6. Deployment ausschließlich auf dem vorhandenen Dienst **Staging** ausführen; Production und `main` unangetastet lassen.

## Sicherheitsgrenze

CI-Erfolg bestätigt nur die im Repository automatisierten Prüfungen. Er bestätigt weder die tatsächliche Render-Konfiguration noch die Live-Supabase-Migrationshistorie, RLS-Laufzeit oder Mandantentrennung. Die dokumentierten read-only Staging-Audits und getrennten Rollen-/Tenant-Tests bleiben Release-Gates.
