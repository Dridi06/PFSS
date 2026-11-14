# PFMS – Erste Plattforminhaberschaft einrichten (nur Staging)

Diese Anleitung richtet den ersten PFMS-Plattforminhaber ein. Sie gilt ausschließlich für eine getrennte **Staging-Umgebung**. Die Produktionsdatenbank und der Produktions-Edge-Function-Dienst dürfen dabei nicht verändert werden.

## Sicherheitsprinzip

Die Inhaberschaft wird nur einmal vergeben:
- Die Person registriert sich über den speziellen Zugang „PFMS-Plattforminhaber“.
- Sie bestätigt die E-Mail-Adresse und meldet sich an.
- In der ausstehenden Freigabe erscheint der gesonderte Einmalcode-Bereich nur dann, wenn die Datenbank den Besitzer noch nicht kennt.
- Die Edge Function prüft die Supabase-Sitzung serverseitig, verlangt eine bestätigte E-Mail-Adresse und den speziellen Registrierungsweg.
- Ein zusätzlicher, nur als Supabase-Function-Secret gespeicherter Einmalcode wird serverseitig verglichen.
- Die Datenbank vergibt die Admin-Rolle und schreibt den einzigen Owner-Datensatz in einer Transaktion.
- Existiert bereits ein freigegebener Administrator oder ist bereits ein Owner registriert, wird der Bootstrap verweigert. In einem solchen Bestand muss die Inhaberschaft nach Prüfung des vorhandenen Systems manuell und dokumentiert zugewiesen werden.

Das Token ist ein Inbetriebnahmeschlüssel, kein Passwort des Benutzers. Es gehört weder in GitHub noch in den Chat, in HTML, JavaScript oder SQL.

## 1. Staging eindeutig identifizieren

Vor Beginn:
1. Staging-Render-URL und Staging-Supabase-Projekt-ID feststellen.
2. Sicherstellen, dass das Supabase-Dashboard tatsächlich das Staging-Projekt zeigt.
3. In der Staging-Datenbank ein aktuelles Backup sicherstellen.
4. Die Datei supabase/STAGING_READ_ONLY_AUDIT.sql im SQL Editor der Staging-Datenbank vollständig ausführen.
5. Prüfen, ob es bereits freigegebene Admin-Profile, alte Organisationsdaten oder einen früheren Owner gibt. Wenn bereits ein freigegebener Administrator existiert, nicht versuchen, den Bootstrap zu erzwingen.

## 2. Migration prüfen und anwenden

Datei: supabase/migrations/20261115_pfms_platform_owner_bootstrap.sql

Vor Anwendung anhand der Audit-Ergebnisse prüfen, ob public.profiles und auth.users wie erwartet vorhanden sind und ob keine bestehende Owner-Struktur kollidiert.

Die Migration anschließend ausschließlich in Staging anwenden. Nach erfolgreicher Anwendung prüfen:
- Tabelle public.pfms_platform_owner existiert und RLS ist aktiviert.
- Direkte Tabellenrechte für anon und authenticated sind entzogen.
- pfms_owner_setup_available() meldet nur dann true, wenn kein Owner und kein freigegebener Administrator vorhanden ist.
- pfms_claim_initial_owner(uuid) ist nur für service_role ausführbar.

Keine Migration blind erneut über eine bereits angewendete Datenbankhistorie laufen lassen.

## 3. Staging-Edge-Function-Secrets setzen

Die folgende Function benötigt:
- PFMS_OWNER_BOOTSTRAP_TOKEN: zufälliger Einmalcode mit mindestens 40 Zeichen.
- PFMS_ALLOWED_ORIGINS: vollständige Origin-Liste, inklusive der tatsächlichen Staging-Render-Origin.
- die üblichen Supabase Runtime Secrets SUPABASE_URL, SUPABASE_PUBLISHABLE_KEYS und SUPABASE_SECRET_KEYS, wie sie in der bestehenden Edge-Function-Umgebung verwendet werden.

Beispiel zur lokalen Erzeugung eines starken Tokens (64 Hex-Zeichen):

    openssl rand -hex 32

Den erzeugten Wert in einem sicheren Passwortmanager oder Secrets-Manager zwischenspeichern und nur im **Staging-Supabase-Projekt** als Function-Secret PFMS_OWNER_BOOTSTRAP_TOKEN hinterlegen. Nicht in die Repository-Dateien oder in den Chat kopieren.

PFMS_ALLOWED_ORIGINS muss die tatsächliche Staging-Adresse enthalten, zum Beispiel:

    https://<tatsaechliche-staging-render-domain>

Da ein gesetztes PFMS_ALLOWED_ORIGINS den Fallback vollständig ersetzt, müssen alle Origins eingetragen werden, von denen die Staging-Anwendung die Functions aufruft.

## 4. Edge Functions in Staging deployen

Nur aus dem geprüften Feature-Branch deployen:

    supabase functions deploy pfms-owner-bootstrap --project-ref <STAGING_PROJECT_REF>
    supabase functions deploy username-login --project-ref <STAGING_PROJECT_REF>
    supabase functions deploy r2-connection-check --project-ref <STAGING_PROJECT_REF>

Vorher nochmals prüfen, dass der CLI-Link auf das Staging-Projekt zeigt. username-login bleibt bewusst ohne vorgeschaltete JWT-Pflicht, weil diese Funktion erst eine Sitzung erzeugt; sie validiert Eingaben und Zugangsdaten selbst. Die Owner-Funktion benötigt dagegen eine gültige angemeldete Sitzung.

## 5. Owner-Konto anlegen und aktivieren

1. Staging-PFMS öffnen.
2. Registrierung und Zugang „PFMS-Plattforminhaber“ auswählen.
3. Einen persönlichen Benutzernamen, eine E-Mail-Adresse und ein eigenes sicheres Passwort eintragen.
4. AGB/Datenschutz bestätigen und Registrierung abschließen.
5. E-Mail-Adresse bestätigen.
6. Mit dem registrierten Konto anmelden.
7. Auf dem Bildschirm „Freigabe ausstehend“ sollte – sofern der Datenbank-Check den Erstzugang freigibt – der Bereich „Plattforminhaberschaft aktivieren“ erscheinen.
8. Den geheimen Staging-Einmalcode dort eingeben. Er wird nur an die Edge Function gesendet; die Funktion akzeptiert keinen frei übermittelten User-Identifier, sondern verwendet die UID aus dem validierten JWT.
9. Nach erfolgreicher Aktivierung muss PFMS die Sitzung erneut prüfen und den Admin-Bereich öffnen.

## 6. Abnahme nach der Aktivierung

In Staging nachweisen:
- Genau ein Datensatz in public.pfms_platform_owner.
- owner_user_id entspricht dem angemeldeten Owner-Konto.
- Das zugehörige Profil hat role = 'admin' und status = 'approved'.
- Ein zweiter Claim wird mit Konflikt abgelehnt.
- Ein falscher/zu kurzer Einmalcode wird abgelehnt.
- Ein unbestätigtes E-Mail-Konto wird abgelehnt.
- Ein anderes Registrierungsprofil als owner_bootstrap wird abgelehnt.
- Ein nicht angemeldeter Aufruf wird abgelehnt.
- Ein bereits vorhandener freigegebener Administrator verhindert den Erst-Owner-Claim.
- Nach Abmeldung und erneutem Login bleibt der Owner-Zugang bestehen.

Erst nach den negativen und positiven Tests gilt der Owner-Bootstrap im Staging als abgenommen.

## 7. Nach erfolgreicher Einrichtung

Den einmaligen Bootstrap-Schlüssel aus den Staging-Function-Secrets entfernen, sobald der Owner erfolgreich aktiviert und der Test dokumentiert ist. Die konkrete Secret-Verwaltung muss im Staging-Projekt erfolgen; den Wert nicht wiederverwenden.

Danach mit dem Owner-Konto:
- normale Administratoren kontrolliert hinzufügen;
- separate Testkonten für Verein, Agentur, Scout, Trainer/Team und Mitglied registrieren;
- Rollen- und Mandantentrennung mit den Negativtests prüfen.

**Wichtig:** Der Owner-Bootstrap-Code und die Migration sind im Entwicklungszweig vorbereitet. Solange die Staging-Migration und die Edge Function nicht angewendet und die Abnahmetests nicht durchgeführt wurden, ist noch kein echter PFMS-Owner-Account eingerichtet. Es findet kein Produktionsdeployment statt.
