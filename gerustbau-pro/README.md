# Gerüstbau Pro

Eine mobile App für professionelle Gerüstbauer zur digitalen Aufmaß-Erfassung und automatischen Materialberechnung.

## Features

- **Projekt-Verwaltung** – Mehrere Baustellen anlegen, Status verfolgen (Entwurf → Aufnahme → Berechnung → Fertig)
- **Foto-Aufnahme** – Gebäudeseiten mit der Kamera fotografieren (Nord, Süd, Ost, West)
- **Maß-Annotation** – Direkt im Foto Maße einzeichnen (Breite, Höhe, Wandabstand, Öffnungen)
- **Messungen prüfen** – Manuelle Eingabe und Kontrolle aller Maße je Seite
- **Automatische Berechnung** – Algorithmus berechnet Felder, Lagen, Anker und Materialbedarf
- **SVG-Planansicht** – Gerüstplan als Vektorzeichnung (Maßstab 1:50) mit Layern
- **Materialliste** – Vollständige Stückliste nach Kategorie, mit Gewichten
- **PDF-Export** – Deckblatt, Planzeichnungen, annotierte Fotos und Stückliste als A4-PDF

## Unterstützte Gerüstsysteme

| System | Beschreibung |
|--------|-------------|
| Layher Allround | Modulgerüst mit Allround-Rosette |
| Layher Blitz | Stahlrohrgerüst Blitz-System |
| Tobler | Tobler Gerüste AG |

## Technologie

- **React Native** mit [Expo](https://expo.dev) (~55)
- **expo-router** für dateibasiertes Routing
- **react-native-paper** (Material Design 3)
- **Zustand** + AsyncStorage für lokale Datenpersistenz
- **expo-camera** für Fotoaufnahme
- **expo-print** + **expo-sharing** für PDF-Export
- **react-native-svg** für Planzeichnungen

## Lokale Entwicklung

```bash
cd gerustbau-pro
npm install
npx expo start
```

Dann mit Expo Go auf dem Gerät scannen oder im Simulator öffnen.

## Projektstruktur

```
gerustbau-pro/
├── app/                      # Expo Router Screens
│   ├── (tabs)/               # Tab-Navigation (Projekte, Einstellungen)
│   └── project/[id]/         # Projekt-Screens (Kamera, Annotation, Plan, Export)
├── src/
│   ├── algorithms/           # Berechnungslogik (Material, Plan, SVG)
│   ├── components/           # Wiederverwendbare Komponenten (AnnotationCanvas)
│   ├── data/                 # Gerüstsystem-Katalogdaten (Layher, Tobler)
│   ├── models/               # TypeScript-Typen
│   ├── pdf/                  # HTML/PDF-Generierung
│   ├── store/                # Zustand-Stores (Projekte, Einstellungen)
│   └── utils/                # Hilfsfunktionen (Formatter, Einheiten)
└── assets/                   # App-Icons, Splash
```

## Hinweis

Die berechneten Materialmengen sind Schätzwerte und müssen vom zuständigen Bauleiter vor Ort geprüft werden. Maßgeblich sind die anerkannten Regeln der Technik (DIN EN 12810, DGUV R 100-001).
