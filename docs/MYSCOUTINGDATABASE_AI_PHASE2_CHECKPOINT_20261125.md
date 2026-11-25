# myScoutingDatabase — KI-Ausbau / Phase-2-Checkpoint

Stand: 2026-11-25  
Arbeitszweig: `feature/asi-intelligence-platform`  
Aktueller geprüfter Commit: `cf0b027b41413fead7314de1da1fc2a3e4c49ecf`  
GitHub Actions Push-Run: `45540207513` — beide Jobs erfolgreich.

## Umgesetzte Produktfunktionen

1. **Datenintegration**
   - Scout-Beobachtungen werden als Eingabedaten verwendet.
   - Spieleranalysen werden als versionierte Snapshots in `asi_player_analyses` gespeichert.
   - Ausreichend belegte Entwicklungstrends werden als Prognosen in `asi_prediction_records` gespeichert.
   - Tatsächliche Ergebnisse können in `asi_prediction_outcomes` erfasst werden.
   - Kandidatenquellen werden im Kandidaten-Evidence-Ledger gespeichert.

2. **KI-Verknüpfung**
   - Ranking und Eignungsbewertung verwenden nur vorhandene Dimensionen.
   - Vergleich, Entwicklungstrend, Transfer-Screening und Scouting-Bericht sind mit dem KI-Labor verbunden.
   - Fehlende Dimensionen bleiben fehlend; der Vergleich zeigt Datenabdeckung.

3. **Benutzeroberfläche**
   - Neuer Bereich „KI-Labor“ mit Rankingübersicht, Einzelanalyse, Vergleich, Transfer-Screening, Bericht, Videoereignissen, Scout-Kalibrierung, Prognoseergebnis-Erfassung und Lernstatus.
   - Build kopiert die benötigten Engine-Module in `dist-myscoutingdatabase/asi-core` und korrigiert relative Imports.

4. **Video-/Ereignisanalyse**
   - Strukturierte Spielereignisse können mit Minute, Typ, Zone, Kontext und HTTPS-Quelle gespeichert werden.
   - Administratoren können Ereignisse mit Begründung verifizieren; Entscheidungen werden protokolliert.
   - **Keine automatische Computer-Vision-Erkennung aus Rohvideo**; derzeit nur manuell/external getaggte Ereignisse.

5. **Lernarchitektur**
   - Prognosen werden mit Datenstichtag, Modellversion, Prognoseintervall und Eingabemerkmalen gespeichert.
   - Ergebnisdatensätze starten unverifiziert.
   - Admin-Verifizierung verlangt HTTPS-Quelle und Begründung; bestätigte Outcomes schließen die Prognose als `observed`.
   - Regressionsevaluation zeigt MAE/RMSE erst ab Mindeststichprobe.
   - Lernvorschläge verlangen mindestens 30 verifizierte Paare und ausreichende Feature-Abdeckung; Änderungen werden nicht automatisch aktiviert.

6. **Sicherheit**
   - Neue Candidate-Evidence-, Video-, Kalibrierungs- und Outcome-Review-Tabellen haben RLS.
   - Player-Ownership wird bei Inserts in Beobachtungen, Analysen, Prognosen, Outcomes, Videoereignisse und Kalibrierungsdaten geprüft.
   - Admin-Prüfungen sind SECURITY INVOKER RPCs mit Audit-Einträgen.
   - Neue Foreign-Key-Indizes ergänzt; überlappende Admin-ALL-Policies bei neuen Tabellen reduziert.

7. **Release-/Qualitätsprüfung**
   - Syntax-, Projekt-Smoke- und Edge-Function-Typprüfungen bestanden im Push-Run `45540207513`.
   - Das ist ein CI-Nachweis, noch kein End-to-End-Abnahmetest im Browser oder eine Live-Bereitstellung.

## Auf staging ausgeführte Migrationen

- `20261125031000_asi_candidate_evidence_ledger.sql`
- `20261125043000_asi_intelligence_data_layer.sql`
- `20261125044500_asi_verified_prediction_outcomes.sql`
- `20261125050000_asi_intelligence_rls_index_hardening.sql`
- `20261125051500_asi_video_event_review.sql`
- `20261125053000_asi_prediction_outcome_lifecycle.sql`
- `20261125054500_asi_intelligence_player_scope.sql`
- `20261125055500_asi_candidate_evidence_fk_index.sql`

## Datenlage und ehrliche Grenzen

- Vorhandener Katalog: 26 Spieler.
- Vorhandene Scout-Beobachtungen: 79.
- Vorhandene Prognose-/Outcome-Datensätze vor Aktivierung der neuen Erfassung: 0.
- Deshalb existiert noch keine statistisch belastbare, trainierte Prognose-KI. Die Lernkomponente ist ein kontrollierter Vorschlags- und Evaluationspfad, kein bereits trainiertes ML-Modell.
- Automatische Rohvideoanalyse/Tracking ist nicht enthalten.
- Die Security Advisors melden weiterhin bestehende, geprüfte SECURITY DEFINER-Funktionen für Admin-Identitätsverwaltung bzw. eigenen Scout-Heartbeat/Login sowie deaktivierten Schutz gegen kompromittierte Passwörter. Zwei Mehrfach-Policy-Warnungen betreffen ältere Contract-/Evidence-Tabellen. Diese Punkte benötigen eine separate, gezielte Prüfung bzw. Auth-Einstellung.

## Nicht freigegebene Release-Arbeiten

- Repository ist weiterhin `Dridi06/PFSS`; eigenständiges GitHub-Repository für myScoutingDatabase fehlt.
- Eigenständiger Render-Staging-Service wurde nicht angelegt.
- Kein Livegang; bestehende PFMS-Produktion blieb unberührt.
- Noch erforderlich: unabhängiges Repository, bestätigter Render-Workspace, Browser-End-to-End-Tests mit Scout/Admin, Testdaten mit verifizierten Outcomes und reale Modellvalidierung.
