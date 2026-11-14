# PFMS – Backup prüfen und isoliert wiederherstellen

Diese Anleitung beschreibt ausschließlich eine Wiederherstellung in eine **neue, isolierte Testdatenbank**. Sie ist keine Freigabe und keine Anleitung zur Wiederherstellung in Produktion.

## 1. Voraussetzungen

- Zugriff auf das Cloudflare-R2-Backup-Bucket.
- PostgreSQL-Werkzeuge `pg_restore` und `psql` sowie AWS CLI.
- Die korrekte Backup-Passphrase aus einem sicheren Secret-Manager.
- Eine frisch bereitgestellte, isolierte PostgreSQL-/Supabase-Testdatenbank ohne produktive Daten.

Folgende Werte müssen sicher als Umgebungsvariablen bereitgestellt werden:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET_NAME`
- `PFSS_BACKUP_ENCRYPTION_PASSPHRASE`
- `RESTORE_DATABASE_URL` – ausschließlich die Verbindungs-URL der neu angelegten Testdatenbank.

Passwörter und URLs nicht in Befehlszeilen, Chat, GitHub-Dateien oder Shell-Verlauf eintragen.

## 2. Verschlüsseltes Backup herunterladen und prüfen

Den konkreten Dateinamen aus dem R2-Backup-Verzeichnis einsetzen:

```bash
set -euo pipefail
umask 077

BACKUP_FILE='pfss-db-<UTC-Zeitstempel>.dump.enc'
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

aws s3 cp \
  "s3://$R2_BUCKET_NAME/database/daily/$BACKUP_FILE" \
  "$WORK_DIR/$BACKUP_FILE" \
  --endpoint-url "$R2_ENDPOINT" \
  --region auto \
  --only-show-errors

test -s "$WORK_DIR/$BACKUP_FILE"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$WORK_DIR/$BACKUP_FILE" \
  -out "$WORK_DIR/restore.dump" \
  -pass env:PFSS_BACKUP_ENCRYPTION_PASSPHRASE

pg_restore --list "$WORK_DIR/restore.dump" >/dev/null
```

Der letzte Befehl liest die Archivstruktur. Er verändert keine Datenbank.

## 3. Ausschließlich in die neue Testdatenbank wiederherstellen

Vor der Wiederherstellung sicherstellen, dass `RESTORE_DATABASE_URL` auf die neu angelegte, leere Testdatenbank zeigt. Projekt-Referenz und Hostname anhand des Staging-Dashboards prüfen.

```bash
pg_restore \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --dbname "$RESTORE_DATABASE_URL" \
  "$WORK_DIR/restore.dump"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "select count(*) as auth_users from auth.users;" \
  -c "select count(*) as profiles from public.profiles;"
```

Wichtige Grenzen:

- Kein `--clean`, `--create` oder `--if-exists` verwenden.
- Niemals eine Produktions- oder Live-Datenbank als Ziel verwenden.
- Bei Rollen-, Extension- oder Schemafehlern abbrechen und die Ursache untersuchen. Keine Tabellen manuell löschen, um den Restore zu erzwingen.
- Zeilenzahlen sind nur Plausibilitätsprüfungen und kein Beweis für vollständige fachliche Konsistenz.
- Ein PostgreSQL-Dump enthält keine Binärdateien aus Supabase Storage. Private Storage-Objekte müssen gegebenenfalls separat aus dem zugehörigen Storage-Backup wiederhergestellt werden.

## 4. Fachliche Abnahme nach dem Restore

In der isolierten Umgebung mindestens prüfen:

1. Auth-Benutzer und Profile sind vorhanden und die IDs passen zusammen.
2. Legacy-Organisationen und Mitgliedschaften sind vorhanden; das zusätzliche `pfms_organizations`-Modell wird separat ausgewertet.
3. Teamzuordnungen, Rollen und die acht Team-Berechtigungsbereiche sind vorhanden.
4. Spieler, Scoutingberichte, private Medien-Metadaten und Storage-Objekte sind konsistent.
5. RLS-Policies und `EXECUTE`-Grants entsprechen dem Staging-Read-only-Audit.
6. Ein Testkonto ohne Berechtigung kann keine fremden Organisations-, Team- oder Medienressourcen lesen oder ändern.

## 5. Nachweis

Datum, Backup-Dateiname, Zielprojekt-Referenz, Ergebnis von `pg_restore`, Plausibilitätsprüfungen und festgestellte Abweichungen dokumentieren. Keine Passphrase, Datenbank-URL, Access-Keys oder personenbezogene Daten in den Nachweis aufnehmen.

Erst nach einem erfolgreichen Restore-Test darf das Backup als wiederherstellbar bewertet werden. Der Upload und die Prüfung eines R2-Objekts allein sind kein Restore-Nachweis.
