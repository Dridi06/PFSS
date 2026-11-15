# PFMS – Render-Staging-Abgleich (15.11.2026)

## Gesicherter Stand

- Repository: `Dridi06/PFSS`
- Entwicklungsbranch: `feature/pfss-complete-platform-build`
- Feature-HEAD beim letzten Checkpoint: `1aa564de5db5eed589e54b90b51726026e68b9c6`
- Bestehender Render-Dienst laut aktuellem Dashboard-Screenshot: **`pfss-staging`**
- Render-Typ: **Static Site** (im Screenshot ausdrücklich so ausgewiesen)
- Verbundenes Repository: `Dridi06/PFSS`
- Tatsächlich konfigurierter Render-Branch: `foundation/permissions-v1`
- Live-Commit im Screenshot: `820367e` (vollständiger bekannter SHA: `820367ea871addfa27bac6d198367f210c8bcdd3`)
- Live-URL: `https://pfss-staging.onrender.com`
- Deployment-Steuerung im Screenshot: Manual Deploy
- Pull Request: #1, Draft, Zielbranch `main`; nicht gemergt.
- CI für Feature-Checkpoint `1aa564de5db5eed589e54b90b51726026e68b9c6`: GitHub Actions Run `43763249121`, erfolgreich.
- Es wurde kein Render-Deployment und keine Supabase-Migration ausgelöst.

## Branch-Abgleich

Der Screenshot belegt, dass die bestehende Live-Staging-Site weiterhin den Branch `foundation/permissions-v1` ausliefert. Der aktuelle Entwicklungsbranch ist `feature/pfss-complete-platform-build`.

GitHub-Vergleich `foundation/permissions-v1...feature/pfss-complete-platform-build`:
- Status: diverged
- Feature-Branch voraus: 1.426 Commits
- Feature-Branch zurück: 145 Commits
- Gemeinsame Basis: `34b7a0f74dbddea225a9c1750f998e3c1c7ac5e8`

Daraus folgt: Die Branches dürfen nicht blind zusammengeführt, rebased oder in Render umgeschaltet werden. PR #1 zeigt auf `main`, ist Draft und wurde nicht freigegeben.

## Render-Blueprint – noch nicht mit dem Dashboard abgeglichen

Die Datei `render.yaml` auf dem Feature-Branch definiert derzeit:
- Blueprint-Service-Name: `pfms-staging-static`
- Runtime: `static`
- Deployment-Branch: `feature/pfss-complete-platform-build`
- Build: Syntaxprüfung, statischer Build und Distributionstests
- Veröffentlichungsverzeichnis: `./dist`
- Auto-Deploy erst nach erfolgreichen Checks
- Staging-Umgebungsvariablen werden nicht im Repository gespeichert.

**Wichtige Abweichung zum Live-Dienst:** Das Dashboard zeigt den existierenden Dienst `pfss-staging`, nicht `pfms-staging-static`, und er verfolgt derzeit `foundation/permissions-v1`, nicht den Feature-Branch. Ein `render.yaml` wurde auf `foundation/permissions-v1` nicht gefunden. Ob der Live-Dienst blueprint-verwaltet ist, ist nicht belegt.

Daher darf `render.yaml` nicht blind synchronisiert und der Render-Branch nicht ohne weiteren Abgleich umgestellt werden. Eine falsche Blueprint-Synchronisierung könnte einen zusätzlichen Dienst anlegen oder den bestehenden Dienst unbeabsichtigt verändern.

## Nächste sichere Schritte

1. Im Render-Dashboard beim vorhandenen Dienst `pfss-staging` die Einstellungen für Repository, Branch, Build Command, Publish Directory und Blueprint-Verknüpfung abgleichen.
2. Den Unterschied zwischen dem bestehenden Live-Branch und dem aktuellen Entwicklungsbranch bewusst auflösen; kein blindes Merge/Rebase.
3. Erst nach Prüfung die Blueprint-Datei passend zum bestehenden Dienst ausrichten. Keine Zugangsdaten oder Secrets in GitHub/Chat übertragen.
4. Sicherstellen, dass ausschließlich die Staging-Supabase-URL und der Staging-Publishable-Key verwendet werden.
5. Build und CI vollständig abwarten.
6. Deployment ausschließlich auf dem bestehenden Dienst `pfss-staging` ausführen; Production und `main` unangetastet lassen.

## Sicherheitsgrenze

CI-Erfolg bestätigt nur die im Repository automatisierten Prüfungen. Er bestätigt weder die tatsächliche Render-Live-Konfiguration noch die Live-Supabase-Migrationshistorie, RLS-Laufzeit oder Mandantentrennung. Die dokumentierten read-only Staging-Audits und getrennten Rollen-/Tenant-Tests bleiben Release-Gates.
