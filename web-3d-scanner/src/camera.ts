export class CameraManager {
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(video: HTMLVideoElement) {
    this.videoEl = video;
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D niedostępny");
    this.ctx = ctx;
  }

  get active(): boolean {
    return this.stream !== null;
  }

  get frameWidth(): number {
    return this.canvas.width;
  }

  get frameHeight(): number {
    return this.canvas.height;
  }

  async start(): Promise<void> {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia nie jest dostępne w tej przeglądarce.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });

    this.videoEl.srcObject = this.stream;
    await this.videoEl.play();
    await this.waitReady();

    this.canvas.width = this.videoEl.videoWidth || 640;
    this.canvas.height = this.videoEl.videoHeight || 480;
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.videoEl.srcObject = null;
  }

  getFrameCanvas(): HTMLCanvasElement | null {
    if (
      !this.active ||
      this.videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    )
      return null;
    this.ctx.drawImage(
      this.videoEl,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    return this.canvas;
  }

  capturePhoto(quality = 0.85): string | null {
    const canvas = this.getFrameCanvas();
    if (!canvas) return null;
    return canvas.toDataURL("image/jpeg", quality);
  }

  private waitReady(): Promise<void> {
    if (this.videoEl.videoWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.videoEl.addEventListener("loadedmetadata", () => resolve(), {
        once: true,
      });
    });
  }
}
