# UI-/UX-Designsystem

## Visuelle Richtung
Premium-Fußballsoftware: Anthrazit/Schwarz als Grundfläche, Gold als gezielter Akzent, klare Typografie, ruhige Karten, präzise Tabellen und hohe Informationsdichte ohne visuelle Überladung.

## Farbrollen
| Token | Zweck | Richtwert |
|---|---|---|
| Background | Hauptfläche | #090A0C |
| Surface | Karten/Navigation | #141619 |
| Surface Elevated | Dialoge/aktive Flächen | #1B1E21 |
| Text Primary | Haupttext | #F2F0EA |
| Text Secondary | Hilfstext | #9A9DA1 |
| Accent Gold | Primärakzent | #C6A15B |
| Border | Trennlinien | rgba(198,161,91,.18) |
| Success | Erfolg | gedecktes Grün |
| Warning | Warnung | gedecktes Amber |
| Danger | Fehler/destruktive Aktion | gedecktes Rot |

Farben sollen über CSS-Variablen zentral verwaltet werden, nicht in jedem Modul neu erfunden werden.

## Layoutregeln
- Desktop: feste/klappbare Seitenleiste, klare Inhaltsbreite, konsistente Kopfzeile.
- Mobile: kompakte Navigation, ausreichend große Touch-Ziele, keine horizontalen Überläufe.
- Tabellen: auf Mobilgeräten in Karten oder horizontal kontrollierbare Tabellenansicht überführen.
- Formulare: einheitliche Feldhöhen, Label-Abstände und Validierungszustände.
- Aktionen: Primäraktion pro Bereich klar erkennbar; destruktive Aktionen bestätigen.
- Jede Seite enthält einen nachvollziehbaren Rückweg zum Dashboard oder übergeordneten Bereich.

## Wiederverwendbare Komponenten
Buttons, Inputs, Selects, Date-Range, Filterleisten, Datenkarten, Status-Badges, Tabellen, Pagination, Empty States, Skeletons, Toasts, Dialoge, Breadcrumbs, Tabs und Bestätigungsdialoge.

## UX-Zustände
Jede datengetriebene Ansicht benötigt Loading, Empty, Success, Error, No Permission und Offline/Retry (wo sinnvoll).

## Accessibility
Semantische Überschriften, sichtbarer Tastaturfokus, Labels, ausreichender Kontrast, Tastaturbedienbarkeit, verständliche Fehlermeldungen und keine Statusvermittlung ausschließlich über Farbe.

## Responsive Abnahme
Mindestens 390px, 768px, 1024px und 1440px Breite prüfen. iOS Safari und Android Chrome berücksichtigen.
