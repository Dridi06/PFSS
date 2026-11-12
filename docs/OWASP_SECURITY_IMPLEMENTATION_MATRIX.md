# PFSS – OWASP-Sicherheitsmatrix

Stand: 12.11.2026  
Geltungsbereich: Entwicklungsbranch `foundation/permissions-v1`

## Verbindliche Referenzbasis

- **OWASP ASVS 5.0.0, Zielniveau Level 2** als technische Verifikationsbasis. Für besonders schützenswerte Funktionen (Mandantentrennung, Auth, private Spielerdaten, Finanz- und Vertragsdaten) werden zusätzliche risikobasierte Prüfungen angesetzt. Die konkrete Anforderungsliste mit ASVS-IDs muss vor dem Sicherheitsreview aus der offiziellen Version 5.0.0 abgeleitet werden; hier werden bewusst keine ungeprüften Requirement-IDs erfunden.
- **OWASP Top 10:2025** als wiederkehrende Risiko-Orientierung (A01 Zugriffskontrolle, A02 Fehlkonfiguration, A03 Software-Lieferkette, A04 Kryptografie, A05 Injection, A06 unsicheres Design, A07 Authentifizierung, A08 Software-/Datenintegrität, A09 Logging/Alarmierung, A10 Ausnahmebehandlung).
- **OWASP Cheat Sheet Series** als Umsetzungshilfe für Login, Sessions, Zugriffskontrolle, Eingaben, Uploads, Kryptografie, Fehlerbehandlung und Logging.
- OWASP-Standards sind Prüfreferenzen, keine Zertifizierung und keine Sicherheitsgarantie.

## PFSS-Kontrollmatrix

| ID | PFSS-Fläche | Sicherheitsziel / Risiko | Technische Grundlage | Nachweis / Test | Stand |
|---|---|---|---|---|---|
| SEC-01 | Benutzername-Login | Brute Force, User Enumeration, Oversized Requests, CORS | POST only, JSON-Typprüfung, Request-Body-Limit, generische Fehler, no-store, Origin-Allowlist aus Function Secret | Unit-/Integrationstest für falsche/fehlende Felder, ungültiges JSON, große Payload, fremde Origin, wiederholte Fehlversuche | Teilweise: Code + atomarer Datenbank-RPC für IP und Username/IP-Paar vorbereitet; Migration/Integrationstest und Prüfung der vertrauenswürdigen IP-Header im Staging offen |
| SEC-02 | R2-Diagnose | Unberechtigter Status-/Infrastrukturzugriff | JWT-Prüfung, serverseitige Auth-Validierung, explizite Auth-User-ID-Allowlist, POST only, Origin-Allowlist | 401 ohne Token, 401 ungültiges Token, 403 Nicht-Admin, 200 Admin, fremde Origin ablehnen | Code vorbereitet; Function Secrets und Deploy-/Live-Test offen |
| SEC-03 | Scout-Spieler | Fremdzugriff auf Spielerprofile | RLS, owner_id = auth.uid() für Lesen/Schreiben | User A liest/ändert/löscht User B nicht; owner_id-Manipulation ablehnen | Migrationsentwurf gehärtet; DB-Test offen |
| SEC-04 | Scout-Berichte | Bericht und referenzierter Spieler müssen demselben Owner gehören | RLS plus EXISTS-Prüfung auf Spieler-Owner | Bericht mit fremder player_id lesen/anlegen/ändern/löschen ablehnen | Migrationsentwurf gehärtet; DB-Test offen |
| SEC-05 | Scout-Medienmetadaten | Fremde Spielerzuordnung verhindern | RLS plus Owner-Prüfung der optionalen player_id | Fremde player_id beim Insert ablehnen | Migrationsentwurf gehärtet; DB-Test offen |
| SEC-06 | Private Storage-Dateien | Fremde Objektpfade und öffentliche Freigabe verhindern | Privater Bucket, Owner-Ordner, Größen- und MIME-Beschränkung, keine anonyme Freigabe | SELECT/INSERT/DELETE über User-Ordnergrenzen testen; UPDATE explizit nicht freigegeben | Migrationsentwurf gehärtet; DB-Test offen |
| SEC-07 | Mandantenbeziehungen | Cross-Tenant-Fremdschlüssel verhindern | Composite Foreign Keys mit organization_id | Negative Integrationstests mit IDs verschiedener Organisationen | Migration vorhanden; Preflight und Datenintegritätsprüfung offen |
| SEC-08 | Rollen / Organisationen | Mehrere konkurrierende Rollenwahrheiten | Kanonisches Organisationsmodell, serverseitige Autorisierung | Rollenmatrix und API-/RLS-Negativtests | Offen |
| SEC-09 | Einladungen | Replay, Ablauf, Privilegieneskalation | gehashte Einmal-Codes, Ablauf-/Widerrufsstatus, rollenbeschränkte Ausgabe | gültig/abgelaufen/widerrufen/verbraucht/parallel eingelöst/unautorisierte Rolle | Offen |
| SEC-10 | Audit / Fehlerprotokolle | Geheimnisse und private Spieler-/Finanzdaten in Logs | Allowlist-basierte Ereignisfelder, Redaction, Zugriffsschutz, Aufbewahrungsplan | Log-Inhalt und Admin-Zugriff prüfen; Token-/Passwort-Testmarker dürfen nicht erscheinen | Teilweise: Edge-Fehlertexte reduziert; zentrale Logpipeline offen |
| SEC-11 | Abhängigkeiten / Frontend | Lieferkettenrisiko und unsichere CDN-Ressourcen | Version-Pinning, CSP, SRI oder kontrollierte Self-Hosting-Strategie | Dependency-Audit, CSP-Bericht, Integritätsprüfung aller externen Ressourcen | Offen |
| SEC-12 | Minderjährigendaten | Unzulässige Offenlegung oder überlange Speicherung | Datenminimierung, Zweckbindung, Freigabeprozesse, Lösch-/Aufbewahrungsregeln | Datenschutz-Folgen-/Risikoprüfung und Rollen-/Exporttests | Offen |
| SEC-13 | Finance / Verträge | Unautorisierte Buchungen, Gehalts-/Bank-/Vertragsdaten | RBAC/RLS, unveränderliche Buchungshistorie, Vier-Augen-Freigaben | Testbuchungen, Periodenabschluss, Korrekturen/Storno, Rechte- und Auditprüfung | Offen; UI ist Vorschau |
| SEC-14 | Backup / Restore | Datenverlust, unlesbare/ungeprüfte Sicherung | verschlüsselter pg_dump, versionierter R2-Zugriff, Integritätsprüfung | Restore in isolierte Testdatenbank und dokumentierter Wiederanlauf | Teilweise: Workflow vorhanden; Run und Restore offen |

## Notwendige Function-Secrets für die gehärteten Edge Functions

Diese Variablen gehören ausschließlich in die Supabase-Edge-Function-Secrets des jeweiligen Projekts. Keine dieser Werte darf in Git, Frontend-Code oder Logs eingetragen werden.

| Secret | Beispiel / Format | Zweck |
|---|---|---|
| `PFSS_ALLOWED_ORIGINS` | `https://pfss-staging.onrender.com,https://pfss-scouting.onrender.com` | Exakte Browser-Origin-Allowlist; pro Umgebung möglichst nur tatsächlich verwendete Hosts eintragen |
| `PFSS_R2_ADMIN_USER_IDS` | Kommagetrennte Supabase-Auth-UUIDs | Explizite Admin-Freigabe nur für die R2-Diagnosefunktion |
| `PFSS_RATE_LIMIT_HASH_SECRET` | Zufälliges Secret mit mindestens 32 Zeichen | HMAC-SHA-256-Pepper für IP- und Username/IP-Rate-Limit-Schlüssel; nur als Supabase Function Secret |
| `SUPABASE_PUBLISHABLE_KEYS` | Plattformseitig bereitgestelltes JSON-Key-Set | Public key für serverseitige Auth-Token-Prüfung |
| `SUPABASE_URL` | Projekt-URL | Supabase Auth API |
| `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` | Nur als Supabase Function Secrets | R2-Verbindungsprüfung |

**Wichtig:** Die Origin-Allowlist wird von beiden Edge Functions verwendet. Ohne `PFSS_RATE_LIMIT_HASH_SECRET` (mindestens 32 Zeichen) bleibt der Username-Login geschlossen (503), statt Rate-Limit-Schlüssel ungeschützt zu speichern. Ohne `PFSS_ALLOWED_ORIGINS` werden Browser-Origin-Requests absichtlich abgewiesen. Ohne `PFSS_R2_ADMIN_USER_IDS` bleibt die R2-Diagnosefunktion geschlossen (503). Die ID-Allowlist ist eine bewusste Übergangslösung bis das kanonische serverseitige RBAC-Modell abgenommen ist.

## Automatisierter passiver ZAP-Baseline-Scan

Der Workflow `.github/workflows/pfss-zap-baseline.yml` kann manuell gestartet werden. Das Ziel ist fest auf `https://pfss-staging.onrender.com/` begrenzt; es gibt keinen Eingabeparameter für eine fremde URL. Es wird ausschließlich der passive Baseline-Scan verwendet. Die GitHub Action ist per Commit-SHA (v0.15.0) gepinnt. Der Workflow wurde noch nicht ausgeführt; vor einer produktiven Freigabe sind Report, Findings und False Positives zu prüfen. Siehe außerdem `docs/BACKUP_RESTORE_RUNBOOK.md`: PostgreSQL-Dumps enthalten keine eigentlichen Supabase-Storage-Dateien. Aktive Scans sind nicht Bestandteil dieses Workflows.

## Offene Sicherheitsarbeit, die nicht durch statische Checks ersetzt werden kann

1. Username-Login: Die atomare Datenbank-RPC-Rate-Limit-Migration muss auf einem Testprojekt angewendet und parallel getestet werden. Die IP- und Username/IP-Limits sind im Code vorbereitet; keine In-Memory-Zähler in Edge-Instanzen.
2. Supabase-Preflight in der tatsächlichen Test-/Zielumgebung ausführen und exportieren.
3. Migrationsentwürfe nur auf einem getrennten Projekt anwenden und anschließend positive sowie negative RLS-Tests durchführen.
4. Organisationsmodell und Admin-Rollenquelle mit Live-Schema und Produktanforderungen abstimmen.
5. Einladungs-, Auth-, Upload-, Export- und Tenant-Negativtests automatisieren.
6. OWASP ZAP Baseline nur auf ausdrücklich freigegebenem, isoliertem Staging durchführen; aktive Scans erst nach Freigabe.
7. ASVS-5.0.0-Level-2-Anforderungen aus der offiziellen CSV übernehmen, PFSS-Modulen zuordnen und pro Anforderung Test-ID, Ergebnis, Commit und Restrisiko festhalten. Ein erstes Mapping mit 67 relevanten IDs liegt in `docs/ASVS_5.0_PFSS_REQUIREMENT_MAP.md`.
8. Externes Security-Review und Penetrationstest vor produktiver Freigabe.

## Referenzen

- OWASP ASVS 5.0: https://asvs.owasp.org/
- OWASP Top 10:2025: https://top10.owasp.org/2025/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- OWASP ZAP Docker User Guide: https://www.zaproxy.org/docs/docker/about/
