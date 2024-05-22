/** JavaScript API for TIFF */

/**
 * @typedef {object} Exports
 * @property {WebAssembly.Memory} memory
 * @property {() => void} _initialize
 * @property {(size: number) => number} malloc
 * @property {(ptr: number) => void} free
 * @property {(size: number) => number} _emscripten_stack_alloc
 * @property {(data: number, size: number) => number} tiff_open
 * @property {(tiff: number) => void} tiff_close
 * @property {(
 *   tiff: number,
 *   width: number,
 *   height: number,
 *   orientation: number,
 *   data: number,
 * ) => number} tiff_decode
 * @property {(tiff: number, tag: number) => number} tiff_field16
 * @property {(tiff: number, tag: number) => number} tiff_field32
 */

/** Image width in pixels */
const TIFFTAG_IMAGEWIDTH = 256;
/** Image height in pixels */
const TIFFTAG_IMAGELENGTH = 257;

/** +image orientation */
const TIFFTAG_ORIENTATION = 274;
// ORIENTATION_TOPLEFT 1              /* row 0 top, col 0 lhs */
// ORIENTATION_TOPRIGHT 2             /* row 0 top, col 0 rhs */
// ORIENTATION_BOTRIGHT 3             /* row 0 bottom, col 0 rhs */
// ORIENTATION_BOTLEFT 4              /* row 0 bottom, col 0 lhs */
// ORIENTATION_LEFTTOP 5              /* row 0 lhs, col 0 top */
// ORIENTATION_RIGHTTOP 6             /* row 0 rhs, col 0 top */
// ORIENTATION_RIGHTBOT 7             /* row 0 rhs, col 0 bottom */
// ORIENTATION_LEFTBOT 8              /* row 0 lhs, col 0 bottom */

const textDecoder = new TextDecoder("utf-8", {
  ignoreBOM: false,
});

function nosys() {
  return 52 /* NOSYS */;
}

/**
 * @param {Uint8Array} memory
 * @param {number} ptr
 */
function readString(memory, ptr) {
  return textDecoder.decode(memory.subarray(ptr, memory.indexOf(0, ptr)));
}

/**
 * @param {Tiff} tiff
 * @param {WebAssembly.Instance} instance
 */
function receiveInstance(tiff, instance) {
  tiff.instance_ = instance;
  tiff.exports_ = /** @type {any} */ (instance.exports);
  // Initialize memory views.
  tiff.updateViews_();
  // Run constructors.
  tiff.exports_._initialize();
}

export class Tiff {
  /** @private */
  constructor() {
    var module = this;
    /**
     * @type {WebAssembly.Instance}
     * @internal
     */
    this.instance_;
    /**
     * @type {Exports}
     * @internal
     */
    this.exports_;
    /**
     * @type {DataView}
     * @internal
     */
    this.memory_;
    /**
     * @type {Uint8Array}
     * @internal
     */
    this.memory8_;
    this.TiffDecoder = class TiffDecoder {
      /** @param {Uint8Array} data */
      constructor(data) {
        const size = data.length;
        let ptr;
        if (data.buffer === module.memory8_.buffer) {
          ptr = data.byteOffset;
        } else {
          ptr = module.exports_.malloc(size);
          module.memory8_.set(data, ptr);
        }
        /** @internal */
        this.ptr_ = module.exports_.tiff_open(ptr, size);
        if (this.ptr_ === 0) {
          throw new Error();
        }
      }
      free() {
        // tiff_close also takes care of free'ing memory
        module.exports_.tiff_close(this.ptr_);
        this.ptr_ = 0;
      }
      decodeImageData() {
        const width = module.exports_.tiff_field32(
          this.ptr_,
          TIFFTAG_IMAGEWIDTH,
        );
        const height = module.exports_.tiff_field32(
          this.ptr_,
          TIFFTAG_IMAGELENGTH,
        );
        const orientation = module.exports_.tiff_field16(
          this.ptr_,
          TIFFTAG_ORIENTATION,
        );
        const size = width * height * 4;
        const raster = module.exports_.malloc(size);
        const ret = module.exports_.tiff_decode(
          this.ptr_,
          width,
          height,
          orientation,
          raster,
        );
        if (ret === 0) {
          module.exports_.free(raster);
          throw new Error();
        }
        return new ImageData(
          new Uint8ClampedArray(module.memory8_.buffer, raster, size),
          width,
          height,
        );
      }
      decodeImageBitmap() {
        const imageData = this.decodeImageData();
        try {
          return createImageBitmap(imageData);
        } finally {
          module.freeImageData(imageData);
        }
      }
    };
  }
  /** @param {ImageData} imageData */
  freeImageData(imageData) {
    this.exports_.free(imageData.data.byteOffset);
  }
  /** @internal */
  updateViews_() {
    const buffer = this.exports_.memory.buffer;
    this.memory_ = new DataView(buffer);
    this.memory8_ = new Uint8Array(buffer);
  }
  /** @internal */
  getImportObject_() {
    const emscripten_notify_memory_growth = () => {
      this.updateViews_();
    };
    /**
     * @param {number} fd
     * @param {number} iov Iovecs
     * @param {number} iovcnt Length of iovecs
     * @param {number} pnum Pointer to where the number of bytes written will be
     *   stored
     * @returns {number} Wasi errno
     */
    const fd_write = (fd, iov, iovcnt, pnum) => {
      fd >>>= 0;
      iov >>>= 0;
      iovcnt >>>= 0;
      pnum >>>= 0;
      if (fd === 0 || fd > 2) {
        return 8 /* BADF */;
      }
      var buf = "";
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = this.memory_.getUint32(iov, true);
        var len = this.memory_.getUint32(iov + 4, true);
        iov += 8;
        buf += textDecoder.decode(this.memory8_.subarray(ptr, ptr + len), {
          stream: true,
        });
        num += len;
      }
      buf += textDecoder.decode();
      if (fd === 2) {
        console.error(buf);
      } else {
        console.log(buf);
      }
      this.memory_.setUint32(pnum, num, true);
      return 0 /* SUCCESS */;
    };
    /**
     * @param {number} environ_count {size_t *}
     * @param {number} environ_size {size_t *}
     * @returns {number} Wasi errno
     */
    const environ_sizes_get = (environ_count, environ_size) => {
      this.memory_.setUint32(environ_count, 0, true);
      this.memory_.setUint32(environ_size, 0, true);
      return 0 /* SUCCESS */;
    };
    const environ_get = () => {
      return 0 /* SUCCESS */;
    };
    /**
     * @param {number} module
     * @param {number} message
     */
    const tiff_error = (module, message) => {
      console.error(
        readString(this.memory8_, module),
        readString(this.memory8_, message),
      );
    };
    /**
     * @param {number} module
     * @param {number} message
     */
    const tiff_warn = (module, message) => {
      console.warn(
        readString(this.memory8_, module),
        readString(this.memory8_, message),
      );
    };
    return {
      env: {
        emscripten_notify_memory_growth,
        tiff_error,
        tiff_warn,
      },
      wasi_snapshot_preview1: {
        environ_sizes_get,
        environ_get,
        fd_close: nosys,
        fd_seek: nosys,
        fd_write,
      },
    };
  }
  /** @param {Response | PromiseLike<Response>} response */
  static async instantiateStreaming(response) {
    const tiff = new Tiff();
    const source = await WebAssembly.instantiateStreaming(
      response,
      tiff.getImportObject_(),
    );
    receiveInstance(tiff, source.instance);
    return {
      instance: tiff,
      module: source.module,
    };
  }
  /** @param {WebAssembly.Module} module */
  static async instantiate(module) {
    const tiff = new Tiff();
    const instance = await WebAssembly.instantiate(
      module,
      tiff.getImportObject_(),
    );
    receiveInstance(tiff, instance);
    return tiff;
  }
}
