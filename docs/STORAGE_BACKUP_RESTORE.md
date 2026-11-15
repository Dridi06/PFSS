# PFMS – Supabase-Storage-Backup und isolierter Restore

Dieses Dokument definiert den sicheren Zielprozess für die im Entwicklungszweig erkannten Uploads. Es ist eine technische Betriebsplanung, **kein bereits eingerichteter oder ausgeführter Backup-Dienst**. Es werden keine Storage-Objekte gelesen, kopiert, gelöscht oder verändert.

## 1. Im Repository belegter Umfang

Die bisher geprüften Migrationen und Frontendmodule verwenden einen gemeinsamen privaten Supabase-Storage-Bucket:

- Bucket-ID: `pfss-scout-private`; die Bucket-Konfiguration setzt `public = false`.
- Erlaubte Upload-Typen: JPEG, PNG, WebP, HEIC sowie MP4, QuickTime und WebM.
- Maximale Dateigröße: 50 MiB.
- Private Scout-Dateien verwenden den Pfad `<user-id>/<dateiname>`; die Metadaten liegen in `public.pfss_scout_media`.
- Die persönliche Haupt-Medienbibliothek verwendet denselben Bucket unter `<user-id>/main/<dateiname>`; Metadaten liegen in `public.pfms_main_media`.
- Beide Frontendbereiche laden Dateien in diesen Bucket hoch und verwenden signierte URLs für die Anzeige. Die Datenbank enthält Pfad- und Dateimetadaten, nicht den Dateiinhalt.

Die geprüften Quellstellen sind insbesondere:

- `supabase/migrations/20261112_private_scout_workspaces.sql`
- `supabase/migrations/20261114_scout_workspace_integrity.sql`
- `supabase/migrations/20261117_pfms_main_media_library.sql`
- `supabase/migrations/20261209_pfss_scout_workspace_isolation_hardening.sql`
- `app.js` und `scout-workspace.js`

Dies ist der Umfang der hier geprüften Implementierung, kein Nachweis, dass im tatsächlichen Supabase-Projekt keine weiteren Buckets existieren. Vor dem ersten Lauf muss das Staging-Storage-Inventar read-only ermittelt und mit dieser Liste abgeglichen werden.

## 2. Sicherheitsanforderungen für die spätere Sicherung

1. **Nur dediziertes Staging zuerst:** Der erste technische Probelauf darf ausschließlich gegen das bestätigte Staging-Projekt erfolgen. Projekt-Referenz und Storage-Host müssen vor dem Lauf explizit geprüft werden.
2. **Serverseitige Zugangsdaten:** Ein eventuell erforderlicher Supabase-Service-Role-Key darf ausschließlich als geschütztes GitHub-Secret in einem vertrauenswürdigen serverseitigen Workflow verwendet werden. Niemals in Browser-Konfiguration, Frontend-Build, Logs, Artefakte oder Repository-Dateien übernehmen.
3. **Nur lesender Quellzugriff:** Der Backup-Prozess listet und lädt Objekte herunter. Er darf keine Quellobjekte löschen, verschieben, überschreiben oder ACL-/Bucket-Einstellungen verändern.
4. **Private Daten bleiben privat:** Keine öffentlichen URLs erzeugen und keine Dateien in öffentliche Buckets kopieren. Dateinamen und Pfade können personenbezogene oder vertrauliche Informationen enthalten; auch das Manifest muss verschlüsselt bzw. geschützt abgelegt werden.
5. **Integrität pro Objekt:** Für jedes Objekt mindestens Bucket-ID, exakter Storage-Pfad, MIME-Typ, Byte-Größe und SHA-256-Prüfsumme erfassen. Die tatsächlich heruntergeladenen Bytes müssen gegen die Prüfsumme geprüft werden.
6. **Vollständigkeit nachweisen:** Rekursive Pagination beim Auflisten verwenden. Anzahl und Gesamtbytes der gelisteten, heruntergeladenen und gesicherten Objekte vergleichen. Unlesbare Objekte, Pagination-Fehler, Größenabweichungen oder Hashfehler brechen den Lauf ab.
7. **Verschlüsselung vor Upload:** Archiv bzw. Objektpaket und Manifest vor dem Upload verschlüsseln und authentifizieren. Schlüsselmaterial getrennt vom R2-Speicher in einem Secret-Manager verwahren. Keine Klartextdateien als GitHub-Artefakt oder dauerhafte Runner-Datei veröffentlichen.
8. **Getrennter R2-Namensraum:** Storage-Backups erhalten einen eigenen Präfix, beispielsweise `storage/daily/`; sie dürfen nicht mit `database/daily/` verwechselt werden. Die R2-Zugriffsrechte sollen auf die erforderlichen Objekte und Aktionen beschränkt sein.
9. **Retention und Schutz:** Aufbewahrungsdauer, Versionierung bzw. Schutz vor versehentlichem Löschen und ein unabhängiger Wiederherstellungsweg müssen vor produktivem Betrieb festgelegt werden.
10. **Kein automatisches Löschen:** Ein Backup-Lauf darf niemals Quellobjekte bereinigen. Auch ein Restore darf keine bestehenden Zielobjekte überschreiben oder löschen.

## 3. Datenbank- und Storage-Backup gemeinsam bewerten

Der PostgreSQL-Dump enthält die Metadatenzeilen, aber nicht die Binärdateien aus Supabase Storage. Ein belastbarer Wiederherstellungspunkt besteht daher aus zueinander passenden Datenbank- und Storage-Sicherungen.

Der Backup-Lauf sollte beide UTC-Zeitstempel bzw. eine gemeinsame Backup-ID in ihren geschützten Manifesten festhalten. Der Restore muss danach prüfen:

- Jede Metadatenzeile aus `pfss_scout_media` und `pfms_main_media` verweist auf ein vorhandenes Objekt im erwarteten privaten Bucket.
- Jeder gesicherte Objektpfad ist zulässig und gehört zum erwarteten UID-Ordner bzw. zum `main/`-Unterordner.
- Es gibt keine unaufgeklärten fehlenden Objekte oder verwaisten Metadaten.
- MIME-Typ und Dateigröße stimmen mit den Metadaten überein.
- Die SHA-256-Prüfsumme der wiederhergestellten Bytes stimmt mit dem geschützten Manifest überein.

Ein Objekt ohne Metadaten darf nicht automatisch gelöscht werden: Es muss zunächst als möglicher Altbestand, Upload-Rest oder noch nicht zugeordnete Datei untersucht werden.

## 4. Isolierter Restore – Zielablauf

1. Ein neues, leeres und isoliertes Supabase-Testprojekt bereitstellen. Projekt-Referenz und Zielhost unabhängig prüfen.
2. Passendes Datenbank-Backup und Storage-Backup anhand ihrer gemeinsamen Backup-ID auswählen.
3. Verschlüsselte Archive und Manifeste herunterladen; Authentizität und Prüfsummen **vor** der Entschlüsselung prüfen.
4. Datenbank gemäß `docs/BACKUP_RESTORE.md` ausschließlich in die neue Testdatenbank wiederherstellen.
5. Storage-Objekte ausschließlich in den privaten Bucket des isolierten Testprojekts übertragen. UID-Pfade unverändert erhalten; keine öffentlichen Buckets oder öffentlichen URLs verwenden.
6. Vorhandene Zielobjekte nicht überschreiben. Bei Pfadkonflikten abbrechen und den Konflikt untersuchen.
7. Objektanzahl, Bytes, SHA-256-Prüfsummen und Datenbank-Metadaten gegeneinander abgleichen.
8. Mit getrennten Testkonten positiv und negativ prüfen: Eigentümer kann eigene Medien lesen; fremde Konten können diese nicht lesen; signierte URLs funktionieren nur im vorgesehenen Berechtigungsfenster.
9. Ergebnisse, Abweichungen, Backup-ID, Zielprojekt-Referenz und Prüfsummenprotokoll dokumentieren. Keine Zugangsdaten oder unnötigen personenbezogenen Daten in den Nachweis aufnehmen.

## 5. Implementierte Vorprüfung (nur Dry-Run)

Das Skript `scripts/storage-staging-preflight.py` prüft vor einer späteren Inventarisierung die explizite Staging-Freigabe und die kanonische Übereinstimmung von `PFMS_STAGING_PROJECT_REF` und `PFSS_SUPABASE_URL`.

Ein Lauf ist nur mit allen folgenden Angaben möglich:

- `PFMS_STORAGE_BACKUP_TARGET=staging`
- `PFMS_STORAGE_BACKUP_ALLOW_STAGING=1`
- `PFMS_STAGING_PROJECT_REF` mit exakt 20 Kleinbuchstaben/Ziffern
- `PFSS_SUPABASE_URL=https://<projekt-ref>.supabase.co`
- Aufruf ausschließlich mit `--dry-run`

Beispiel für einen lokalen, rein lesenden Konfigurationscheck:

```sh
PFMS_STORAGE_BACKUP_TARGET=staging \\
PFMS_STORAGE_BACKUP_ALLOW_STAGING=1 \\
PFMS_STAGING_PROJECT_REF=abcdefghijklmnopqrst \\
PFSS_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co \\
python3 scripts/storage-staging-preflight.py --dry-run
```

Das Skript führt ausdrücklich **keine Netzwerkverbindung** aus, liest keine Zugangsschlüssel und listet oder verändert keine Storage-Objekte. Es ist nur eine Schutzschicht für die spätere Implementierung, keine Bestätigung, dass das angegebene Projekt tatsächlich das PFMS-Staging-Projekt ist. Diese Identität muss unabhängig im Supabase-Projektkonto verifiziert werden.

## 6. Implementierter Inventarisierungskern (offline getestet)

Die reine Traversierungslogik liegt in `scripts/storage_inventory.py`. Sie nimmt eine Seitenabruf-Funktion entgegen und erledigt selbst keine Netzwerkaufrufe. Damit lassen sich rekursive Ordner und Pagination isoliert testen, bevor ein Supabase-Adapter überhaupt verbunden wird.

Der Kern ist zusätzlich gegen unkontrollierten Ressourcenverbrauch begrenzt: standardmäßig höchstens 100.000 Objekte, 10.000 Listenseiten und 32 Ordnerebenen. Die Grenzwerte sind beim Aufruf konfigurierbar, aber selbst ebenfalls nach oben begrenzt. Überschreitungen führen zum Abbruch und nicht zu einem scheinbar vollständigen Teilergebnis.

Der Kern:

- besucht Unterordner rekursiv und sortiert das Ergebnis nach Objektpfad;
- fordert bei vollständig gefüllten Seiten die nächste Offset-Seite an;
- prüft ungültige Pfadsegmente, doppelte Objektpfade und fehlerhafte Metadaten;
- erfasst Pfad, Größe und MIME-Typ, ohne Dateiinhalt herunterzuladen;
- bricht bei strukturellen Fehlern ab, statt ein unvollständiges Inventar als vollständig auszugeben.

Zusätzlich erzeugt `build_inventory_manifest()` eine deterministische Zusammenfassung mit Objektanzahl, Gesamtbytes und SHA-256 über die kanonisch sortierte Metadatenliste. Ein Manifest wird verweigert, wenn auch nur eine Dateigröße unbekannt oder ungültig ist. Größen werden als ganzzahlige Bytewerte behandelt.

Die Regressionstests `tests/storage-inventory-core-smoke.py` verwenden ausschließlich lokale Testdaten. Sie prüfen verschachtelte Ordner, mehrseitige Ergebnisse, Sortierung, ungültige Pfade, Duplikate, fehlerhafte Größenangaben, deterministische Manifeste sowie Objekt-, Seiten- und Tiefenlimits.

### Injizierter Supabase-Adapter (offline getestet)

`scripts/storage_supabase_adapter.py` ergänzt den Traversierungskern um einen Adapter für den Supabase-Storage-Listing-Endpunkt. Er baut den POST-Aufruf mit `prefix`, `limit`, `offset` und stabiler Namenssortierung auf. Der HTTP-Transport wird zwingend von außen injiziert; das Modul importiert keinen HTTP-Client und baut selbst keine Verbindung auf.

Sicherheitsprüfungen vor Erzeugung des Adapters:

- Projekt-URL muss exakt zum angegebenen 20-stelligen Projekt-Ref passen und HTTPS verwenden.
- Es wird ausschließlich der bekannte private Bucket `pfss-scout-private` akzeptiert.
- Ein Publishable-/Anon-Key sowie ein JWT mit `authenticated`-Rolle sind erforderlich; erkannte `service_role`-Tokens werden abgewiesen.
- Der Adapter führt keine Token-Ausgabe und kein Logging von Headern aus. Transportfehler werden ohne möglicherweise vertrauliche Request-Details weitergegeben.
- Ungültige Präfixe, Limits und Offsets werden vor dem Transportaufruf abgewiesen.

Die Prüfung des JWT-Rollenfelds ist nur eine zusätzliche Schutzschicht und ersetzt keine Signaturprüfung. Supabase muss das Token weiterhin serverseitig verifizieren. Der Benutzer benötigt passende Storage-Leserechte; das Inventar ist dann auf den sichtbaren Berechtigungsumfang beschränkt.

`tests/storage-supabase-adapter-smoke.py` verwendet einen Fake-Transport und prüft Request-Form, Host-/Bucket-Grenzen, Token-Rollen-Guard und ungültige Parameter. Es wird kein Netzwerkzugriff ausgeführt.

**Wichtige Grenze:** Der Adapter ist vorbereitet und offline getestet, aber noch nicht gegen ein reales Supabase-Projekt ausgeführt. Es wurden weder Zugangsdaten verwendet noch Objekte aufgelistet.

## 7. Offline-Archivkern mit Integritätsprüfung und Restore (neu)

Das Modul `scripts/storage_archive.py` erstellt aus einem bereits lokal bereitgestellten Objektbestand und dem vollständigen Inventar ein deterministisches, unkomprimiertes TAR-Archiv. Es führt selbst keine Downloads aus und besitzt keinen Netzwerktransport.

- Das Manifest enthält Formatversion, festen privaten Bucket, sortierte relative Objektpfade, Byte-Größen, MIME-Typen und SHA-256 je Datei.
- Vor dem Archivieren werden Pfade, Duplikate, lokale Dateiexistenz, Symlinks, Größen und Gesamtvolumen geprüft. Das Archiv wird zunächst temporär geschrieben und anschließend atomar an seinen Zielpfad verschoben.
- `verify_archive` liest alle Einträge und prüft Manifest, Dateitypen, exakte Objektmenge, Größen und SHA-256, ohne Dateien zu extrahieren.
- `restore_archive` akzeptiert ausschließlich ein leeres Zielverzeichnis. Absolute Pfade, Traversal, Symlinks, Duplikate, unerwartete Einträge und Überschreiben vorhandener Dateien werden abgewiesen.
- Standardgrenzen: maximal 100.000 Objekte und 10 GiB Gesamtinhalt. Diese Grenzen können beim Funktionsaufruf weiter eingeschränkt werden.
- Die CLI stellt zunächst nur `verify` und `restore` bereit. Die Erstellung erfolgt über die injizierbare Python-Funktion, damit der spätere Download-Adapter separat und testbar bleibt.

`tests/storage-archive-smoke.py` prüft Paketierung, Round-trip in ein leeres temporäres Verzeichnis, leeres Inventar, manipulierte Bytes, unsichere Pfade, Duplikate, Größen- und Objektlimits sowie das Verbot des Überschreibens. Der Test nutzt ausschließlich lokale Dateien und TAR-Testdaten.

**Wichtige Grenze:** Dieses Archiv ist noch Klartext. Vor jeglicher dauerhaften Ablage oder Übertragung muss es mit dem bestehenden, separat geprüften Verschlüsselungs-/HMAC-Prozess geschützt werden. Es wurde weder ein Supabase-Download noch ein R2-Upload oder ein produktiver Restore ausgeführt.

## 8. Authentifizierte Verschlüsselung des Storage-Archivs (neu)

`scripts/storage_archive_crypto.py` ergänzt die Archivierung um einen lokalen Verschlüsselungs- und Entschlüsselungsschritt. Es verwendet dieselbe etablierte Kombination wie der bestehende Datenbank-Backup-Prozess:

- OpenSSL AES-256-CBC mit Salt, PBKDF2 und 600.000 Iterationen.
- HMAC-SHA-256 über den Chiffretext mit der bestehenden domain-separierten Schlüsselableitung aus `backup-hmac.py`.
- Bei der Entschlüsselung wird das HMAC-Manifest zwingend **vor** dem OpenSSL-Entschlüsselungsaufruf geprüft.
- Fehlerausgaben aus OpenSSL/HMAC werden nicht ungefiltert ausgegeben, damit keine vertraulichen Details aus Prozessausgaben durchsickern.
- Quellarchive bleiben unverändert; bestehende Zielarchive/Manifeste werden nicht überschrieben. Temporäre Dateien werden nach dem Lauf entfernt.
- Das Passwort wird ausschließlich aus `PFSS_BACKUP_ENCRYPTION_PASSPHRASE` gelesen; es wird nicht als CLI-Argument übergeben.

Aufruf lokal nach Erstellung eines TAR-Archivs:

```sh
python3 scripts/storage_archive_crypto.py encrypt backup/storage.tar backup/storage.tar.enc
python3 scripts/storage_archive_crypto.py decrypt backup/storage.tar.enc backup/storage.tar.enc.hmac backup/storage-restored.tar
python3 scripts/storage_archive.py verify backup/storage-restored.tar
```

`tests/storage-archive-crypto-smoke.py` prüft den Round-trip, falsches/ manipuliertes HMAC, Chiffretext-Manipulation und das Verbot des Überschreibens. Die Tests nutzen lokale temporäre Dateien und benötigen OpenSSL; sie greifen nicht auf Supabase oder R2 zu.

**Kryptografische Einordnung:** Das Verfahren folgt dem bestehenden Datenbank-Backup-Standard und schützt den Chiffretext durch HMAC. AES-CBC ist kein AEAD-Verfahren; die Authentizität wird daher durch den separaten HMAC vor der Entschlüsselung gewährleistet. Ein späterer Algorithmuswechsel muss für Datenbank- und Storage-Backups gemeinsam geplant und getestet werden.

## 9. Noch nicht umgesetzt bzw. nicht nachgewiesen

- Kein Storage-Backup-Workflow und kein Storage-Backup-Skript sind mit dieser Planung eingerichtet.
- Kein tatsächliches Bucket-Inventar des Supabase-Projekts wurde abgerufen; der Adapter wurde ausschließlich mit einem Fake-Transport getestet.
- Kein Storage-Objekt wurde heruntergeladen, verschlüsselt oder nach R2 übertragen.
- Kein Storage-Restore oder Eigentümer-/Fremdzugriffstest wurde ausgeführt.
- Die tatsächliche Größe, Objektzahl, R2-Aufbewahrung und Wiederherstellungsdauer sind unbekannt.

Bis diese Punkte im isolierten Staging erfolgreich nachgewiesen sind, darf PFMS nicht als vollständig Storage-gesichert oder vollständig wiederherstellbar bezeichnet werden.
