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
- ma mobilny interfejs z zakładkami: `Podgląd`, `Ustawienia`, `Widok 3D`
- ma zakładkę `Diagnostyka` z testem kamery i testem OpenCV

### Rozwiązywanie problemów (Android)

- Jeśli przycisk `Start skanowania` nie reaguje, sprawdź czy:
  - uruchamiasz aplikację z `http://127.0.0.1:5173` (nie z przypadkowego URL),
  - przeglądarka ma przyznane uprawnienie do kamery,
  - po zmianie uprawnień odświeżyłeś stronę.
- W zakładce `Diagnostyka` użyj przycisku `Test dostępu do kamery`:
  - powinien wymusić okno z prośbą o uprawnienia,
  - jeśli nie ma okna, zwykle URL nie jest secure context albo przeglądarka blokuje kamerę.
- W aplikacji komunikat błędu jest widoczny na dole ekranu w polu statusu.

### Uwaga

To jest wersja prototypowa. Najlepsze wyniki uzyskasz przy:

- dobrym oświetleniu
- obiekcie z teksturą (nie gładkie, jednolite powierzchnie)
- powolnym ruchu kamery