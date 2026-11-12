# Fachmodule und Funktionskatalog

Legende: P0 zwingend für sichere Basis/MVP, P1 wichtig für professionellen Betrieb, P2 Ausbau, P3 spätere Innovation.

## Plattformkern
| Funktion | Priorität | Abnahmekriterium |
|---|---:|---|
| Anmeldung, Registrierung, Passwort-Reset | P0 | Authentifizierte Sessions, sichere Fehlerbehandlung |
| Nutzerprofil | P0 | Nutzer kann eigene Basisdaten verwalten |
| Organisationen und Mitgliedschaften | P0 | Zuordnung nur durch geprüfte Einladung/Autorisierung |
| Rollen und Berechtigungen | P0 | Server/RLS erzwingt Rechte unabhängig von UI |
| Organisationswechsel | P0 | Aktiver Mandant wird klar angezeigt und geprüft |
| Audit-Log | P1 | Kritische Änderungen sind nachvollziehbar |
| Benachrichtigungen | P2 | In-App-Hinweise mit Lesestatus |

## Scout
| Funktion | Priorität | Abnahmekriterium |
|---|---:|---|
| Privater Scout-Arbeitsbereich | P0 | Scout sieht nur eigene private Datensätze |
| Spielerprofil und Suche | P0 | Filter, Sortierung und Detailansicht funktionieren |
| Berichte und Bewertungen | P0 | Mehrere Berichte je Spieler, Autor und Datum nachvollziehbar |
| Shortlists/Favoriten | P1 | Eigene Listen verwalten |
| Beobachtungsaufträge | P1 | Status, Termin, Ort und Ergebnis dokumentieren |
| Medien | P2 | Private Uploads, Größen-/MIME-Prüfung und Rechtekontrolle |
| Videoanalyse | P3 | Erst nach Medien- und Rechtekonzept |

## Club
| Funktion | Priorität | Abnahmekriterium |
|---|---:|---|
| Vereinsprofil | P0 | Organisationsdaten mit Tenant-Isolation |
| Mannschaften und Saison | P0 | Teams und Saisons verwalten |
| Kader und Spielerzuordnung | P0 | Historisierte Zuordnungen statt Überschreiben |
| Trainer/Betreuer | P1 | Rollen und Teamzuordnung |
| Mitgliederverwaltung | P1 | Einladungen, Status, Rollen |
| Kalender und Aufgaben | P2 | Berechtigte Nutzer können Termine/Aufgaben pflegen |
| Club-Scouting | P2 | Berichte und Shortlists innerhalb des Clubs |

## Agency
| Funktion | Priorität | Abnahmekriterium |
|---|---:|---|
| Agenturprofil und Team | P0 | Organisations- und Mitgliederbasis |
| Spielerportfolio | P1 | Spielerbeziehungen und Zuständigkeiten |
| Kontakte und Netzwerk | P1 | Kontakte mit Zugriffsregeln |
| Aufgaben und Vorgänge | P1 | Zuständigkeit, Status, Frist und Verlauf |
| Transfer-Pipeline | P2 | Stufen, nächste Aktion und Historie |
| Vertrags-/Fristenübersicht | P2 | Metadaten und Erinnerungen; Dokumente separat absichern |

## Administration und Betrieb
| Funktion | Priorität | Abnahmekriterium |
|---|---:|---|
| Nutzer-/Organisationsübersicht | P0 | Nur autorisierte Admins |
| Rollen- und Einladungsverwaltung | P0 | Jede Änderung serverseitig geprüft |
| Audit und Supportwerkzeuge | P1 | Keine unkontrollierte Einsicht in private Scout-Notizen |
| Systemstatus und Fehlerprotokolle | P1 | Keine Secrets/unnötigen personenbezogenen Daten in Logs |
| Abrechnung | P3 | Erst nach Rechts-/Steuerprüfung und Freigabe |

Gemeinsame Qualitätsanforderungen: responsive Darstellung, verständliche leere Zustände, Lade-/Fehlerzustände, Tastaturbedienbarkeit, Eingabevalidierung, Datenschutz-Minimierung und nachvollziehbare Berechtigungen.
