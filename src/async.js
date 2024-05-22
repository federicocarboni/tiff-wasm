/** @param {TiffDecoder} tiffDecoder */
function terminateWorker(tiffDecoder) {
  if (tiffDecoder.worker_ !== undefined) tiffDecoder.worker_.terminate();
  tiffDecoder.worker_ = undefined;
}

export class TiffDecoder {
  constructor() {
    // The Tiff decoder is lazy, it will only load the Worker and WebAssembly
    // when absolutely necessary.
    /** @type {Worker} @private */
    this.worker_ = undefined;
    /** @type {WebAssembly.Module} @private */
    this.module_ = undefined;
    // Terminate the worker being idle for 30 seconds (may change in the future)
    this.timeout_ = 0;
  }

  getResponse_() {
    return new Promise((resolve, reject) => {
      const message = (event) => {
        this.worker_.removeEventListener("message", message);
        const data = event.data;
        if (data.t === 0) {
          reject(data.v);
        } else {
          resolve(data.v);
        }
        this.setTimeout_();
      };
      this.worker_.addEventListener("message", message);
    });
  }

  setTimeout_() {
    setTimeout(terminateWorker, 1500, this);
  }

  async init() {
    clearTimeout(this.timeout_);
    if (this.worker_ !== undefined) {
      return;
    }
    console.time("AsyncTiff::init");
    this.worker_ = new Worker("./dist/worker.js");
    this.worker_.postMessage({t: 1, v: this.module_});
    const module = await this.getResponse_();
    if (module !== undefined) this.module_ = module;
    console.timeEnd("AsyncTiff::init");
  }

  /** @param {Uint8Array} data */
  async decodeImageBitmap(data) {
    await this.init();
    console.time("AsyncTiff::decodeImageBitmap")
    this.worker_.postMessage({t: 3, v: data}, [data.buffer]);
    const resp = await this.getResponse_();
    console.timeEnd("AsyncTiff::decodeImageBitmap")
    return resp;
  }

  /** @param {Uint8Array} data */
  async decodeImageData(data) {
    await this.init();
    this.worker_.postMessage({t: 4, v: data}, [data.buffer]);
    return await this.getResponse_();
  }
}
