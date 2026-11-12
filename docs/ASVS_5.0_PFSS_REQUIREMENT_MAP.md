# PFSS – OWASP ASVS 5.0.0 Anforderungszuordnung

Stand: 12.11.2026  
Branch: `foundation/permissions-v1`

## Quelle und Vorgehen

Diese Zuordnung basiert auf der **stabilen OWASP ASVS 5.0.0**-CSV. Das ausgewählte Ziel für PFSS ist Level 2; Anforderungen mit Level 1 sind darin enthalten. Anforderungen, die möglicherweise nicht verwendet werden (z. B. Cookie- oder `postMessage`-Controls), werden erst nach Bestandsaufnahme als „nicht anwendbar“ eingestuft. Die ASVS-Anforderungsebenen sind Mindeststufen, kein Nachweis, dass eine Funktion implementiert ist.

Offizielle Quellen: [ASVS Downloads / Stable Release 5.0.0](https://asvs.owasp.org/downloads/) · [OWASP/ASVS v5.0.0 CSV](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv)

**Statusbedeutung:** `Offen` = kein ausreichender Implementierungs-/Testnachweis; `Teilweise` = Code oder Design vorbereitet, aber Test/Live-Abnahme fehlt; `Nicht anwendbar – prüfen` = nur nach bestätigter Architekturentscheidung ausschließen.

## PFSS-relevante Anforderungen

Die Zusammenfassungen sind Arbeitsübersetzungen der Anforderungsziele. Für verbindliche Prüfung ist der originale Requirement-Text der ASVS-CSV maßgeblich.

| ASVS-ID | Level | Prüfziel in PFSS | Betroffene Flächen | Abnahme / Nachweis | Stand |
|---|---:|---|---|---|---|
| V1.1.1 | 2 | Eingabekanonisierung | Benutzernamen, IDs und Nutzdaten genau einmal normalisieren; vor Validierung dekodieren. | Tests mit Unicode, Escaping und mehrfach kodierten Eingaben. | Teilweise – Branch-Arbeit; Test offen |
| V1.1.2 | 2 | Ausgabe-Encoding | Unvertrauenswürdige Werte kontextgerecht ausgeben. | XSS-Test in Tabellen, Profilen, Notizen und Reports. | Teilweise – Branch-Arbeit; Test offen |
| V1.2.1 | 1 | HTML-/Attribut-Encoding | Dynamische Werte sicher in HTML- und Attributkontexten rendern. | Stored-/Reflected-XSS in Formularen und Suchergebnissen. | Teilweise – Branch-Arbeit; Test offen |
| V1.2.2 | 1 | URL-Encoding und Protokolle | Unvertrauenswürdige URL-Parameter kontextgerecht kodieren; nur sichere Protokolle zulassen. | Test `javascript:`/`data:` und manipulierte Redirect-/Medien-URLs. | Teilweise – Branch-Arbeit; Test offen |
| V1.2.3 | 1 | JavaScript-/JSON-Ausgabe | Dynamische Daten dürfen Script- oder JSON-Struktur nicht verändern. | Payloads mit Quotes, Backslashes und Script-Tags. | Teilweise – Branch-Arbeit; Test offen |
| V1.2.4 | 1 | SQL-/Datenbank-Injection | Datenbankzugriffe müssen parameterisiert oder gleichwertig geschützt sein. | Supabase/PostgREST/RPC-Eingaben und alle SQL-Funktionen prüfen. | Teilweise – Branch-Arbeit; Test offen |
| V1.3.1 | 1 | HTML-Sanitization | Falls Rich-Text-Eingaben vorgesehen werden, HTML mit sicherer Bibliothek bereinigen. | Upload-/Rich-Text-Felder auf Skript- und Event-Attribute testen. | Offen |
| V1.3.3 | 2 | Kontextbezogene Eingabebereinigung | Werte vor gefährlichen Ausgabekontexten begrenzen und validieren. | Grenzwerte und Kontextwechsel für freie Notizfelder testen. | Offen |
| V1.3.4 | 2 | SVG-Sanitization | Nutzer-SVGs dürfen keine Skripte oder aktiven Fremdinhalte einschleusen. | SVG-Upload mit `script`/`foreignObject` prüfen. | Offen |
| V1.3.6 | 2 | SSRF-Schutz | Serverseitige Abrufe nur gegen definierte Protokolle, Hosts und Pfade erlauben. | R2-/Import-/URL-Features gegen private IPs und fremde Hosts testen. | Offen |
| V1.5.2 | 2 | Sichere Deserialisierung | Unvertrauenswürdige serialisierte Daten restriktiv verarbeiten. | JSON-/Import-/Datei-Parser auf Typ- und Strukturgrenzen testen. | Offen |
| V2.1.1 | 1 | Dokumentierte Eingaberegeln | Struktur, Wertebereiche und Pflichtfelder fachlich dokumentieren. | Validierungsregeln pro Eingabeformular mit Testfällen hinterlegen. | Offen |
| V2.1.2 | 2 | Kombinierte Datenkonsistenz | Abhängige Felder gemeinsam prüfen, z. B. Geburtsdatum/Jahrgang oder Verein/Organisation. | Ungültige Feldkombinationen in API-Tests ablehnen. | Offen |
| V2.1.3 | 2 | Geschäftslogik-Limits | Pro Benutzer und global gültige Limits dokumentieren. | Upload-, Such-, Login-, Mitglieder- und Buchungs-Limits abgleichen. | Offen |
| V2.2.1 | 1 | Eingabevalidierung | Alle Eingaben serverseitig gegen Typ, Muster, Bereich und fachliche Regeln prüfen. | Negative API-Tests; Frontend-Prüfung gilt nicht als Schutz. | Teilweise – Branch-Arbeit; Test offen |
| V2.2.2 | 1 | Vertrauenswürdige Service-Schicht | Validierung muss serverseitig wirksam sein. | Manipulierte Browser-Requests und direkte RPC-Aufrufe testen. | Teilweise – Branch-Arbeit; Test offen |
| V2.2.3 | 2 | Kombinierte Feldvalidierung | Abhängige Werte müssen logisch zusammenpassen. | Cross-Field-Tests für Spieler, Mitgliedschaften, Verträge und Finanzen. | Offen |
| V2.3.1 | 1 | Ablauf-/Statusübergänge | Geschäftsprozesse dürfen keine Schritte überspringen oder fremde Nutzerkontexte vermischen. | Einladungen, Transfers, Verträge, Freigaben und Login-Reset testen. | Offen |
| V2.3.2 | 2 | Geschäftslogik-Limits | Dokumentierte Limits müssen in der Service-Schicht erzwungen werden. | Grenzwerte und Parallel-Request-Tests für knappe Ressourcen. | Offen |
| V2.3.3 | 2 | Transaktionssicherheit | Zusammengehörige Geschäftsaktionen müssen atomar gelingen oder zurückrollen. | Fehler-/Rollback-Tests für Einladungen, Buchungen und Überweisungsworkflows. | Offen |
| V2.4.1 | 2 | Anti-Automation | Automatisierte Überlastung, Datenabgriff und Quota-Verbrauch begrenzen. | Login-, Such-, Export-, Upload- und RPC-Rate-Limits testen. | Teilweise – Branch-Arbeit; Test offen |
| V3.2.2 | 1 | Sichere DOM-Ausgabe | Textinhalte als Text rendern, nicht als aktives HTML. | XSS-Payloads in allen dynamisch erzeugten Workspace-Ansichten testen. | Offen |
| V3.3.1 | 1 | Cookie-Secure-Attribut | Falls PFSS-Cookies nutzt, Secure und sichere Prefixes erzwingen. | Cookie-Inventar über alle relevanten Domains/Antworten erfassen. | Nicht anwendbar erst nach Prüfung |
| V3.3.2 | 2 | Cookie-SameSite | Cookie-SameSite passend zur Auth- und CSRF-Architektur setzen. | Auth- und CSRF-Tests in den tatsächlich verwendeten Browserflows. | Nicht anwendbar erst nach Prüfung |
| V3.3.4 | 2 | HttpOnly-Sitzungscookies | Nicht per JavaScript lesbare Tokens nur als HttpOnly-Cookies übertragen, soweit Cookie-Sessions genutzt werden. | Entscheiden/dokumentieren, ob Supabase-Session in Cookies oder Client Storage bleibt; Risiken testen. | Nicht anwendbar erst nach Prüfung |
| V3.4.3 | 2 | Content Security Policy | Strikte CSP mit `object-src 'none'`, `base-uri 'none'` und kontrollierten Quellen einführen. | CSP-Report-Only auf Staging, danach Enforcement und Inline-/CDN-Review. | Offen |
| V3.4.4 | 2 | MIME-Sniffing-Schutz | Alle HTTP-Antworten mit `X-Content-Type-Options: nosniff` absichern. | Response-Header im Staging und bei Datei-Downloads prüfen. | Offen |
| V3.4.5 | 2 | Referrer Policy | Technisch sensible Pfad- und Querydaten nicht an Dritte weitergeben. | Header/Meta-Policy und Analytics/CDN-Requests prüfen. | Offen |
| V3.4.6 | 2 | Frame-Ancestors | Einbettung standardmäßig per CSP `frame-ancestors` verhindern. | Staging-Header und Clickjacking-Test. | Offen |
| V3.5.5 | 2 | postMessage-Origin-Prüfung | Falls postMessage verwendet wird, Absender-Origin und Nachrichtenschema validieren. | Code-Suche und negative Origin-Tests. | Nicht anwendbar erst nach Prüfung |
| V3.7.2 | 2 | Externe Redirects | Weiterleitungen auf externe Hosts nur nach Allowlist zulassen. | Open-Redirect-Tests für Login-/Passwort-/Dateilinks. | Offen |
| V4.1.2 | 2 | HTTPS-Verhalten | Browserzugriff sicher auf HTTPS umstellen; Service-Endpunkte nicht unbemerkt fehlkonfigurieren. | Staging-HTTP/HTTPS- und TLS-Tests. | Offen |
| V4.1.3 | 2 | Intermediary-Header | Vom Proxy gesetzte Security-Header, insbesondere Client-IP, dürfen nicht vom Client überschrieben werden. | Cloudflare-/Supabase-Edge-Header in Staging prüfen; Spoofing via X-Forwarded-For ausschließen. | Offen |
| V4.2.1 | 2 | HTTP Request Boundaries | Proxy-/Server-Komponenten müssen HTTP-Nachrichtengrenzen korrekt behandeln. | Deployment-Proxy und Edge-Gateway-Konfiguration prüfen; Request-Smuggling-Scan. | Offen |
| V5.1.1 | 2 | Upload-Regeln | Erlaubte MIME-Typen, Erweiterungen, Größen und sichere Downloads dokumentieren. | Uploadmatrix je Foto/Video/Dokument samt Maximalgröße erstellen. | Offen |
| V5.2.1 | 1 | Upload-Größenlimit | Dateien nur in sicher verarbeitbaren Größen annehmen. | Grenzgrößen und Überlasttests. | Offen |
| V5.4.1 | 2 | Dateinamenvalidierung | Client-Dateinamen nicht vertrauen; Downloadnamen kontrollieren. | Path-Traversal, Steuerzeichen und manipulierte Content-Disposition testen. | Offen |
| V5.4.2 | 2 | Dateinamen-Encoding | Dateinamen in Headern und Anhängen sicher kodieren. | Sonderzeichen/CRLF in Downloadnamen prüfen. | Offen |
| V5.4.3 | 2 | Malware-Prüfung | Unvertrauenswürdige Dateien vor Auslieferung auf bekannte Schadsoftware prüfen. | Quarantäne-/AV-/Scannerprozess dokumentieren und im Staging testen. | Offen |
| V6.1.1 | 1 | Brute-Force-Schutz | Rate-Limits, Anti-Automation und Schutz vor gezielter Kontosperre dokumentieren. | IP- und Username/IP-Zähler mit parallelen Versuchen, Ablauf und Lockout-Tests. | Teilweise – Branch-Arbeit; Test offen |
| V6.1.3 | 2 | Mehrere Auth-Wege | Alle Login-Wege und deren Sicherheitsniveau gemeinsam dokumentieren. | E-Mail-, Username-, Reset- und Admin-Flows auf einheitliche Controls testen. | Offen |
| V6.2.1 | 1 | Passwort-Mindestlänge | Mindestlänge und Passwort-Policy sicher definieren. | Registrierung und Passwortänderung mit Grenzwerten testen. | Offen |
| V6.2.9 | 2 | Lange Passwörter | Passwörter bis mindestens 64 Zeichen akzeptieren. | Login-/Change-Password-Längen-Tests. | Offen |
| V6.2.12 | 2 | Kompromittierte Passwörter | Passwortänderungen gegen kompromittierte Passwortlisten prüfen. | Auth-Provider-Einstellung und Testkonten prüfen. | Offen |
| V6.3.3 | 2 | MFA / Authentifizierungsstärke | Starke Mehrfaktor-Absicherung für sensible Zugänge einführen oder begründete Kompensationsmaßnahmen dokumentieren. | MFA für Admins und sensible Rollen aktivieren und Recovery testen. | Offen |
| V6.3.4 | 2 | Einheitliche Authentifizierungswege | Keine undokumentierten Bypass-Loginwege; Sicherheitsniveau konsistent erzwingen. | Username-Login, E-Mail-Login, Reset und Supabase Dashboard-Auth vergleichen. | Offen |
| V6.4.3 | 2 | Passwort-Reset | Reset darf aktivierte MFA nicht umgehen. | Reset-/Recovery-Flow mit MFA und abgelaufenen Links testen. | Offen |
| V6.5.1 | 2 | Einmalcodes | Recovery-/Einladungscodes nur einmal verwendbar machen. | Replay- und parallele Double-Use-Tests für Einladungen und Codes. | Offen |
| V7.1.1 | 2 | Session-Lebensdauer | Inaktivitäts- und absolute Session-Laufzeit dokumentieren und passend konfigurieren. | Refresh-/Expiry-/Inaktivitätstests über Browser und API. | Offen |
| V7.1.2 | 2 | Parallelsitzungen | Maximale aktive Sessions und Verhalten dokumentieren. | Mehrgeräte-Login, Logout-all und Session-Revoke testen. | Offen |
| V7.2.1 | 1 | Backend-Tokenprüfung | Session-Tokens durch vertrauenswürdigen Backend-Dienst validieren. | Manipulierte/abgelaufene/widerrufene JWTs testen. | Offen |
| V7.2.2 | 1 | Dynamische Session-Tokens | Für Sitzungen dynamische Tokens statt statischer API-Geheimnisse nutzen. | Token-Lifecycle und Refresh-Mechanismus prüfen. | Offen |
| V8.1.1 | 1 | Autorisierungsregeln | Funktions- und datenbezogene Rechte serverseitig definieren. | Rollenmatrix und RLS/API-Negativtests für Scout/Verein/Agentur. | Teilweise – Branch-Arbeit; Test offen |
| V8.1.2 | 2 | Feldbezogene Rechte | Lesen und Schreiben einzelner Datenfelder rollen-/attributabhängig begrenzen. | Export-, Admin- und Minderjährigenfelder auf Field-Level-Zugriff prüfen. | Offen |
| V9.1.1 | 1 | JWT-Signaturprüfung | JWT-Signaturen vor Nutzung vertrauenswürdig validieren. | Manipulierte Signatur und falschen Schlüssel testen. | Offen |
| V9.2.1 | 1 | JWT-Laufzeitprüfung | `exp`/`nbf` bzw. Gültigkeitszeitraum beim Token akzeptieren prüfen. | Abgelaufene und noch nicht gültige Tokens ablehnen. | Offen |
| V11.1.1 | 2 | Schlüsselmanagement | Key-Lifecycle, Rotation, Zuständigkeiten und Minimierung geteilter Geheimnisse dokumentieren. | Supabase-/Cloudflare-/Backup-Key-Inventar und Rotationstest. | Offen |
| V11.2.1 | 2 | Kryptografie-Bibliotheken | Geprüfte, etablierte Bibliotheken für kryptografische Funktionen verwenden. | JWT-/Hash-/Backup-/Signaturimplementierungen und Abhängigkeiten prüfen. | Teilweise – Branch-Arbeit; Test offen |
| V12.1.1 | 1 | TLS-Versionen | Nur empfohlene TLS-Versionen aktivieren. | Staging-Endpunkte per TLS-Scanner prüfen. | Offen |
| V13.1.1 | 2 | Kommunikationsinventar | Alle internen und externen Kommunikationswege dokumentieren. | Supabase, Render, CDN, Cloudflare R2 und Browser-API-Datenflüsse inventarisieren. | Offen |
| V13.2.1 | 2 | Backend-Service-Authentifizierung | Service-zu-Service-Kommunikation mit individuellen Service-Identitäten/kurzlebigen Tokens sichern. | Edge Functions, RPCs und R2-Verbindungen auf Service-Role-/Secret-Verwendung prüfen. | Teilweise – Branch-Arbeit; Test offen |
| V14.1.1 | 2 | Datenklassifizierung | Sensible Daten und ihre Schutzstufen identifizieren, inkl. minderjähriger Spieler- und Finanzdaten. | Dateninventar und Zugriff-/Retention-/Exportmatrix erstellen. | Offen |
| V14.2.1 | 1 | Keine Geheimnisse in URLs | Sensible Werte, Tokens und Keys nur im Body/Header übertragen. | URL-/Query-/Referrer- und Browser-History-Tests. | Offen |
| V15.1.1 | 1 | Dependency-Update-Policy | Risikobasierte Behebungsfristen für verwundbare Komponenten definieren. | SLA nach Severity dokumentieren und Dependabot-/CodeQL-Befunde triagieren. | Offen |
| V15.2.1 | 1 | Dependency-Compliance | Keine Komponenten außerhalb der definierten Behebungsfristen einsetzen. | Dependency-Audit und Release-Gate. | Offen |
| V16.1.1 | 2 | Logging-Inventar | Logs je Schicht, Events, Formate, Speicherort, Zugriff und Aufbewahrung dokumentieren. | Audit-/Edge-/Render-/Supabase-Logs inventarisieren; sensible Werte redigieren. | Offen |
| V16.2.1 | 2 | Log-Metadaten | Logs müssen Zeit, Ort, Akteur und Aktion zur Untersuchung enthalten. | Testevent durch Logs verfolgen, ohne Tokens/Passwörter/Spielerdetails zu speichern. | Offen |

## Konkrete Abnahmeregeln

1. Alle Level-1- und Level-2-Anforderungen sind in den real verwendeten Funktionen durch Tests zu belegen. Level-3-Punkte bleiben risikobasiert für besonders kritische Geld-/Vertragsfreigaben oder privilegierte Aktionen zu bewerten.
2. Jeder Testnachweis muss Test-ID, Umgebung, Datum, Commit/Migrationsversion, Ergebnis und bekannte Einschränkungen enthalten.
3. SQL-/RLS-Tests mit mindestens zwei getrennten Testkonten und getrennten Organisationen ausführen. Positive und negative Zugriffe testen.
4. Keine Testdaten aus der Produktivumgebung kopieren, soweit nicht ausdrücklich datenschutzrechtlich und technisch freigegeben.
5. Cookies, WebSocket, postMessage, OAuth/OIDC, Upload- und weitere bedingte Anforderungen erst nach Inventarisierung auf Anwendbarkeit beurteilen; nicht stillschweigend aus dem Umfang entfernen.

## Derzeitiger Status

Der Code-Branch enthält bereits statische Prüfungen, eine gehärtete Login-Edge-Function, einen DB-basierten Rate-Limit-Entwurf, eine abgesicherte R2-Diagnosefunktion und eine eigentümergebundene Scout-RLS-Migration. Keine dieser Vorbereitungen ersetzt die Testmigration, Live-Runtime-Tests, RLS-Negativtests oder unabhängige Sicherheitsprüfung. Die Produktionsumgebung wurde nicht verändert.
