# myScoutingDatabase — KI-Ausbau Checkpoint (25.11.2026, aktualisiert)

## Scope and safety
- Produkt: ausschließlich myScoutingDatabase.
- Dedicated Supabase staging project: `vxtybjaabtfhxfwctnyj` (Frankfurt).
- Keine Produktionsänderungen und kein Produktionsdeployment.
- Videoanalyse ist auf ausdrücklichen Wunsch pausiert; keine weitere Videoentwicklung in diesem Arbeitsabschnitt.
- Quellcode liegt weiterhin im Legacy-Repository `Dridi06/PFSS`, Branch `feature/asi-intelligence-platform`. Eigenständiges Repository und unabhängiger Render-Staging-Dienst bleiben Release-Blocker.

## Sechs Arbeitsbereiche

1. **Verifizierte Spielerdaten**
   - Scout-Beobachtungen werden mit Spieler, Ersteller, Bewertungsdimensionen und Beobachtungsdatum gespeichert.
   - Prognosen speichern einen unveränderlichen Merkmals-Snapshot in `explanation.features` sowie `input_cutoff_at`, Modellversion und Prognosehorizont.
   - Nutzerergebnisse bleiben zunächst `pending`; nur Admin-Prüfung mit HTTPS-Quelle kann sie verifizieren.
   - Staging-Datenstand der letzten Prüfung: 0 Prognosen, 0 Ergebnisse, 0 verifizierte Ergebnisse.

2. **ML-Trainingspipeline**
   - Standardisierte Ridge-Regression mit chronologischem Train/Holdout-Split.
   - Mindestens 50 verifizierte, vollständige Prognose-Ergebnis-Paare; mindestens 30 Trainings- und 10 Holdout-Fälle.
   - Mindestens drei Merkmale mit mindestens 80 % Abdeckung.
   - Fehlende numerische Werte (insbesondere SQL-NULL) werden nicht als 0 interpretiert.
   - Baseline-Wert muss vorhanden und im gültigen Bereich 0–100 sein.
   - Modellkandidat muss im zeitlichen Holdout die MAE-Baseline um mindestens 2 % verbessern.

3. **Prognosevalidierung und Schutz vor Datenlecks**
   - Ergebnis kann in der Oberfläche erst ab Ablauf des Prognosehorizonts eingetragen werden.
   - Die Datenbank-RPC prüft zusätzlich serverseitig: gleiche Zielkennzahl, Wert 0–100, HTTPS-Quelle und Ablauf des Prognosehorizonts.
   - Training schließt Ergebnisse aus, die vor `featureSnapshotAt + horizonDays` liegen.
   - Train/Test werden chronologisch getrennt; Datensatz-Fingerprint, MAE, RMSE, Bias, Samplegrößen und Zeitfenster werden gespeichert.
   - Alters-/Positionskohorten und unabhängiger Saison-Holdout bleiben zusätzliche Qualitätsanforderungen.

4. **Modellmanagement**
   - Kandidaten werden mit Konfiguration, Koeffizienten, Trainingslauf und Fingerprint gespeichert.
   - Admin-Freigabe/ Ablehnung mit Begründung und Audit-Tabelle.
   - Freigabe nur bei bestandener Evaluation; vorher aktives Modell wird erst im kontrollierten Freigabevorgang auf `retired` gesetzt.
   - Keine automatische Aktivierung.

5. **Tests und Qualität**
   - Unit-/Smoke-Tests für ML-Training, chronologische Trennung, fehlende Werte und Prognosehorizont erweitert.
   - GitHub Actions Workflow `myScoutingDatabase isolated checks` prüft Syntax, KI-Verträge und isolierten Build.
   - Letzter Lauf vor Fixture-Korrektur: Fehler in ML-Testfixture, weil neue Pflichtfelder für Feature-Stichtag/Horizont noch nicht gesetzt waren.
   - Fixture wurde korrigiert; neuer Lauf #17 war bei letzter Prüfung noch in Bearbeitung. Erfolg ist noch nicht bestätigt.

6. **Staging-Release und Betrieb**
   - Neue Datenbankmigration `20261125070000_asi_prediction_horizon_validation.sql` wurde erfolgreich auf dem dedizierten Staging-Projekt angewendet.
   - RPC bleibt `SECURITY INVOKER`; search_path ist fest gesetzt.
   - Noch kein unabhängiger Render-Staging-Dienst, kein Browser-E2E und kein Live-Release.
   - Vor Release muss myScoutingDatabase vom Legacy-PFSS/PFMS-Repository getrennt werden; PFMS-Produktivsystem bleibt unberührt.

## Aktueller Daten- und Modellstatus
- Prognosen: 0
- Ergebnisdatensätze: 0
- Verifizierte Ergebnisse: 0
- Aktive Modellversionen: 1 (bestehende Version)
- Modellkandidaten: 0
- Wegen fehlender Trainingsdaten kann derzeit kein belastbares neues ML-Modell trainiert werden.

## Nächste technische Schritte
1. CI-Lauf #17 abschließen und verbleibende Fehler beheben.
2. In der Staging-Anwendung Prognosen erzeugen und nach Ablauf des Horizonts belegte Ergebnisse erfassen/verifizieren.
3. Outcome-Workflow und ML-Training mit realen Testdaten end-to-end prüfen.
4. Kohortenvalidierung und unabhängigen Saison-Holdout ergänzen.
5. Eigenständiges Repository und separaten Render-Staging-Dienst bereitstellen, ohne PFMS/Produktion anzufassen.
