# PFSS – Backup- und Restore-Handbuch

Stand: 12.11.2026  
Geltungsbereich: PFSS-Datenbank-Backup nach Cloudflare R2

## Wichtige Grenzen

- Der bestehende GitHub-Workflow erstellt einen PostgreSQL-Custom-Dump mit `pg_dump --format=custom --no-owner --no-acl`.
- Die Datei wird mit OpenSSL AES-256-CBC, Salt, PBKDF2 und 600.000 Iterationen verschlüsselt und unter `database/daily/` in Cloudflare R2 gespeichert.
- Der Workflow prüft aktuell, dass das Objekt in R2 existiert (`head-object`). Das beweist noch nicht, dass eine vollständige Entschlüsselung und Wiederherstellung funktioniert.
- **Supabase Storage-Dateien (z. B. Spielerfotos und Videos) sind nicht im PostgreSQL-Dump enthalten.** Datenbankmetadaten zu Storage-Objekten sind nicht die Dateien selbst. Für Storage-Inhalte wird eine gesonderte Sicherung benötigt.
- Ein verschlüsselter Upload ist erst nach einem erfolgreichen Restore-Test eine belastbare Sicherung.

## Secret-Anforderungen

Nur in GitHub Actions Secrets speichern, niemals in Git, Frontend, Issue oder Log:
- `PFSS_DATABASE_URL`: Datenbankverbindungs-URL des beabsichtigten Backup-Projekts.
- `PFSS_BACKUP_ENCRYPTION_PASSPHRASE`: starkes, zufällig erzeugtes Verschlüsselungs-Passwort.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`: R2-Zugang mit minimal erforderlichen Rechten.

Die genaue Zielumgebung und Berechtigungen der bestehenden Secrets müssen vor dem ersten Lauf geprüft werden. Es ist aus dem Repository allein nicht feststellbar, ob `PFSS_DATABASE_URL` auf Staging oder Produktion zeigt.

## Wiederherstellung ausschließlich in einer isolierten Testumgebung

1. Ein separates, leeres Supabase-Testprojekt oder eine isolierte PostgreSQL-Testdatenbank bereitstellen. Niemals die Produktionsdatenbank als Restore-Ziel verwenden.
2. Die R2-Objektliste prüfen und eine konkrete, datierte Datei aus `database/daily/` auswählen.
3. Mit einem nur lesenden R2-Zugang die verschlüsselte Datei herunterladen:
   ```bash
   aws s3 cp "s3://$R2_BUCKET_NAME/database/daily/$BACKUP_FILE" "./$BACKUP_FILE" \
     --endpoint-url "$R2_ENDPOINT" --region auto
   ```
4. Passphrase interaktiv oder aus einem geschützten Secret beziehen. Nicht in die Shell-History schreiben oder per `echo` ausgeben:
   ```bash
   export BACKUP_ENCRYPTION_PASSPHRASE
   openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 600000 \
     -in "$BACKUP_FILE" -out pfss-restore-test.dump \
     -pass env:BACKUP_ENCRYPTION_PASSPHRASE
   unset BACKUP_ENCRYPTION_PASSPHRASE
   ```
5. Archiv prüfen, bevor es wiederhergestellt wird:
   ```bash
   pg_restore --list pfss-restore-test.dump > pfss-restore-contents.txt
   ```
6. Ausschließlich in die leere Testdatenbank wiederherstellen:
   ```bash
   pg_restore --exit-on-error --no-owner --no-acl \
     --dbname "$RESTORE_DATABASE_URL" pfss-restore-test.dump
   ```
7. Ergebnis fachlich und technisch prüfen:
   - erwartete Schemas, Tabellen, Views und Extensions;
   - erwartete Funktionen, Trigger und Foreign Keys;
   - RLS-Status, Policies, Grants und Storage-Bucket-Metadaten;
   - stichprobenartige Zeilenanzahlen ohne produktive Personendaten auszugeben;
   - Login, Rollen, Organisationsgrenzen und zentrale Lese-/Schreibvorgänge in der isolierten Umgebung.
8. Restore-Protokoll mit Datum, Backup-Datei, Commit/Schema-Stand, Testumgebung, Fehlern und Ergebnis speichern. Testdatenbank und temporäre Dumps anschließend sicher löschen.

## Noch nicht abgedeckt / offene Arbeit

- Keine automatische Restore-Pipeline vorhanden; kein tatsächlicher Restore-Test dokumentiert.
- Keine gesonderte Sicherung der Supabase-Storage-Dateiobjekte implementiert.
- Der Backup-Workflow prüft derzeit Existenz, aber keinen unabhängigen kryptografischen Integritätsnachweis der verschlüsselten Datei.
- Aufbewahrungs-/Lifecycle-Regeln, Wiederherstellungsziele (RPO/RTO), Schlüsselrotation und regelmäßige Restore-Intervalle sind nicht festgelegt.
- Kein Nachweis, ob die bestehenden GitHub Secrets vorhanden sind oder auf das vorgesehene Projekt zeigen.

## Freigaberegel

Weder ein manueller Backup-Lauf noch ein Restore darf ohne bestätigte Zielumgebung und isolierte Testdatenbank gestartet werden. Keine Produktionsmigration, kein Produktions-Restore und keine produktiven Datenänderungen im Rahmen dieses Handbuchs.
