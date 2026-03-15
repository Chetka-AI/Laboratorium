import "./style.css";
import * as THREE from "three";

type CvMat = {
  delete(): void;
  empty(): boolean;
  cols: number;
  data64F: Float64Array;
  floatAt(row: number, col: number): number;
  ucharAt(row: number, col: number): number;
};

type CvKeyPointVector = {
  delete(): void;
  get(index: number): { pt: { x: number; y: number } };
};

type CvDMatchVector = {
  delete(): void;
  size(): number;
  get(index: number): { queryIdx: number; trainIdx: number; distance: number };
};

type CvORB = {
  detectAndCompute(
    image: CvMat,
    mask: CvMat,
    keypoints: CvKeyPointVector,
    descriptors: CvMat
  ): void;
};

type CvBFMatcher = {
  match(query: CvMat, train: CvMat, matches: CvDMatchVector): void;
};

type CvRuntime = {
  Mat: new (...args: unknown[]) => CvMat;
  ORB: new (...args: unknown[]) => CvORB;
  BFMatcher: new (...args: unknown[]) => CvBFMatcher;
  KeyPointVector: new (...args: unknown[]) => CvKeyPointVector;
  DMatchVector: new (...args: unknown[]) => CvDMatchVector;
  COLOR_RGBA2GRAY: number;
  NORM_HAMMING: number;
  RANSAC: number;
  CV_32FC2: number;
  CV_64F: number;
  imread(source: HTMLCanvasElement): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  matFromArray(rows: number, cols: number, type: number, data: number[]): CvMat;
  findEssentialMat(...args: unknown[]): CvMat;
  recoverPose(...args: unknown[]): number;
  gemm(...args: unknown[]): void;
  triangulatePoints(...args: unknown[]): void;
  onRuntimeInitialized?: () => void;
};

interface FrameFeatures {
  keypoints: CvKeyPointVector;
  descriptors: CvMat;
  width: number;
  height: number;
}

interface ReconstructionResult {
  trackedPoints: Array<{ x: number; y: number }>;
  triangulatedPoints: number[];
  inliers: number;
}

interface ScanSettings {
  intervalMs: number;
  matchDistance: number;
  maxMatches: number;
}

interface ThreeCloudState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  geometry: THREE.BufferGeometry;
  points: THREE.Points;
  clock: THREE.Clock;
}

const app = requireElement<HTMLDivElement>("#app");
app.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <h1>Web 3D Scanner</h1>
      <p>Android / Web: zakładki + diagnostyka działania.</p>
    </header>

    <nav class="tab-bar" aria-label="Sekcje aplikacji">
      <button class="tab-btn is-active" data-tab="preview">Podgląd</button>
      <button class="tab-btn" data-tab="settings">Ustawienia</button>
      <button class="tab-btn" data-tab="cloud">Widok 3D</button>
      <button class="tab-btn" data-tab="diagnostics">Diagnostyka</button>
    </nav>

    <section class="tab-content">
      <article class="tab-panel is-active" data-panel="preview">
        <section class="card controls-grid">
          <button id="start-btn" class="btn">Start skanowania</button>
          <button id="stop-btn" class="btn secondary" disabled>Stop</button>
          <button id="clear-overlay-btn" class="btn secondary">Wyczyść punkty 2D</button>
        </section>
        <section class="card">
          <h2>Kamera + punkty śledzenia</h2>
          <div class="camera-stack">
            <video id="camera" playsinline autoplay muted></video>
            <canvas id="overlay"></canvas>
          </div>
        </section>
      </article>

      <article class="tab-panel" data-panel="settings">
        <section class="card">
          <h2>Parametry skanowania</h2>
          <label class="setting">
            <span>Interwał analizy</span>
            <strong id="interval-value">600 ms</strong>
            <input id="interval-range" type="range" min="200" max="1500" step="50" value="600" />
          </label>
          <label class="setting">
            <span>Próg dopasowania cech</span>
            <strong id="distance-value">60</strong>
            <input id="distance-range" type="range" min="20" max="120" step="2" value="60" />
          </label>
          <label class="setting">
            <span>Maksymalna liczba dopasowań</span>
            <strong id="matches-value">220</strong>
            <input id="matches-range" type="range" min="60" max="400" step="10" value="220" />
          </label>
        </section>
      </article>

      <article class="tab-panel" data-panel="cloud">
        <section class="card cloud-actions">
          <button id="clear-cloud-btn" class="btn secondary">Wyczyść chmurę 3D</button>
        </section>
        <section class="card cloud-card">
          <h2>Chmura punktów (Three.js)</h2>
          <div id="three-host" class="three-host"></div>
          <p id="three-note" class="note"></p>
        </section>
      </article>

      <article class="tab-panel" data-panel="diagnostics">
        <section class="card diagnostics-actions">
          <button id="diag-refresh-btn" class="btn secondary">Odśwież diagnostykę</button>
          <button id="diag-camera-btn" class="btn secondary">Test dostępu do kamery</button>
          <button id="diag-opencv-btn" class="btn secondary">Test ładowania OpenCV</button>
        </section>
        <section class="card">
          <h2>Stan środowiska</h2>
          <ul class="diag-list">
            <li><span>Secure context</span><strong id="diag-secure">-</strong></li>
            <li><span>Obsługa getUserMedia</span><strong id="diag-media">-</strong></li>
            <li><span>Stan uprawnień kamery</span><strong id="diag-permission">-</strong></li>
            <li><span>Kamera aktywna</span><strong id="diag-camera-live">-</strong></li>
            <li><span>OpenCV</span><strong id="diag-opencv">-</strong></li>
            <li><span>WebGL / Three</span><strong id="diag-webgl">-</strong></li>
          </ul>
        </section>
        <section class="card">
          <h2>Log diagnostyczny</h2>
          <pre id="diag-log" class="diag-log">Brak wpisów.</pre>
        </section>
      </article>
    </section>

    <footer class="status-wrap">
      <pre id="status" class="status">Gotowe. Kliknij Start albo przejdź do Diagnostyka.</pre>
    </footer>
  </main>
`;

const startButton = requireElement<HTMLButtonElement>("#start-btn");
const stopButton = requireElement<HTMLButtonElement>("#stop-btn");
const clearOverlayButton = requireElement<HTMLButtonElement>("#clear-overlay-btn");
const clearCloudButton = requireElement<HTMLButtonElement>("#clear-cloud-btn");
const intervalRange = requireElement<HTMLInputElement>("#interval-range");
const distanceRange = requireElement<HTMLInputElement>("#distance-range");
const matchesRange = requireElement<HTMLInputElement>("#matches-range");
const intervalValue = requireElement<HTMLSpanElement>("#interval-value");
const distanceValue = requireElement<HTMLSpanElement>("#distance-value");
const matchesValue = requireElement<HTMLSpanElement>("#matches-value");
const statusPanel = requireElement<HTMLPreElement>("#status");
const threeHost = requireElement<HTMLDivElement>("#three-host");
const threeNote = requireElement<HTMLParagraphElement>("#three-note");
const video = requireElement<HTMLVideoElement>("#camera");
const overlay = requireElement<HTMLCanvasElement>("#overlay");
const overlayCtx = requireCanvasContext(overlay);
const diagRefreshButton = requireElement<HTMLButtonElement>("#diag-refresh-btn");
const diagCameraButton = requireElement<HTMLButtonElement>("#diag-camera-btn");
const diagOpencvButton = requireElement<HTMLButtonElement>("#diag-opencv-btn");
const diagLog = requireElement<HTMLPreElement>("#diag-log");
const diagSecure = requireElement<HTMLElement>("#diag-secure");
const diagMedia = requireElement<HTMLElement>("#diag-media");
const diagPermission = requireElement<HTMLElement>("#diag-permission");
const diagCameraLive = requireElement<HTMLElement>("#diag-camera-live");
const diagOpenCv = requireElement<HTMLElement>("#diag-opencv");
const diagWebGl = requireElement<HTMLElement>("#diag-webgl");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>(".tab-panel"));

const captureCanvas = document.createElement("canvas");
const captureCtx = requireCanvasContext(captureCanvas);
const settings: ScanSettings = {
  intervalMs: Number(intervalRange.value),
  matchDistance: Number(distanceRange.value),
  maxMatches: Number(matchesRange.value),
};

const cloudData: number[] = [];
const maxCloudPoints = 6000;
const diagnosticLines: string[] = [];

let captureTimerId: number | null = null;
let isStarting = false;
let isProcessingFrame = false;
let stream: MediaStream | null = null;
let previousFrame: FrameFeatures | null = null;
let cvApi: CvRuntime | null = null;
let cvLoadPromise: Promise<CvRuntime> | null = null;
let cvLoadError: string | null = null;
let orb: CvORB | null = null;
let matcher: CvBFMatcher | null = null;
let threeState: ThreeCloudState | null = null;

setupTabs();
setupSettings();
setupThree();
setupControls();
updateControlState();
appendDiagnosticLine("Aplikacja uruchomiona.");
void refreshDiagnostics();

const diagnosticsTimer = window.setInterval(() => {
  void refreshDiagnostics();
}, 4000);

window.addEventListener("beforeunload", () => {
  window.clearInterval(diagnosticsTimer);
  stopScanning();
});

function setupTabs(): void {
  const activateTab = (tabId: string): void => {
    for (const button of tabButtons) {
      button.classList.toggle("is-active", button.dataset.tab === tabId);
    }
    for (const panel of tabPanels) {
      panel.classList.toggle("is-active", panel.dataset.panel === tabId);
    }
    if (tabId === "cloud") {
      resizeThreeRenderer();
    }
  };

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;
      if (tabId !== undefined) {
        activateTab(tabId);
      }
    });
  }
}

function setupSettings(): void {
  const updateLabels = (): void => {
    intervalValue.textContent = `${settings.intervalMs} ms`;
    distanceValue.textContent = `${settings.matchDistance}`;
    matchesValue.textContent = `${settings.maxMatches}`;
  };

  intervalRange.addEventListener("input", () => {
    settings.intervalMs = Number(intervalRange.value);
    updateLabels();
    if (captureTimerId !== null) {
      restartCaptureLoop();
    }
  });

  distanceRange.addEventListener("input", () => {
    settings.matchDistance = Number(distanceRange.value);
    updateLabels();
  });

  matchesRange.addEventListener("input", () => {
    settings.maxMatches = Number(matchesRange.value);
    updateLabels();
  });

  updateLabels();
}

function setupControls(): void {
  startButton.addEventListener("click", () => {
    void startScanning();
  });
  stopButton.addEventListener("click", () => {
    stopScanning("Skanowanie zatrzymane.");
  });
  clearOverlayButton.addEventListener("click", clearOverlay);
  clearCloudButton.addEventListener("click", () => {
    clearCloud();
    setStatus("Wyczyszczono chmurę 3D.");
  });
  diagRefreshButton.addEventListener("click", () => {
    void refreshDiagnostics();
  });
  diagCameraButton.addEventListener("click", () => {
    void runCameraPermissionTest();
  });
  diagOpencvButton.addEventListener("click", () => {
    void runOpenCvTest();
  });
}

function setupThree(): void {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeHost.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.01, 100);
    camera.position.set(0, 0, 3.4);

    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      color: 0x69f0ff,
      size: 0.03,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    scene.add(new THREE.AxesHelper(0.45));

    threeState = {
      scene,
      camera,
      renderer,
      geometry,
      points,
      clock: new THREE.Clock(),
    };

    resizeThreeRenderer();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => resizeThreeRenderer());
      observer.observe(threeHost);
    } else {
      window.addEventListener("resize", resizeThreeRenderer);
    }

    const renderLoop = (): void => {
      requestAnimationFrame(renderLoop);
      if (threeState === null) {
        return;
      }
      threeState.points.rotation.y += threeState.clock.getDelta() * 0.25;
      threeState.renderer.render(threeState.scene, threeState.camera);
    };
    renderLoop();
    threeNote.textContent = "Widok 3D aktywny.";
  } catch (error) {
    threeState = null;
    threeNote.textContent = `Three.js niedostępne: ${errorToMessage(error)}`;
    appendDiagnosticLine(`Three.js błąd: ${errorToMessage(error)}`);
  }
}

function resizeThreeRenderer(): void {
  if (threeState === null) {
    return;
  }
  const width = Math.max(threeHost.clientWidth, 10);
  const height = Math.max(threeHost.clientHeight, 10);
  threeState.renderer.setSize(width, height, false);
  threeState.camera.aspect = width / height;
  threeState.camera.updateProjectionMatrix();
}

async function startScanning(): Promise<void> {
  if (captureTimerId !== null || isStarting) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Przeglądarka nie wspiera getUserMedia.");
    appendDiagnosticLine("Brak API getUserMedia.");
    return;
  }

  isStarting = true;
  updateControlState();
  setStatus("Krok 1/3: proszę o dostęp do kamery...");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    await waitForVideoDimensions();
    setupFrameSize(video.videoWidth || 640, video.videoHeight || 480);
    appendDiagnosticLine("Kamera uruchomiona.");

    setStatus("Krok 2/3: ładowanie OpenCV.js...");
    const runtime = await ensureCvRuntime(35000);
    if (orb === null) {
      orb = new runtime.ORB(1600);
    }
    if (matcher === null) {
      matcher = new runtime.BFMatcher(runtime.NORM_HAMMING, true);
    }
    setStatus("Krok 3/3: start analizy obrazu...");
    restartCaptureLoop();
    await processFrame();
    setStatus("Skanowanie aktywne. Ruszaj kamerą powoli.");
  } catch (error) {
    stopScanning();
    const message = `Błąd startu: ${errorToMessage(error)}`;
    setStatus(message);
    appendDiagnosticLine(message);
  } finally {
    isStarting = false;
    updateControlState();
    void refreshDiagnostics();
  }
}

function stopScanning(message?: string): void {
  if (captureTimerId !== null) {
    window.clearInterval(captureTimerId);
    captureTimerId = null;
  }

  if (stream !== null) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    stream = null;
  }

  if (video.srcObject !== null) {
    video.srcObject = null;
  }

  releaseFrame(previousFrame);
  previousFrame = null;
  isProcessingFrame = false;
  clearOverlay();
  updateControlState();

  if (message !== undefined) {
    setStatus(message);
  }
}

function restartCaptureLoop(): void {
  if (captureTimerId !== null) {
    window.clearInterval(captureTimerId);
  }
  captureTimerId = window.setInterval(() => {
    void processFrame();
  }, settings.intervalMs);
  updateControlState();
}

async function processFrame(): Promise<void> {
  if (isProcessingFrame || cvApi === null || orb === null || matcher === null) {
    return;
  }
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  isProcessingFrame = true;
  try {
    const currentFrame = extractFeatures(cvApi, orb);
    if (currentFrame === null) {
      return;
    }

    let reconstruction: ReconstructionResult | null = null;
    if (previousFrame !== null) {
      reconstruction = reconstructFromPair(cvApi, matcher, previousFrame, currentFrame);
    }

    if (reconstruction !== null) {
      drawTrackedPoints(reconstruction.trackedPoints);
      addToPointCloud(reconstruction.triangulatedPoints);
      setStatus(
        `Inliers: ${reconstruction.inliers}, punktów 3D: ${Math.floor(cloudData.length / 3)}`
      );
    } else {
      clearOverlay();
    }

    releaseFrame(previousFrame);
    previousFrame = currentFrame;
  } finally {
    isProcessingFrame = false;
  }
}

function extractFeatures(cvApiRef: CvRuntime, orbRef: CvORB): FrameFeatures | null {
  if (captureCanvas.width === 0 || captureCanvas.height === 0) {
    return null;
  }

  captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  const rgba = cvApiRef.imread(captureCanvas);
  const gray = new cvApiRef.Mat();
  const mask = new cvApiRef.Mat();
  const keypoints = new cvApiRef.KeyPointVector();
  const descriptors = new cvApiRef.Mat();

  try {
    cvApiRef.cvtColor(rgba, gray, cvApiRef.COLOR_RGBA2GRAY);
    orbRef.detectAndCompute(gray, mask, keypoints, descriptors);
  } finally {
    rgba.delete();
    gray.delete();
    mask.delete();
  }

  return {
    keypoints,
    descriptors,
    width: captureCanvas.width,
    height: captureCanvas.height,
  };
}

function reconstructFromPair(
  cvApiRef: CvRuntime,
  matcherRef: CvBFMatcher,
  previous: FrameFeatures,
  current: FrameFeatures
): ReconstructionResult | null {
  if (previous.descriptors.empty() || current.descriptors.empty()) {
    return null;
  }

  const matches = new cvApiRef.DMatchVector();
  matcherRef.match(previous.descriptors, current.descriptors, matches);

  try {
    if (matches.size() < 12) {
      return null;
    }

    const filteredMatches: Array<{ queryIdx: number; trainIdx: number; distance: number }> = [];
    for (let i = 0; i < matches.size(); i += 1) {
      const match = matches.get(i);
      if (match.distance <= settings.matchDistance) {
        filteredMatches.push(match);
      }
    }

    filteredMatches.sort((a, b) => a.distance - b.distance);
    const selectedMatches = filteredMatches.slice(0, settings.maxMatches);
    if (selectedMatches.length < 12) {
      return null;
    }

    const previousPointsFlat: number[] = [];
    const currentPointsFlat: number[] = [];

    for (const match of selectedMatches) {
      const prevPoint = previous.keypoints.get(match.queryIdx).pt;
      const currPoint = current.keypoints.get(match.trainIdx).pt;
      previousPointsFlat.push(prevPoint.x, prevPoint.y);
      currentPointsFlat.push(currPoint.x, currPoint.y);
    }

    const points1 = cvApiRef.matFromArray(
      selectedMatches.length,
      1,
      cvApiRef.CV_32FC2,
      previousPointsFlat
    );
    const points2 = cvApiRef.matFromArray(
      selectedMatches.length,
      1,
      cvApiRef.CV_32FC2,
      currentPointsFlat
    );
    const cameraMatrix = buildCameraMatrix(cvApiRef, previous.width, previous.height);
    const inlierMask = new cvApiRef.Mat();

    try {
      const essential = cvApiRef.findEssentialMat(
        points1,
        points2,
        cameraMatrix,
        cvApiRef.RANSAC,
        0.999,
        1.0,
        inlierMask
      );

      try {
        if (essential.empty()) {
          return null;
        }

        const rotation = new cvApiRef.Mat();
        const translation = new cvApiRef.Mat();

        try {
          cvApiRef.recoverPose(
            essential,
            points1,
            points2,
            cameraMatrix,
            rotation,
            translation,
            inlierMask
          );

          const previousInliersFlat: number[] = [];
          const currentInliersFlat: number[] = [];
          const trackedPoints: Array<{ x: number; y: number }> = [];

          for (let i = 0; i < selectedMatches.length; i += 1) {
            if (inlierMask.ucharAt(i, 0) === 0) {
              continue;
            }
            const pX = previousPointsFlat[2 * i];
            const pY = previousPointsFlat[2 * i + 1];
            const cX = currentPointsFlat[2 * i];
            const cY = currentPointsFlat[2 * i + 1];
            previousInliersFlat.push(pX, pY);
            currentInliersFlat.push(cX, cY);
            trackedPoints.push({ x: cX, y: cY });
          }

          if (trackedPoints.length < 8) {
            return null;
          }

          const triangulatedPoints = triangulate(
            cvApiRef,
            cameraMatrix,
            rotation,
            translation,
            previousInliersFlat,
            currentInliersFlat
          );

          return {
            trackedPoints,
            triangulatedPoints,
            inliers: trackedPoints.length,
          };
        } finally {
          rotation.delete();
          translation.delete();
        }
      } finally {
        essential.delete();
      }
    } finally {
      points1.delete();
      points2.delete();
      cameraMatrix.delete();
      inlierMask.delete();
    }
  } finally {
    matches.delete();
  }
}

function triangulate(
  cvApiRef: CvRuntime,
  cameraMatrix: CvMat,
  rotation: CvMat,
  translation: CvMat,
  previousInliersFlat: number[],
  currentInliersFlat: number[]
): number[] {
  const inlierCount = Math.floor(previousInliersFlat.length / 2);
  if (inlierCount < 8) {
    return [];
  }

  const points1 = cvApiRef.matFromArray(inlierCount, 1, cvApiRef.CV_32FC2, previousInliersFlat);
  const points2 = cvApiRef.matFromArray(inlierCount, 1, cvApiRef.CV_32FC2, currentInliersFlat);
  const projectionBase = cvApiRef.matFromArray(3, 4, cvApiRef.CV_64F, [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
  ]);

  const r = Array.from(rotation.data64F);
  const t = Array.from(translation.data64F);
  const projectionMoved = cvApiRef.matFromArray(3, 4, cvApiRef.CV_64F, [
    r[0], r[1], r[2], t[0],
    r[3], r[4], r[5], t[1],
    r[6], r[7], r[8], t[2],
  ]);

  const projection1 = new cvApiRef.Mat();
  const projection2 = new cvApiRef.Mat();
  const noArray = new cvApiRef.Mat();
  const points4D = new cvApiRef.Mat();

  try {
    cvApiRef.gemm(cameraMatrix, projectionBase, 1, noArray, 0, projection1);
    cvApiRef.gemm(cameraMatrix, projectionMoved, 1, noArray, 0, projection2);
    cvApiRef.triangulatePoints(projection1, projection2, points1, points2, points4D);

    const out: number[] = [];
    const maxPerFrame = Math.min(points4D.cols, 140);

    for (let i = 0; i < maxPerFrame; i += 1) {
      const w = points4D.floatAt(3, i);
      if (!Number.isFinite(w) || Math.abs(w) < 1e-5) {
        continue;
      }

      const x = points4D.floatAt(0, i) / w;
      const y = points4D.floatAt(1, i) / w;
      const z = points4D.floatAt(2, i) / w;

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      if (Math.abs(x) > 50 || Math.abs(y) > 50 || Math.abs(z) > 50) {
        continue;
      }

      out.push(x * 0.2, -y * 0.2, -z * 0.2);
    }

    return out;
  } finally {
    points1.delete();
    points2.delete();
    projectionBase.delete();
    projectionMoved.delete();
    projection1.delete();
    projection2.delete();
    noArray.delete();
    points4D.delete();
  }
}

function buildCameraMatrix(cvApiRef: CvRuntime, width: number, height: number): CvMat {
  const focal = Math.max(width, height);
  return cvApiRef.matFromArray(3, 3, cvApiRef.CV_64F, [
    focal, 0, width / 2,
    0, focal, height / 2,
    0, 0, 1,
  ]);
}

function addToPointCloud(points: number[]): void {
  if (points.length === 0 || threeState === null) {
    return;
  }

  cloudData.push(...points);
  const maxLength = maxCloudPoints * 3;
  if (cloudData.length > maxLength) {
    cloudData.splice(0, cloudData.length - maxLength);
  }

  threeState.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(cloudData), 3)
  );
  threeState.geometry.computeBoundingSphere();
}

function clearCloud(): void {
  cloudData.length = 0;
  if (threeState === null) {
    return;
  }
  threeState.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(), 3));
}

function drawTrackedPoints(points: Array<{ x: number; y: number }>): void {
  clearOverlay();
  overlayCtx.fillStyle = "rgba(70, 255, 140, 0.9)";
  const limit = Math.min(points.length, 220);
  for (let i = 0; i < limit; i += 1) {
    const point = points[i];
    overlayCtx.beginPath();
    overlayCtx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    overlayCtx.fill();
  }
}

function clearOverlay(): void {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
}

function setupFrameSize(width: number, height: number): void {
  captureCanvas.width = width;
  captureCanvas.height = height;
  overlay.width = width;
  overlay.height = height;
}

function releaseFrame(frame: FrameFeatures | null): void {
  if (frame !== null) {
    frame.keypoints.delete();
    frame.descriptors.delete();
  }
}

function waitForVideoDimensions(): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const onReady = (): void => {
      video.removeEventListener("loadedmetadata", onReady);
      resolve();
    };
    video.addEventListener("loadedmetadata", onReady, { once: true });
  });
}

async function runCameraPermissionTest(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    appendDiagnosticLine("Test kamery: getUserMedia niedostępne.");
    setStatus("Brak API getUserMedia.");
    void refreshDiagnostics();
    return;
  }

  setStatus("Test kamery: proszę o dostęp...");
  try {
    const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    testStream.getTracks().forEach((track) => track.stop());
    appendDiagnosticLine("Test kamery: OK (uprawnienie działa).");
    setStatus("Test kamery zakończony powodzeniem.");
  } catch (error) {
    const message = `Test kamery błąd: ${errorToMessage(error)}`;
    appendDiagnosticLine(message);
    setStatus(message);
  } finally {
    void refreshDiagnostics();
  }
}

async function runOpenCvTest(): Promise<void> {
  setStatus("Test OpenCV: ładowanie...");
  try {
    await ensureCvRuntime(35000);
    setStatus("Test OpenCV: OK.");
    appendDiagnosticLine("OpenCV: test zakończony sukcesem.");
  } catch (error) {
    const message = `Test OpenCV błąd: ${errorToMessage(error)}`;
    setStatus(message);
    appendDiagnosticLine(message);
  } finally {
    void refreshDiagnostics();
  }
}

function updateControlState(): void {
  const running = captureTimerId !== null;
  startButton.disabled = running || isStarting;
  stopButton.disabled = !running && !isStarting;
}

async function refreshDiagnostics(): Promise<void> {
  diagSecure.textContent = window.isSecureContext ? "TAK" : "NIE";
  diagMedia.textContent = typeof navigator.mediaDevices?.getUserMedia === "function" ? "TAK" : "NIE";
  diagCameraLive.textContent = stream === null ? "NIE" : "TAK";
  diagWebGl.textContent = threeState === null ? "NIE" : "TAK";
  diagOpenCv.textContent = getOpenCvStateLabel();
  diagPermission.textContent = await getCameraPermissionState();
}

function getOpenCvStateLabel(): string {
  if (cvApi !== null) {
    return "gotowe";
  }
  if (cvLoadPromise !== null) {
    return "ładowanie";
  }
  if (cvLoadError !== null) {
    return `błąd: ${cvLoadError}`;
  }
  return "niezaładowane";
}

async function getCameraPermissionState(): Promise<string> {
  if (!("permissions" in navigator) || typeof navigator.permissions.query !== "function") {
    return "API niedostępne";
  }

  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state;
  } catch {
    return "brak danych";
  }
}

async function ensureCvRuntime(timeoutMs: number): Promise<CvRuntime> {
  if (cvApi !== null) {
    return cvApi;
  }

  if (cvLoadPromise === null) {
    cvLoadError = null;
    cvLoadPromise = loadCvRuntime(timeoutMs)
      .then((runtime) => {
        cvApi = runtime;
        return runtime;
      })
      .catch((error: unknown) => {
        cvLoadError = errorToMessage(error);
        cvLoadPromise = null;
        throw error;
      });
  }

  return cvLoadPromise;
}

async function loadCvRuntime(timeoutMs: number): Promise<CvRuntime> {
  appendDiagnosticLine("OpenCV: rozpoczęto dynamiczny import.");
  const imported = await withTimeout(
    import("@techstark/opencv-js"),
    timeoutMs,
    "Przekroczono czas importu OpenCV."
  );

  const runtime = pickCvRuntime(imported);
  if (typeof runtime.Mat === "function") {
    appendDiagnosticLine("OpenCV: gotowe (Mat dostępny po imporcie).");
    return runtime;
  }

  const maybeThenable = runtime as CvRuntime & { then?: unknown };
  if (typeof maybeThenable.then === "function") {
    const resolved = await withTimeout(
      Promise.resolve(maybeThenable as unknown as Promise<CvRuntime>),
      timeoutMs,
      "Przekroczono czas inicjalizacji OpenCV."
    );
    if (typeof resolved.Mat === "function") {
      appendDiagnosticLine("OpenCV: gotowe (thenable).");
      return resolved;
    }
  }

  const polled = await waitForCvPolling(runtime, timeoutMs);
  appendDiagnosticLine("OpenCV: gotowe (polling).");
  return polled;
}

function pickCvRuntime(imported: unknown): CvRuntime {
  const moduleNamespace = imported as { default?: unknown };
  const defaultExport = moduleNamespace.default;
  if (isCvLike(defaultExport)) {
    return defaultExport as CvRuntime;
  }
  return imported as CvRuntime;
}

function isCvLike(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybeCv = value as Record<string, unknown>;
  return typeof maybeCv.Mat === "function" || typeof maybeCv.then === "function";
}

function waitForCvPolling(runtime: CvRuntime, timeoutMs: number): Promise<CvRuntime> {
  if (typeof runtime.Mat === "function") {
    return Promise.resolve(runtime);
  }

  return new Promise<CvRuntime>((resolve, reject) => {
    const startedAt = performance.now();
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (error !== undefined) {
        reject(error);
      } else {
        resolve(runtime);
      }
    };

    const previousCallback = runtime.onRuntimeInitialized;
    runtime.onRuntimeInitialized = () => {
      previousCallback?.();
      finish();
    };

    const poll = (): void => {
      if (settled) {
        return;
      }
      if (typeof runtime.Mat === "function") {
        finish();
        return;
      }
      if (performance.now() - startedAt > timeoutMs) {
        finish(new Error("OpenCV nie zainicjalizowało się na czas."));
        return;
      }
      window.setTimeout(poll, 70);
    };

    poll();
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function appendDiagnosticLine(message: string): void {
  const timestamp = new Date().toLocaleTimeString("pl-PL", { hour12: false });
  diagnosticLines.unshift(`[${timestamp}] ${message}`);
  if (diagnosticLines.length > 40) {
    diagnosticLines.splice(40);
  }
  diagLog.textContent = diagnosticLines.join("\n");
}

function setStatus(message: string): void {
  statusPanel.textContent = message;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Brak elementu: ${selector}`);
  }
  return element;
}

function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Nie udało się uzyskać kontekstu 2D canvas.");
  }
  return context;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
