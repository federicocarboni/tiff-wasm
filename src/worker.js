import {Tiff} from "./index.js";

/**
 * @typedef {object} WorkerMessage
 * @property {1 | 3 | 4} t
 *
 *   - 1: init
 *   - 3: decode to image bitmap
 *   - 4: decode to image data
 *
 * @property {WebAssembly.Module | Uint8Array} [v]
 */

/**
 * @typedef {object} WorkerResponse
 * @property {0 | 1 | 3 | 4} t
 *
 *   - 0: error
 *   - 1: init streaming success
 *   - 3: decode to image bitmap
 *   - 4: decode to image data
 *
 * @property {ImageData | ImageBitmap | WebAssembly.Module | Error} [v]
 */

addEventListener("message", handleEvent);

/** @type {Tiff} */
let tiff;

/** @param {MessageEvent} event */
async function handleEvent(event) {
  /** @type {WorkerMessage} */
  const data = event.data;
  switch (data.t) {
    case 1: {
      const module = data.v;
      try {
        if (module === undefined) {
          const {instance, module} = await Tiff.instantiateStreaming(
            fetch("/tiff.wasm"),
          );
          tiff = instance;
          postMessage({
            t: 1,
            v: module,
          });
        } else {
          tiff = await Tiff.instantiate(module);
          postMessage({
            t: 1,
          });
        }
      } catch (error) {
        tiff = undefined;
        console.error(error);
        postMessage({
          t: 0,
          v: error,
        });
      }
      break;
    }
    case 3:
    case 4: {
      let tiffDecoder;
      let imageData;
      try {
        tiffDecoder = new tiff.TiffDecoder(data["v"]);
        if (data.t === 3) {
          const imageBitmap = await tiffDecoder.decodeImageBitmap();
          postMessage(
            {
              t: 3,
              v: imageBitmap,
            },
            [imageBitmap]
          );
        } else {
          imageData = tiffDecoder.decodeImageData();
          postMessage({
            t: 4,
            v: imageData,
          });
        }
      } catch (error) {
        postMessage({
          t: 0,
          v: error,
        });
      } finally {
        if (tiffDecoder !== undefined) {
          tiffDecoder.free();
        }
        if (imageData !== undefined) {
          tiff.freeImageData(imageData);
        }
      }
      break;
    }
  }
}
