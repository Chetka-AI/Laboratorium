import type * as cvModule from "@techstark/opencv-js";

export type CvRuntime = typeof cvModule & { onRuntimeInitialized?: () => void };
export type CvMat = InstanceType<typeof cvModule.Mat>;
export type CvKeyPointVector = InstanceType<typeof cvModule.KeyPointVector>;
export type CvORB = InstanceType<typeof cvModule.ORB>;
export type CvBFMatcher = InstanceType<typeof cvModule.BFMatcher>;

export interface FrameFeatures {
  keypoints: CvKeyPointVector;
  descriptors: CvMat;
  width: number;
  height: number;
}

export interface ScanSettings {
  intervalMs: number;
  matchDistance: number;
  maxMatches: number;
}

export interface TriangulatedResult {
  positions: number[];
  colors: number[];
  inlierCount: number;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: number;
}
