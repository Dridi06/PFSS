# PFMS – gezielte Staging-Härtung des RLS-Event-Triggers (16.11.2026)

## Befund
Der Staging-Security-Advisor meldete `public.rls_auto_enable()` als SECURITY DEFINER-Funktion mit EXECUTE-Recht für PUBLIC, anon und authenticated. Die Funktion wird vom aktiven Event Trigger `ensure_rls` nach CREATE TABLE / CREATE TABLE AS / SELECT INTO aufgerufen. Ein direkter Client-Aufruf ist für diese Funktion nicht erforderlich.

## Durchgeführte Änderung
Ausschließlich im Supabase-Staging-Projekt `oolvpbzbqiojioazsoun` ausgeführt:

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;
```

Keine anderen SECURITY DEFINER-Funktionen wurden pauschal verändert.

## Verifikation
- Event Trigger `ensure_rls` bleibt aktiviert (`evtenabled = O`).
- `anon` EXECUTE: false.
- `authenticated` EXECUTE: false.
- Eigentümer `postgres` EXECUTE: true.
- Ein kontrollierter DDL-Probelauf erzeugte innerhalb eines DO-Blocks eine kurzlebige Tabelle in `public`, prüfte, dass RLS automatisch aktiviert wurde, und entfernte die Tabelle anschließend erfolgreich.
- Security Advisor: Finding `anon_security_definer_function_executable` ist entfallen.
- Die übrigen 22 authenticated SECURITY DEFINER-Findings wurden nicht pauschal geändert; sie benötigen eine Einzelprüfung ihrer vorgesehenen Rollen- und Mandantenprüfungen.

## Sicherheitsgrenzen
- Änderung nur im Staging-Projekt; Produktion und `main` nicht berührt.
- Keine Test- oder Auth-Benutzer verändert.
- Keine Migration auf der gemeinsamen Staging-Datenbank angewandt.
- Diese gezielte ACL-Änderung muss vor einer späteren vollständigen Staging-Neuaufsetzung als geprüfte Schema-Härtung in die autorisierte Migrations-/Provisionierungsstrategie übernommen werden.
