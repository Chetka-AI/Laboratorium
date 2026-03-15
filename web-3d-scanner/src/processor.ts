import * as cvModule from "@techstark/opencv-js";
import type {
  CvRuntime,
  CvORB,
  CvBFMatcher,
  CvMat,
  FrameFeatures,
  ScanSettings,
  TriangulatedResult,
} from "./types.ts";

export class Processor {
  private cv: CvRuntime | null = null;
  private orb: CvORB | null = null;
  private matcher: CvBFMatcher | null = null;
  private previousFrame: FrameFeatures | null = null;

  get ready(): boolean {
    return this.cv !== null;
  }

  async initialize(timeoutMs = 25000): Promise<void> {
    if (this.cv) return;
    this.cv = await this.loadCvRuntime(timeoutMs);
    this.orb = new this.cv.ORB(1600);
    this.matcher = new this.cv.BFMatcher(this.cv.NORM_HAMMING, true);
  }

  processFrame(
    canvas: HTMLCanvasElement,
    settings: ScanSettings,
  ): TriangulatedResult | null {
    if (!this.cv || !this.orb || !this.matcher) return null;

    const current = this.extractFeatures(canvas);
    if (!current) return null;

    let result: TriangulatedResult | null = null;
    if (this.previousFrame) {
      result = this.reconstruct(this.previousFrame, current, settings);
    }

    this.releaseFrame(this.previousFrame);
    this.previousFrame = current;
    return result;
  }

  processImagePair(
    canvas1: HTMLCanvasElement,
    canvas2: HTMLCanvasElement,
    settings: ScanSettings,
  ): TriangulatedResult | null {
    if (!this.cv || !this.orb || !this.matcher) return null;

    const f1 = this.extractFeatures(canvas1);
    const f2 = this.extractFeatures(canvas2);
    if (!f1 || !f2) {
      this.releaseFrame(f1);
      this.releaseFrame(f2);
      return null;
    }

    const result = this.reconstruct(f1, f2, settings);
    this.releaseFrame(f1);
    this.releaseFrame(f2);
    return result;
  }

  resetState(): void {
    this.releaseFrame(this.previousFrame);
    this.previousFrame = null;
  }

  private extractFeatures(canvas: HTMLCanvasElement): FrameFeatures | null {
    const cv = this.cv!;
    if (canvas.width === 0 || canvas.height === 0) return null;

    const rgba = cv.imread(canvas);
    const gray = new cv.Mat();
    const mask = new cv.Mat();
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();

    try {
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
      this.orb!.detectAndCompute(gray, mask, keypoints, descriptors);
    } finally {
      rgba.delete();
      gray.delete();
      mask.delete();
    }

    return {
      keypoints,
      descriptors,
      width: canvas.width,
      height: canvas.height,
    };
  }

  private reconstruct(
    prev: FrameFeatures,
    curr: FrameFeatures,
    settings: ScanSettings,
  ): TriangulatedResult | null {
    const cv = this.cv!;
    if (prev.descriptors.empty() || curr.descriptors.empty()) return null;

    const matches = new cv.DMatchVector();
    this.matcher!.match(prev.descriptors, curr.descriptors, matches);

    try {
      if (matches.size() < 12) return null;

      const filtered: Array<{
        queryIdx: number;
        trainIdx: number;
        distance: number;
      }> = [];
      for (let i = 0; i < matches.size(); i++) {
        const m = matches.get(i) as {
          queryIdx: number;
          trainIdx: number;
          distance: number;
        };
        if (m.distance <= settings.matchDistance) filtered.push(m);
      }

      filtered.sort((a, b) => a.distance - b.distance);
      const selected = filtered.slice(0, settings.maxMatches);
      if (selected.length < 12) return null;

      const prevFlat: number[] = [];
      const currFlat: number[] = [];

      for (const m of selected) {
        const pp = (
          prev.keypoints.get(m.queryIdx) as {
            pt: { x: number; y: number };
          }
        ).pt;
        const cp = (
          curr.keypoints.get(m.trainIdx) as {
            pt: { x: number; y: number };
          }
        ).pt;
        prevFlat.push(pp.x, pp.y);
        currFlat.push(cp.x, cp.y);
      }

      const pts1 = cv.matFromArray(
        selected.length,
        1,
        cv.CV_32FC2,
        prevFlat,
      );
      const pts2 = cv.matFromArray(
        selected.length,
        1,
        cv.CV_32FC2,
        currFlat,
      );
      const camMat = this.buildCameraMatrix(prev.width, prev.height);
      const inlierMask = new cv.Mat();

      try {
        const essential = cv.findEssentialMat(
          pts1,
          pts2,
          camMat,
          cv.RANSAC,
          0.999,
          1.0,
          inlierMask,
        );

        try {
          if (essential.empty()) return null;

          const rotation = new cv.Mat();
          const translation = new cv.Mat();

          try {
            cv.recoverPose(
              essential,
              pts1,
              pts2,
              camMat,
              rotation,
              translation,
              inlierMask,
            );

            const prevInliers: number[] = [];
            const currInliers: number[] = [];
            let inlierCount = 0;

            for (let i = 0; i < selected.length; i++) {
              if (inlierMask.ucharAt(i, 0) === 0) continue;
              prevInliers.push(prevFlat[2 * i], prevFlat[2 * i + 1]);
              currInliers.push(currFlat[2 * i], currFlat[2 * i + 1]);
              inlierCount++;
            }

            if (inlierCount < 8) return null;

            const positions = this.triangulate(
              camMat,
              rotation,
              translation,
              prevInliers,
              currInliers,
            );

            const colors: number[] = [];
            for (let i = 0; i < positions.length / 3; i++) {
              colors.push(0.41, 0.71, 1.0);
            }

            return { positions, colors, inlierCount };
          } finally {
            rotation.delete();
            translation.delete();
          }
        } finally {
          essential.delete();
        }
      } finally {
        pts1.delete();
        pts2.delete();
        camMat.delete();
        inlierMask.delete();
      }
    } finally {
      matches.delete();
    }
  }

  private triangulate(
    camMat: CvMat,
    rot: CvMat,
    trans: CvMat,
    prevFlat: number[],
    currFlat: number[],
  ): number[] {
    const cv = this.cv!;
    const count = Math.floor(prevFlat.length / 2);
    if (count < 8) return [];

    const pts1 = cv.matFromArray(count, 1, cv.CV_32FC2, prevFlat);
    const pts2 = cv.matFromArray(count, 1, cv.CV_32FC2, currFlat);
    const projBase = cv.matFromArray(3, 4, cv.CV_64F, [
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
    ]);

    const r = Array.from(rot.data64F);
    const t = Array.from(trans.data64F);
    const projMoved = cv.matFromArray(3, 4, cv.CV_64F, [
      r[0],
      r[1],
      r[2],
      t[0],
      r[3],
      r[4],
      r[5],
      t[1],
      r[6],
      r[7],
      r[8],
      t[2],
    ]);

    const proj1 = new cv.Mat();
    const proj2 = new cv.Mat();
    const noArr = new cv.Mat();
    const pts4D = new cv.Mat();

    try {
      cv.gemm(camMat, projBase, 1, noArr, 0, proj1);
      cv.gemm(camMat, projMoved, 1, noArr, 0, proj2);
      cv.triangulatePoints(proj1, proj2, pts1, pts2, pts4D);

      const out: number[] = [];
      const maxPer = Math.min(pts4D.cols, 140);

      for (let i = 0; i < maxPer; i++) {
        const w = pts4D.floatAt(3, i);
        if (!Number.isFinite(w) || Math.abs(w) < 1e-5) continue;

        const x = pts4D.floatAt(0, i) / w;
        const y = pts4D.floatAt(1, i) / w;
        const z = pts4D.floatAt(2, i) / w;

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
          continue;
        if (Math.abs(x) > 50 || Math.abs(y) > 50 || Math.abs(z) > 50)
          continue;

        out.push(x * 0.2, -y * 0.2, -z * 0.2);
      }

      return out;
    } finally {
      pts1.delete();
      pts2.delete();
      projBase.delete();
      projMoved.delete();
      proj1.delete();
      proj2.delete();
      noArr.delete();
      pts4D.delete();
    }
  }

  private buildCameraMatrix(width: number, height: number): CvMat {
    const f = Math.max(width, height);
    return this.cv!.matFromArray(3, 3, this.cv!.CV_64F, [
      f,
      0,
      width / 2,
      0,
      f,
      height / 2,
      0,
      0,
      1,
    ]);
  }

  private releaseFrame(frame: FrameFeatures | null): void {
    if (frame) {
      frame.keypoints.delete();
      frame.descriptors.delete();
    }
  }

  private async loadCvRuntime(timeoutMs: number): Promise<CvRuntime> {
    const runtime = cvModule as unknown as CvRuntime & { then?: unknown };
    if (typeof runtime.Mat === "function") return runtime;

    if (typeof runtime.then === "function") {
      const loaded = await this.withTimeout(
        runtime as unknown as Promise<CvRuntime>,
        timeoutMs,
        "Timeout inicjalizacji OpenCV.js",
      );
      if (typeof loaded.Mat === "function") return loaded;
    }

    return this.pollCv(runtime, timeoutMs);
  }

  private pollCv(
    runtime: CvRuntime,
    timeoutMs: number,
  ): Promise<CvRuntime> {
    if (typeof runtime.Mat === "function") return Promise.resolve(runtime);

    return new Promise((resolve, reject) => {
      const start = performance.now();
      let done = false;

      const finish = (err?: Error): void => {
        if (done) return;
        done = true;
        if (err) reject(err);
        else resolve(runtime);
      };

      const prev = runtime.onRuntimeInitialized;
      runtime.onRuntimeInitialized = () => {
        prev?.();
        finish();
      };

      const poll = (): void => {
        if (done) return;
        if (typeof runtime.Mat === "function") {
          finish();
          return;
        }
        if (performance.now() - start > timeoutMs) {
          finish(new Error("Timeout oczekiwania na OpenCV.js"));
          return;
        }
        setTimeout(poll, 60);
      };

      poll();
    });
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    msg: string,
  ): Promise<T> {
    let handle = 0;
    const timeout = new Promise<T>((_, rej) => {
      handle = window.setTimeout(() => rej(new Error(msg)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(handle);
    }
  }
}
