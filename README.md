# KIRMAS – Erhebungs-Editor (Vite + React + TypeScript)

**Features**
- Mehrseitige Erhebungen → Seiten → Bereiche → Blöcke → Felder
- Drag & Drop mit dnd‑kit (für alle Ebenen, Reordering innerhalb des Containers)
- Leaflet‑Geopicker (Klick setzt Marker, Marker ist draggable)
- Schlichtes CSS, an dein Mockup (#BA4A41 Header) angelehnt

## Systemvoraussetzungen
- **Node.js LTS (20 oder 22)**: https://nodejs.org
- **Visual Studio Code**
  - Empfohlene Extensions: ESLint, Prettier, TypeScript React

## Installation
```bash
npm install
npm run dev
```
Öffne anschließend `http://localhost:5173` im Browser.

## Build
```bash
npm run build
npm run preview
```

## Projektstruktur
```
kirmas-editor-vite/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ index.css
   └─ features/
      └─ editor/
         └─ KirmasEditor.tsx
```

## Nächste Schritte
- Cross‑Container Drag (Felder zwischen Blöcken verschieben)
- Eigenschaften‑Panel (Label/Name/Tooltip/Pflicht/Validierung/TabIndex)
- Schemas speichern/laden (API, z. B. FastAPI + PostgreSQL)
- Bedingte Sichtbarkeit mit Rule‑Builder
