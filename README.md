# 3D Skaner - Mobilne Skanowanie

Aplikacja webowa do skanowania obiektów kamerą smartfona i tworzenia modeli 3D.
Zaprojektowana jako mobile-first PWA, działa bezpośrednio w przeglądarce Android.

## Technologie

- **Three.js** - renderowanie chmury punktów 3D z kontrolkami dotykowymi (OrbitControls)
- **OpenCV.js** - detekcja cech ORB, dopasowywanie, macierz istotna, triangulacja
- **WebRTC** - dostęp do kamery urządzenia (getUserMedia)
- **TypeScript + Vite** - narzędzia deweloperskie i budowanie
- **PWA** - manifest umożliwiający instalację na ekranie głównym

## Funkcje

| Zakładka | Opis |
|----------|------|
| **Skanuj** | Podgląd kamery z guideiem, przycisk migawki do zdjęć, tryb skanowania na żywo |
| **Galeria** | Siatka miniatur zdjęć, usuwanie pojedynczych, przetwarzanie wsadowe par zdjęć |
| **Model 3D** | Widok 3D z kontrolkami dotykowymi (obrót / zoom / przesuwanie), eksport PLY/OBJ |
| **Opcje** | Regulacja interwału, progu dopasowania i limitu dopasowań na klatkę |

## Szybki start

```bash
cd web-3d-scanner
npm install
npm run dev -- --host
```

Otwórz w telefonie Android adres wyświetlony w terminalu (np. `http://192.168.x.x:5173`).

## Tryby pracy

### Zdjęcia + przetwarzanie wsadowe
1. W zakładce **Skanuj** rób zdjęcia obiektu z różnych kątów (12-24 zdjęcia)
2. Przejdź do **Galeria** i kliknij **Przetwórz zdjęcia na model 3D**
3. Oglądaj wynik w **Model 3D**

### Skanowanie na żywo
1. W zakładce **Skanuj** kliknij **Start**
2. Powoli obracaj kamerę wokół obiektu
3. Chmura punktów buduje się w czasie rzeczywistym

## Eksport

Model 3D można wyeksportować w formatach:
- **PLY** (ASCII) - z kolorami wierzchołków
- **OBJ** - wierzchołki bez tekstury

## Wskazówki

- Dobre oświetlenie
- Obiekt z wyraźną teksturą (nie gładki/jednolity)
- Powolny, stabilny ruch kamery
- 12-24 zdjęć równomiernie dookoła obiektu
