import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class Viewer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private geometry: THREE.BufferGeometry;
  private pointsMesh: THREE.Points;
  private container: HTMLElement;
  private animId = 0;

  private posData: number[] = [];
  private colData: number[] = [];
  private maxPts: number;

  constructor(container: HTMLElement, maxPoints = 8000) {
    this.container = container;
    this.maxPts = maxPoints;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x080d18);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 200);
    this.camera.position.set(0, 1.2, 4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 50;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      sizeAttenuation: true,
    });
    this.pointsMesh = new THREE.Points(this.geometry, material);
    this.scene.add(this.pointsMesh);

    const grid = new THREE.GridHelper(6, 30, 0x1a2236, 0x1a2236);
    grid.position.y = -1.5;
    this.scene.add(grid);

    this.scene.add(new THREE.AxesHelper(0.5));

    this.resize();
    this.startLoop();

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.resize()).observe(container);
    } else {
      window.addEventListener("resize", () => this.resize());
    }
  }

  addPoints(positions: number[], colors: number[]): void {
    this.posData.push(...positions);
    this.colData.push(...colors);

    const maxLen = this.maxPts * 3;
    if (this.posData.length > maxLen) {
      this.posData.splice(0, this.posData.length - maxLen);
      this.colData.splice(0, this.colData.length - maxLen);
    }

    this.updateGeometry();
  }

  get pointCount(): number {
    return Math.floor(this.posData.length / 3);
  }

  clearPoints(): void {
    this.posData.length = 0;
    this.colData.length = 0;
    this.updateGeometry();
  }

  resetCamera(): void {
    this.camera.position.set(0, 1.2, 4);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  exportPLY(): string {
    const count = this.pointCount;
    const lines: string[] = [
      "ply",
      "format ascii 1.0",
      `element vertex ${count}`,
      "property float x",
      "property float y",
      "property float z",
      "property uchar red",
      "property uchar green",
      "property uchar blue",
      "end_header",
    ];

    for (let i = 0; i < count; i++) {
      const x = this.posData[i * 3].toFixed(6);
      const y = this.posData[i * 3 + 1].toFixed(6);
      const z = this.posData[i * 3 + 2].toFixed(6);
      const r = Math.round(this.colData[i * 3] * 255);
      const g = Math.round(this.colData[i * 3 + 1] * 255);
      const b = Math.round(this.colData[i * 3 + 2] * 255);
      lines.push(`${x} ${y} ${z} ${r} ${g} ${b}`);
    }

    return lines.join("\n");
  }

  exportOBJ(): string {
    const count = this.pointCount;
    const lines: string[] = [
      "# 3D Scanner Point Cloud",
      `# ${count} vertices`,
    ];

    for (let i = 0; i < count; i++) {
      const x = this.posData[i * 3].toFixed(6);
      const y = this.posData[i * 3 + 1].toFixed(6);
      const z = this.posData[i * 3 + 2].toFixed(6);
      lines.push(`v ${x} ${y} ${z}`);
    }

    return lines.join("\n");
  }

  dispose(): void {
    cancelAnimationFrame(this.animId);
    this.controls.dispose();
    this.renderer.dispose();
    this.geometry.dispose();
  }

  private updateGeometry(): void {
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(this.posData), 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Float32Array(this.colData), 3),
    );
    this.geometry.computeBoundingSphere();
  }

  private resize(): void {
    const w = Math.max(this.container.clientWidth, 10);
    const h = Math.max(this.container.clientHeight, 10);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private startLoop(): void {
    const loop = (): void => {
      this.animId = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
