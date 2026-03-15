# Laboratorium

## Web 3D Scanner (Android)

Projekt znajduje się w katalogu `web-3d-scanner` i jest napisany w TypeScript.

### Szybki start

```bash
cd web-3d-scanner
npm install
npm run dev -- --host
```

W telefonie Android otwórz:

- `http://127.0.0.1:5173`

### Co robi aktualne MVP

- uruchamia kamerę (`getUserMedia`)
- wykrywa punkty ORB w kolejnych klatkach (OpenCV.js)
- dopasowuje cechy i estymuje ruch kamery (`findEssentialMat`, `recoverPose`)
- wykonuje triangulację i rysuje chmurę punktów 3D (Three.js)

### Uwaga

To jest wersja prototypowa. Najlepsze wyniki uzyskasz przy:

- dobrym oświetleniu
- obiekcie z teksturą (nie gładkie, jednolite powierzchnie)
- powolnym ruchu kamery