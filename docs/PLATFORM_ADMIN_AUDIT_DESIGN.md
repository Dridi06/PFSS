# PFMS – Plattformweite Administrator-Audit-Historie

Status: Konzept und technische Bestandsaufnahme – **nicht produktiv implementiert**.

## Befund in der Staging-Datenbank (read-only geprüft)

- Die globale Profiländerung läuft über `public.pfss_admin_update_profile(uuid,text,text)`.
- Die aktuell installierte Funktionsdefinition prüft den Plattformadministrator, validiert Rolle und Status, verhindert die Änderung des eigenen Kontos und aktualisiert `public.profiles`.
- Die Funktion schreibt dabei **keinen** Audit-Datensatz.
- `public.pfss_audit_log` existiert, ist aber organisationsbezogen: Die vorhandenen Schreibpfade protokollieren Mitgliedschafts- und Einladungsvorgänge mit einer Organisation. Die SELECT-/INSERT-Policies verlangen eine Organisationsmitgliedschaft mit passenden Rechten. Diese Tabelle ist daher kein geeigneter Ersatz für globale Plattform-Administratoraktionen.
- `public.pfms_system_events` ist für Frontend-Fehlerereignisse vorgesehen; seine Event-Typ- und RLS-Regeln dürfen nicht für Rollenänderungen umgangen werden.

## Zielbild

Eine eigene Plattform-Audit-Tabelle, beispielsweise `public.pfms_platform_admin_audit`, mit mindestens:

- unveränderliche ID und UTC-Zeitstempel,
- `actor_id` (aus `auth.uid()`, niemals aus Browser-Eingaben),
- `target_user_id`,
- Aktionstyp (z. B. `profile.role_status_updated`),
- `before_state` und `after_state` als begrenzte JSONB-Objekte mit ausschließlich Rolle und Status,
- optional eine kurze Begründung, falls später als Pflichtfeld beschlossen.

Keine E-Mail-Adressen, Passwörter, Tokens oder sonstigen Auth-Geheimnisse protokollieren.

## Transaktionssichere Umsetzung

Die bestehende `pfss_admin_update_profile`-RPC muss in einer kontrollierten Migration erweitert werden. Innerhalb derselben Datenbanktransaktion:

1. Administratorberechtigung serverseitig prüfen.
2. Zielprofil mit `SELECT ... FOR UPDATE` sperren.
3. erlaubte Rollen und Statuswerte prüfen und Selbständerung verhindern.
4. alten Zustand lesen; bei unverändertem Zustand ohne Audit-Eintrag beenden.
5. Profil aktualisieren.
6. Audit-Eintrag mit Actor aus `auth.uid()`, Ziel-ID sowie Vorher-/Nachher-Werten einfügen.
7. Fehler vollständig zurückrollen lassen, damit nie eine Rollenänderung ohne Audit-Eintrag committed wird.

Die Audit-Tabelle benötigt RLS/ FORCE RLS, keine direkten INSERT-/UPDATE-/DELETE-Rechte für Browserrollen und ausschließlich eine eng begrenzte Admin-Lese-RPC. Audit-Zeilen müssen unveränderlich bleiben. SECURITY DEFINER-Funktionen brauchen festen `search_path`, explizite ACLs und Tests für anon/authenticated/postgres.

## Release-Sperre

Es wird **keine Migration erstellt oder angewendet**, bevor die bekannte Staging-Migrationsledger-Abweichung und die kollidierenden Versionspräfixe abgeglichen und freigegeben sind. Die aktuelle UI weist deshalb ausdrücklich darauf hin, dass die globale Audit-Historie noch nicht verfügbar ist.

## Abnahmetests für die spätere Migration

- Nicht-Admin kann weder Audit lesen noch schreiben.
- Admin kann Audit lesen, aber vorhandene Einträge nicht ändern oder löschen.
- Zielprofiländerung und Audit-Eintrag committen atomar.
- Fehler beim Audit-Insert rollt auch die Profiländerung zurück.
- Actor wird ausschließlich aus `auth.uid()` bestimmt.
- Vorher-/Nachher-Zustände stimmen mit der tatsächlichen Änderung überein.
- Keine Änderung erzeugt keinen Audit-Eintrag.
- Selbständerung, ungültige Rollen/Status und fehlendes Zielprofil werden abgelehnt.
- Bestehende Organisations-Audit-Rechte und Systemereignis-Regeln bleiben unverändert.
