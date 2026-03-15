import "./style.css";
import * as THREE from "three";
import * as cvModule from "@techstark/opencv-js";

type CvRuntime = typeof cvModule & {
  onRuntimeInitialized?: () => void;
};

type CvMat = InstanceType<typeof cvModule.Mat>;
type CvKeyPointVector = InstanceType<typeof cvModule.KeyPointVector>;
type CvORB = InstanceType<typeof cvModule.ORB>;
type CvBFMatcher = InstanceType<typeof cvModule.BFMatcher>;

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

const app = requireElement<HTMLDivElement>("#app");
app.innerHTML = `
  <main class="layout">
    <header class="top">
      <h1>Web 3D Scanner (Android)</h1>
      <p>
        MVP: kamera + cechy ORB + estymacja ruchu + triangulacja punktów 3D.
      </p>
    </header>

    <section class="controls">
      <button id="start-btn" class="btn">Start skanowania</button>
      <button id="stop-btn" class="btn secondary" disabled>Stop</button>
      <label class="range-wrap">
        Interwał analizy:
        <span id="interval-value">600 ms</span>
        <input id="interval-range" type="range" min="250" max="1400" step="50" value="600" />
      </label>
    </section>

    <section class="panels">
      <article class="panel">
        <h2>Podgląd kamery + punkty śledzenia</h2>
        <div class="camera-stack">
          <video id="camera" playsinline autoplay muted></video>
          <canvas id="overlay"></canvas>
        </div>
      </article>

      <article class="panel">
        <h2>Chmura punktów 3D (Three.js)</h2>
        <div id="three-host" class="three-host"></div>
      </article>
    </section>

    <pre id="status" class="status">Gotowe do startu.</pre>
  </main>
`;

const startButton = requireElement<HTMLButtonElement>("#start-btn");
const stopButton = requireElement<HTMLButtonElement>("#stop-btn");
const intervalRange = requireElement<HTMLInputElement>("#interval-range");
const intervalValue = requireElement<HTMLSpanElement>("#interval-value");
const statusPanel = requireElement<HTMLPreElement>("#status");
const video = requireElement<HTMLVideoElement>("#camera");
const overlay = requireElement<HTMLCanvasElement>("#overlay");
const overlayCtx = requireCanvasContext(overlay);
const threeHost = requireElement<HTMLDivElement>("#three-host");

const captureCanvas = document.createElement("canvas");
const captureCtx = requireCanvasContext(captureCanvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);

const camera3d = new THREE.PerspectiveCamera(62, 1, 0.01, 100);
camera3d.position.set(0, 0, 3.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
threeHost.append(renderer.domElement);

const pointGeometry = new THREE.BufferGeometry();
const pointMaterial = new THREE.PointsMaterial({
  color: 0x69f0ff,
  size: 0.03,
  sizeAttenuation: true,
});
const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
scene.add(pointCloud);
scene.add(new THREE.AxesHelper(0.45));

const cloudData: number[] = [];
const maxCloudPoints = 5000;

let captureTimerId: number | null = null;
let stream: MediaStream | null = null;
let previousFrame: FrameFeatures | null = null;
let cvApi: CvRuntime | null = null;
let orb: CvORB | null = null;
let matcher: CvBFMatcher | null = null;

const cvRuntime = cvModule as unknown as CvRuntime;

const resizeRenderer = (): void => {
  const width = Math.max(threeHost.clientWidth, 10);
  const height = Math.max(threeHost.clientHeight, 10);
  renderer.setSize(width, height, false);
  camera3d.aspect = width / height;
  camera3d.updateProjectionMatrix();
};

const resizeObserver = new ResizeObserver(() => resizeRenderer());
resizeObserver.observe(threeHost);
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

const clock = new THREE.Clock();
const renderLoop = (): void => {
  requestAnimationFrame(renderLoop);
  pointCloud.rotation.y += clock.getDelta() * 0.3;
  renderer.render(scene, camera3d);
};
renderLoop();

intervalRange.addEventListener("input", () => {
  intervalValue.textContent = `${intervalRange.value} ms`;
  if (captureTimerId !== null) {
    restartCaptureLoop();
  }
});

startButton.addEventListener("click", () => {
  void startScanning();
});

stopButton.addEventListener("click", () => {
  stopScanning();
});

async function startScanning(): Promise<void> {
  if (captureTimerId !== null) {
    return;
  }

  startButton.disabled = true;
  setStatus("Inicjalizacja OpenCV.js...");

  try {
    if (cvApi === null) {
      cvApi = await waitForCv(cvRuntime);
      orb = new cvApi.ORB(1500);
      matcher = new cvApi.BFMatcher(cvApi.NORM_HAMMING, true);
    }

    if (orb === null || matcher === null || cvApi === null) {
      throw new Error("OpenCV nie został poprawnie zainicjalizowany.");
    }

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

    setupFrameSize(video.videoWidth || 640, video.videoHeight || 480);
    restartCaptureLoop();
    stopButton.disabled = false;
    setStatus("Skanowanie uruchomione. Przesuwaj kamerę powoli wokół obiektu.");
  } catch (error) {
    stopScanning();
    startButton.disabled = false;
    setStatus(`Błąd startu: ${errorToMessage(error)}`);
  }
}

function stopScanning(): void {
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
  clearOverlay();

  startButton.disabled = false;
  stopButton.disabled = true;
}

function restartCaptureLoop(): void {
  if (captureTimerId !== null) {
    window.clearInterval(captureTimerId);
    captureTimerId = null;
  }

  const intervalMs = Number(intervalRange.value);
  captureTimerId = window.setInterval(() => {
    void processFrame();
  }, intervalMs);
}

async function processFrame(): Promise<void> {
  if (cvApi === null || orb === null || matcher === null) {
    return;
  }

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

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
    drawTrackedPoints([]);
  }

  releaseFrame(previousFrame);
  previousFrame = currentFrame;
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

    const bestMatches: Array<{ queryIdx: number; trainIdx: number; distance: number }> = [];
    for (let i = 0; i < matches.size(); i += 1) {
      const match = matches.get(i) as {
        queryIdx: number;
        trainIdx: number;
        distance: number;
      };

      if (match.distance < 60) {
        bestMatches.push(match);
      }
    }

    bestMatches.sort((a, b) => a.distance - b.distance);
    const selectedMatches = bestMatches.slice(0, 220);
    if (selectedMatches.length < 12) {
      return null;
    }

    const previousPointsFlat: number[] = [];
    const currentPointsFlat: number[] = [];

    for (const match of selectedMatches) {
      const prevPoint = (previous.keypoints.get(match.queryIdx) as { pt: { x: number; y: number } }).pt;
      const currPoint = (current.keypoints.get(match.trainIdx) as { pt: { x: number; y: number } }).pt;
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
    const maxPerFrame = Math.min(points4D.cols, 120);

    for (let i = 0; i < maxPerFrame; i += 1) {
      const w = points4D.floatAt(3, i);
      if (!Number.isFinite(w) || Math.abs(w) < 1e-4) {
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
  if (points.length === 0) {
    return;
  }

  cloudData.push(...points);

  const maxLength = maxCloudPoints * 3;
  if (cloudData.length > maxLength) {
    cloudData.splice(0, cloudData.length - maxLength);
  }

  pointGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(cloudData), 3)
  );
  pointGeometry.computeBoundingSphere();
}

function drawTrackedPoints(points: Array<{ x: number; y: number }>): void {
  clearOverlay();
  overlayCtx.fillStyle = "rgba(70, 255, 140, 0.9)";

  const limit = Math.min(points.length, 200);
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
  if (frame === null) {
    return;
  }
  frame.keypoints.delete();
  frame.descriptors.delete();
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

async function waitForCv(runtime: CvRuntime, timeoutMs = 20000): Promise<CvRuntime> {
  if (typeof runtime.Mat === "function") {
    return runtime;
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
        finish(new Error("Przekroczono czas oczekiwania na OpenCV.js."));
        return;
      }
      window.setTimeout(poll, 50);
    };

    poll();
  });
}
