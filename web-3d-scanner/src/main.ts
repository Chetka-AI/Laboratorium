import "./style.css";
import { CameraManager } from "./camera.ts";
import { Processor } from "./processor.ts";
import { Viewer3D } from "./viewer.ts";
import type { ScanSettings, CapturedPhoto } from "./types.ts";

const ICONS = {
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  cube: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  shutter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.15"/><circle cx="12" cy="12" r="3"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
};

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<main class="app">
  <!-- ===== SCAN PAGE ===== -->
  <section class="page active" data-page="scan">
    <div class="page-scroll">
      <div class="card camera-card">
        <div class="camera-wrapper">
          <video id="camera" playsinline autoplay muted></video>
          <canvas id="overlay"></canvas>
          <div id="camera-guide" class="camera-guide">
            <div class="guide-ring"></div>
            <span class="guide-text">Ustaw obiekt w centrum</span>
          </div>
          <div id="flash" class="flash-overlay"></div>
        </div>
      </div>

      <div class="card">
        <div class="capture-row">
          <button id="btn-capture" class="btn-shutter" aria-label="Zrób zdjęcie">
            <span class="shutter-ring"></span>
            <span class="shutter-dot"></span>
          </button>
        </div>
        <p class="capture-hint">Zrób zdjęcie z aktualnego kąta</p>
      </div>

      <div class="card">
        <h3 class="card-title">Skanowanie na żywo</h3>
        <div class="live-controls">
          <button id="btn-live-start" class="btn btn-accent">
            <span class="btn-icon">${ICONS.play}</span>
            Start
          </button>
          <button id="btn-live-stop" class="btn btn-secondary" disabled>
            <span class="btn-icon">${ICONS.stop}</span>
            Stop
          </button>
        </div>
      </div>

      <div class="card tips-card">
        <h3 class="card-title">Wskazówki</h3>
        <ul class="tips-list">
          <li>Powolny, stabilny ruch kamery</li>
          <li>Dobre, równomierne oświetlenie</li>
          <li>Obiekt z wyraźną teksturą</li>
          <li>Zrób 12-24 zdjęcia dookoła</li>
        </ul>
      </div>
    </div>

    <div class="status-bar">
      <pre id="status" class="status-text">Gotowe</pre>
    </div>
  </section>

  <!-- ===== GALLERY PAGE ===== -->
  <section class="page" data-page="gallery">
    <div class="page-scroll">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Zdjęcia <span id="photo-count" class="badge">0</span></h3>
          <button id="btn-clear-photos" class="btn btn-sm btn-danger">
            <span class="btn-icon">${ICONS.trash}</span>
            Wyczyść
          </button>
        </div>
        <div id="photo-grid" class="photo-grid">
          <div class="empty-state">
            <p>Brak zdjęć</p>
            <p class="hint">Przejdź do zakładki Skanuj i zrób zdjęcia obiektu z różnych kątów.</p>
          </div>
        </div>
      </div>

      <button id="btn-process" class="btn btn-primary btn-block" disabled>
        Przetwórz zdjęcia na model 3D
      </button>

      <div id="process-progress" class="progress-card card" style="display:none">
        <h3 class="card-title">Przetwarzanie</h3>
        <div class="progress-bar-wrap">
          <div id="progress-bar" class="progress-bar"></div>
        </div>
        <p id="progress-text" class="progress-text">Przetwarzanie...</p>
      </div>
    </div>
  </section>

  <!-- ===== MODEL PAGE ===== -->
  <section class="page" data-page="model">
    <div class="page-scroll page-fill">
      <div class="card viewer-card">
        <div id="viewer-host" class="viewer-host"></div>
      </div>

      <div class="card">
        <div class="model-stats">
          <span class="stat-label">Punkty 3D</span>
          <strong id="point-count" class="stat-value">0</strong>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">Akcje</h3>
        <div class="action-grid">
          <button id="btn-export-ply" class="btn btn-secondary" disabled>
            <span class="btn-icon">${ICONS.download}</span>
            Eksport PLY
          </button>
          <button id="btn-export-obj" class="btn btn-secondary" disabled>
            <span class="btn-icon">${ICONS.download}</span>
            Eksport OBJ
          </button>
          <button id="btn-clear-model" class="btn btn-secondary">
            <span class="btn-icon">${ICONS.trash}</span>
            Wyczyść
          </button>
          <button id="btn-reset-view" class="btn btn-secondary">
            <span class="btn-icon">${ICONS.refresh}</span>
            Reset widoku
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== SETTINGS PAGE ===== -->
  <section class="page" data-page="settings">
    <div class="page-scroll">
      <div class="card">
        <h3 class="card-title">Parametry skanowania</h3>

        <label class="setting-item">
          <div class="setting-header">
            <span>Interwał analizy klatek</span>
            <strong id="val-interval">600 ms</strong>
          </div>
          <input id="range-interval" type="range" min="200" max="1500" step="50" value="600" />
        </label>

        <label class="setting-item">
          <div class="setting-header">
            <span>Próg dopasowania cech</span>
            <strong id="val-distance">60</strong>
          </div>
          <input id="range-distance" type="range" min="20" max="120" step="2" value="60" />
          <span class="setting-hint">Niżej = ostrzejsze filtrowanie</span>
        </label>

        <label class="setting-item">
          <div class="setting-header">
            <span>Max dopasowań / klatka</span>
            <strong id="val-matches">220</strong>
          </div>
          <input id="range-matches" type="range" min="60" max="400" step="10" value="220" />
        </label>
      </div>

      <div class="card">
        <h3 class="card-title">Informacje</h3>
        <div class="info-list">
          <div class="info-row"><span>Wersja</span><span>1.0.0</span></div>
          <div class="info-row"><span>Silnik 3D</span><span>Three.js</span></div>
          <div class="info-row"><span>Wizja</span><span>OpenCV.js (ORB)</span></div>
          <div class="info-row"><span>Kamera</span><span>WebRTC</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== BOTTOM NAVIGATION ===== -->
  <nav class="bottom-nav" aria-label="Nawigacja">
    <button class="nav-btn active" data-tab="scan">
      <span class="nav-icon">${ICONS.camera}</span>
      <span class="nav-label">Skanuj</span>
    </button>
    <button class="nav-btn" data-tab="gallery">
      <span class="nav-icon">${ICONS.grid}</span>
      <span class="nav-label">Galeria</span>
      <span id="nav-badge" class="nav-badge" style="display:none">0</span>
    </button>
    <button class="nav-btn" data-tab="model">
      <span class="nav-icon">${ICONS.cube}</span>
      <span class="nav-label">Model 3D</span>
    </button>
    <button class="nav-btn" data-tab="settings">
      <span class="nav-icon">${ICONS.gear}</span>
      <span class="nav-label">Opcje</span>
    </button>
  </nav>
</main>
`;

// ──────── DOM REFS ────────

const el = <T extends HTMLElement>(sel: string): T => {
  const e = document.querySelector<T>(sel);
  if (!e) throw new Error(`Missing: ${sel}`);
  return e;
};

const videoEl = el<HTMLVideoElement>("#camera");
const overlayEl = el<HTMLCanvasElement>("#overlay");
const overlayCtx = overlayEl.getContext("2d")!;
const flashEl = el<HTMLDivElement>("#flash");
const statusEl = el<HTMLPreElement>("#status");

const btnCapture = el<HTMLButtonElement>("#btn-capture");
const btnLiveStart = el<HTMLButtonElement>("#btn-live-start");
const btnLiveStop = el<HTMLButtonElement>("#btn-live-stop");
const btnClearPhotos = el<HTMLButtonElement>("#btn-clear-photos");
const btnProcess = el<HTMLButtonElement>("#btn-process");
const btnExportPly = el<HTMLButtonElement>("#btn-export-ply");
const btnExportObj = el<HTMLButtonElement>("#btn-export-obj");
const btnClearModel = el<HTMLButtonElement>("#btn-clear-model");
const btnResetView = el<HTMLButtonElement>("#btn-reset-view");

const photoGrid = el<HTMLDivElement>("#photo-grid");
const photoCountEl = el<HTMLSpanElement>("#photo-count");
const navBadge = el<HTMLSpanElement>("#nav-badge");
const pointCountEl = el<HTMLElement>("#point-count");
const progressCard = el<HTMLDivElement>("#process-progress");
const progressBar = el<HTMLDivElement>("#progress-bar");
const progressText = el<HTMLParagraphElement>("#progress-text");

const valInterval = el<HTMLElement>("#val-interval");
const valDistance = el<HTMLElement>("#val-distance");
const valMatches = el<HTMLElement>("#val-matches");
const rangeInterval = el<HTMLInputElement>("#range-interval");
const rangeDistance = el<HTMLInputElement>("#range-distance");
const rangeMatches = el<HTMLInputElement>("#range-matches");

const viewerHost = el<HTMLDivElement>("#viewer-host");

const navButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".nav-btn"),
);
const pages = Array.from(
  document.querySelectorAll<HTMLElement>(".page"),
);

// ──────── STATE ────────

const camera = new CameraManager(videoEl);
const processor = new Processor();
let viewer: Viewer3D | null = null;

const photos: CapturedPhoto[] = [];
const settings: ScanSettings = {
  intervalMs: 600,
  matchDistance: 60,
  maxMatches: 220,
};

let liveTimerId: number | null = null;
let isLiveProcessing = false;
let isBatchProcessing = false;
let cameraStartedForScan = false;

// ──────── TABS ────────

function switchTab(tabId: string): void {
  for (const btn of navButtons) {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  }
  for (const page of pages) {
    page.classList.toggle("active", page.dataset.page === tabId);
  }
  if (tabId === "model" && viewer) {
    viewer.resetCamera();
  }
}

for (const btn of navButtons) {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab) switchTab(btn.dataset.tab);
  });
}

// ──────── STATUS ────────

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

// ──────── CAMERA STARTUP ────────

async function ensureCamera(): Promise<void> {
  if (camera.active) return;
  setStatus("Uruchamianie kamery...");
  await camera.start();
  setupOverlaySize();
  setStatus("Kamera aktywna.");
}

function setupOverlaySize(): void {
  overlayEl.width = camera.frameWidth;
  overlayEl.height = camera.frameHeight;
}

// ──────── PHOTO CAPTURE ────────

btnCapture.addEventListener("click", async () => {
  try {
    await ensureCamera();
    const dataUrl = camera.capturePhoto();
    if (!dataUrl) {
      setStatus("Nie udało się zrobić zdjęcia.");
      return;
    }

    flashEl.classList.add("flash");
    setTimeout(() => flashEl.classList.remove("flash"), 300);

    photos.push({
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      timestamp: Date.now(),
    });

    renderGallery();
    setStatus(`Zdjęcie ${photos.length} zapisane.`);
  } catch (err) {
    setStatus(`Błąd: ${errMsg(err)}`);
  }
});

// ──────── LIVE SCANNING ────────

btnLiveStart.addEventListener("click", async () => {
  if (liveTimerId !== null) return;
  try {
    setStatus("Inicjalizacja OpenCV...");
    await processor.initialize();
    await ensureCamera();
    cameraStartedForScan = true;

    processor.resetState();
    liveTimerId = window.setInterval(() => {
      void processLiveFrame();
    }, settings.intervalMs);

    void processLiveFrame();
    updateLiveButtons();
    setStatus("Skanowanie działa. Przesuwaj kamerę powoli.");
  } catch (err) {
    stopLive();
    setStatus(`Błąd startu: ${errMsg(err)}`);
  }
});

btnLiveStop.addEventListener("click", () => {
  stopLive();
  setStatus("Skanowanie zatrzymane.");
});

function stopLive(): void {
  if (liveTimerId !== null) {
    clearInterval(liveTimerId);
    liveTimerId = null;
  }
  processor.resetState();
  isLiveProcessing = false;
  clearOverlay();

  if (cameraStartedForScan) {
    camera.stop();
    cameraStartedForScan = false;
  }

  updateLiveButtons();
}

function updateLiveButtons(): void {
  const running = liveTimerId !== null;
  btnLiveStart.disabled = running;
  btnLiveStop.disabled = !running;
}

async function processLiveFrame(): Promise<void> {
  if (isLiveProcessing) return;
  isLiveProcessing = true;

  try {
    const canvas = camera.getFrameCanvas();
    if (!canvas) return;

    const result = processor.processFrame(canvas, settings);
    if (result && viewer) {
      viewer.addPoints(result.positions, result.colors);
      updatePointCount();
      drawOverlayDots(result.inlierCount);
      setStatus(
        `Inliers: ${result.inlierCount} | Punkty: ${viewer.pointCount.toLocaleString()}`,
      );
    } else {
      clearOverlay();
    }
  } finally {
    isLiveProcessing = false;
  }
}

function drawOverlayDots(count: number): void {
  clearOverlay();
  overlayCtx.fillStyle = "rgba(52, 211, 153, 0.85)";
  const cx = overlayEl.width / 2;
  const cy = overlayEl.height / 2;
  const r = Math.min(cx, cy) * 0.6;

  for (let i = 0; i < Math.min(count, 120); i++) {
    const angle = (i / count) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * r * 0.5;
    const px = cx + Math.cos(angle) * (r + jitter);
    const py = cy + Math.sin(angle) * (r + jitter);
    overlayCtx.beginPath();
    overlayCtx.arc(px, py, 2, 0, Math.PI * 2);
    overlayCtx.fill();
  }
}

function clearOverlay(): void {
  overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);
}

// ──────── GALLERY ────────

function renderGallery(): void {
  const count = photos.length;
  photoCountEl.textContent = `${count}`;
  navBadge.textContent = `${count}`;
  navBadge.style.display = count > 0 ? "" : "none";
  btnProcess.disabled = count < 2 || isBatchProcessing;

  if (count === 0) {
    photoGrid.innerHTML = `
      <div class="empty-state">
        <p>Brak zdjęć</p>
        <p class="hint">Przejdź do zakładki Skanuj i zrób zdjęcia obiektu z różnych kątów.</p>
      </div>`;
    return;
  }

  photoGrid.innerHTML = photos
    .map(
      (p, i) => `
    <div class="photo-thumb" data-id="${p.id}">
      <img src="${p.dataUrl}" alt="Zdjęcie ${i + 1}" loading="lazy" />
      <span class="photo-num">${i + 1}</span>
      <button class="photo-del" data-id="${p.id}" aria-label="Usuń zdjęcie">×</button>
    </div>`,
    )
    .join("");

  photoGrid.querySelectorAll<HTMLButtonElement>(".photo-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id!;
      const idx = photos.findIndex((p) => p.id === id);
      if (idx !== -1) {
        photos.splice(idx, 1);
        renderGallery();
      }
    });
  });
}

btnClearPhotos.addEventListener("click", () => {
  photos.length = 0;
  renderGallery();
});

// ──────── BATCH PROCESSING ────────

btnProcess.addEventListener("click", async () => {
  if (photos.length < 2 || isBatchProcessing) return;
  isBatchProcessing = true;
  btnProcess.disabled = true;
  progressCard.style.display = "";

  try {
    setStatus("Inicjalizacja OpenCV...");
    await processor.initialize();

    const totalPairs = photos.length - 1;
    let processed = 0;
    let totalPoints = 0;

    for (let i = 0; i < totalPairs; i++) {
      const progress = ((i + 1) / totalPairs) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `Para ${i + 1} / ${totalPairs}...`;

      const c1 = await dataUrlToCanvas(photos[i].dataUrl);
      const c2 = await dataUrlToCanvas(photos[i + 1].dataUrl);

      const result = processor.processImagePair(c1, c2, settings);
      if (result && viewer) {
        viewer.addPoints(result.positions, result.colors);
        totalPoints += result.positions.length / 3;
      }

      processed++;
      await yieldFrame();
    }

    updatePointCount();
    progressText.textContent = `Gotowe! ${processed} par, ${totalPoints} nowych punktów.`;
    setStatus(`Przetwarzanie zakończone. Przejdź do zakładki Model 3D.`);

    setTimeout(() => {
      progressCard.style.display = "none";
    }, 3000);
  } catch (err) {
    progressText.textContent = `Błąd: ${errMsg(err)}`;
    setStatus(`Błąd przetwarzania: ${errMsg(err)}`);
  } finally {
    isBatchProcessing = false;
    btnProcess.disabled = photos.length < 2;
  }
});

// ──────── 3D VIEWER ────────

function initViewer(): void {
  try {
    viewer = new Viewer3D(viewerHost, 8000);
  } catch (err) {
    viewerHost.innerHTML = `<p class="error">Three.js niedostępne: ${errMsg(err)}</p>`;
  }
}

function updatePointCount(): void {
  const count = viewer?.pointCount ?? 0;
  pointCountEl.textContent = count.toLocaleString();
  btnExportPly.disabled = count === 0;
  btnExportObj.disabled = count === 0;
}

btnClearModel.addEventListener("click", () => {
  viewer?.clearPoints();
  updatePointCount();
  setStatus("Model 3D wyczyszczony.");
});

btnResetView.addEventListener("click", () => {
  viewer?.resetCamera();
});

btnExportPly.addEventListener("click", () => {
  if (!viewer || viewer.pointCount === 0) return;
  downloadText(viewer.exportPLY(), "model.ply", "application/octet-stream");
});

btnExportObj.addEventListener("click", () => {
  if (!viewer || viewer.pointCount === 0) return;
  downloadText(viewer.exportOBJ(), "model.obj", "text/plain");
});

// ──────── SETTINGS ────────

function syncSettingsUI(): void {
  valInterval.textContent = `${settings.intervalMs} ms`;
  valDistance.textContent = `${settings.matchDistance}`;
  valMatches.textContent = `${settings.maxMatches}`;
}

rangeInterval.addEventListener("input", () => {
  settings.intervalMs = Number(rangeInterval.value);
  syncSettingsUI();
  if (liveTimerId !== null) restartLiveTimer();
});

rangeDistance.addEventListener("input", () => {
  settings.matchDistance = Number(rangeDistance.value);
  syncSettingsUI();
});

rangeMatches.addEventListener("input", () => {
  settings.maxMatches = Number(rangeMatches.value);
  syncSettingsUI();
});

function restartLiveTimer(): void {
  if (liveTimerId !== null) clearInterval(liveTimerId);
  liveTimerId = window.setInterval(() => {
    void processLiveFrame();
  }, settings.intervalMs);
}

// ──────── HELPERS ────────

function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function yieldFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ──────── INIT ────────

syncSettingsUI();
updateLiveButtons();
renderGallery();
initViewer();
updatePointCount();

setStatus("Inicjalizacja OpenCV w tle...");
void processor.initialize().then(
  () => setStatus("Gotowe. Możesz skanować lub robić zdjęcia."),
  (err) => setStatus(`OpenCV: ${errMsg(err)}`),
);
