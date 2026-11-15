# PFMS – Render-Staging-Abgleich (15.11.2026)

## Gesicherter Stand

- Repository: `Dridi06/PFSS`
- Entwicklungsbranch: `feature/pfss-complete-platform-build`
- Feature-HEAD beim letzten Checkpoint: `1aa564de5db5eed589e54b90b51726026e68b9c6`
- Bestehender Render-Dienst laut aktuellem Dashboard-Screenshot: **`pfss-staging`**
- Render-Typ: **Static Site**
- Verbundenes Repository: `Dridi06/PFSS`
- Tatsächlich konfigurierter Render-Branch: `foundation/permissions-v1`
- Live-Commit im Screenshot: `820367e` (vollständiger bekannter SHA: `820367ea871addfa27bac6d198367f210c8bcdd3`)
- Live-URL: `https://pfss-staging.onrender.com`
- Deployment-Steuerung im Screenshot: **Manual Deploy**
- Pull Request #1: Draft, Zielbranch `main`; nicht gemergt.
- CI für Feature-Checkpoint `1aa564de5db5eed589e54b90b51726026e68b9c6`: GitHub Actions Run `43763249121`, erfolgreich.
- Es wurde kein Render-Deployment und keine Supabase-Migration ausgelöst.

## Branch-Abgleich

Der Screenshot belegt, dass die bestehende Live-Staging-Site weiterhin den Branch `foundation/permissions-v1` ausliefert. Der aktuelle Entwicklungsbranch ist `feature/pfss-complete-platform-build`.

GitHub-Vergleich `foundation/permissions-v1...feature/pfss-complete-platform-build`:
- Status: diverged
- Feature-Branch voraus: 1.426 Commits
- Feature-Branch zurück: 145 Commits
- Gemeinsame Basis: `34b7a0f74dbddea225a9c1750f998e3c1c7ac5e8`

Die Branches dürfen nicht blind zusammengeführt, rebased oder in Render umgeschaltet werden. PR #1 zeigt auf `main`, ist Draft und wurde nicht freigegeben.

## Build- und Blueprint-Konfiguration des Entwicklungsbranches

Die Datei `render.yaml` auf dem Feature-Branch definiert derzeit:
- Blueprint-Service-Name: `pfms-staging-static`
- Runtime: `static`
- Deployment-Branch: `feature/pfss-complete-platform-build`
- Build: `npm run check:syntax && npm run build && npm run test:dist`
- Veröffentlichungsverzeichnis: `./dist`
- Auto-Deploy erst nach erfolgreichen Checks.

Der statische Build erwartet für Staging diese Variablennamen:
- `PFMS_BUILD_TARGET=staging`
- `PFMS_STAGING_PROJECT_REF` – exakte 20-stellige Projekt-Referenz
- `PFSS_SUPABASE_URL` – HTTPS-Projekt-URL, muss zur Projekt-Referenz passen
- `PFSS_SUPABASE_KEY` – ausschließlich Publishable-/Anon-Key; Secret- und Service-Role-Keys werden im Browser-Build ausdrücklich abgewiesen.

Keine Werte oder Secrets in GitHub/Chat eintragen. Insbesondere darf niemals ein Supabase Secret-/Service-Role-Key in eine statische Browser-App gelangen.

**Wichtige Abweichung zum Live-Dienst:** Das Dashboard zeigt den existierenden Dienst `pfss-staging`, nicht `pfms-staging-static`, und er verfolgt derzeit `foundation/permissions-v1`, nicht den Feature-Branch. Ein `render.yaml` wurde auf `foundation/permissions-v1` nicht gefunden. Ob der Live-Dienst blueprint-verwaltet ist, ist nicht belegt.

Daher darf `render.yaml` nicht blind synchronisiert und der Render-Branch nicht ohne weiteren Abgleich umgestellt werden. Eine falsche Blueprint-Synchronisierung könnte einen zusätzlichen Dienst anlegen oder den bestehenden Dienst unbeabsichtigt verändern.

## Nächste sichere Schritte

1. Im Render-Dashboard beim vorhandenen Dienst `pfss-staging` die Einstellungen für Repository, Branch, Build Command, Publish Directory und Blueprint-Verknüpfung abgleichen.
2. Die Environment-Variablennamen des bestehenden Dienstes prüfen; Werte/Secrets bleiben verborgen. Es muss eindeutig das dedizierte Staging-Supabase-Projekt sein.
3. Den Unterschied zwischen dem bestehenden Live-Branch und dem aktuellen Entwicklungsbranch bewusst auflösen; kein blindes Merge/Rebase.
4. Erst nach Prüfung die Blueprint-Datei passend zum bestehenden Dienst ausrichten. Keine Zugangsdaten oder Secrets in GitHub/Chat übertragen.
5. Build und CI vollständig abwarten.
6. Deployment ausschließlich auf dem bestehenden Dienst `pfss-staging` ausführen; Production und `main` unangetastet lassen.

## Sicherheitsgrenze

CI-Erfolg bestätigt nur die im Repository automatisierten Prüfungen. Er bestätigt weder die tatsächliche Render-Live-Konfiguration noch die Live-Supabase-Migrationshistorie, RLS-Laufzeit oder Mandantentrennung. Die dokumentierten read-only Staging-Audits und getrennten Rollen-/Tenant-Tests bleiben Release-Gates.
