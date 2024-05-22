
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <tiff.h>
#include <tiffio.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

struct cursor {
  tdata_t data;
  tsize_t size;
  toff_t offset;
};

static tsize_t cursor_read(thandle_t handle, tdata_t buf, tsize_t size) {
  struct cursor *cursor = handle;
  tsize_t n;
  if (cursor->offset + size <= cursor->size) {
    n = size;
  } else {
    n = cursor->size - cursor->offset;
  }
  memcpy(buf, cursor->data + cursor->offset, n);
  cursor->offset += n;
  return n;
}

static tsize_t cursor_write(thandle_t handle, tdata_t buf, tsize_t size) {
  return 0;
}

static toff_t cursor_seek(thandle_t handle, toff_t offset, int whence) {
  struct cursor *cursor = handle;
  switch (whence) {
  case SEEK_SET:
    cursor->offset = offset;
    break;
  case SEEK_CUR:
    cursor->offset = cursor->offset + offset;
    break;
  case SEEK_END:
    cursor->offset = cursor->size + offset;
    break;
  }
  if (cursor->offset > cursor->size) {
    cursor->offset = cursor->size;
  }
  return cursor->offset;
}

static int cursor_close(thandle_t handle) {
  struct cursor *cursor = handle;
  cursor->offset = 0;
  return 0;
}

static toff_t cursor_size(thandle_t handle) {
  return ((struct cursor *)handle)->size;
}

static int cursor_mmap(thandle_t handle, tdata_t *data, toff_t *size) {
  struct cursor *cursor = handle;
  *data = cursor->data;
  *size = cursor->size;
  return 1;
}

static void cursor_munmap(thandle_t handle, tdata_t data, toff_t size) {}

static struct cursor *cursor_new(void *data, size_t size) {
  struct cursor *cursor = malloc(sizeof(*cursor));
  cursor->data = data;
  cursor->size = size;
  cursor->offset = 0;
  return cursor;
}

extern void tiff_error(const char *module, const char *message);
extern void tiff_warn(const char *module, const char *message);

static void error_handler(const char *module, const char *fmt, va_list ap) {
  char message[1024];
  vsnprintf(message, sizeof(message), fmt, ap);
  tiff_error(module, message);
}

static void warn_handler(const char *module, const char *fmt, va_list ap) {
  char message[1024];
  vsnprintf(message, sizeof(message), fmt, ap);
  tiff_warn(module, message);
}

static void warn_handlera(const char *module, const char *fmt, ...) {
  char message[1024];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(message, sizeof(message), fmt, ap);
  va_end(ap);
  tiff_warn(module, message);
}

__attribute__((constructor)) static void init(void) {
  TIFFSetErrorHandler(error_handler);
  TIFFSetWarningHandler(warn_handler);
}

EMSCRIPTEN_KEEPALIVE
TIFF *tiff_open(void *data, size_t size) {
  struct cursor *cursor = cursor_new(data, size);
  TIFF *tiff = TIFFClientOpen("memory", "r", cursor, cursor_read, cursor_write,
                              cursor_seek, cursor_close, cursor_size,
                              cursor_mmap, cursor_munmap);
  return tiff;
}

EMSCRIPTEN_KEEPALIVE
void tiff_close(TIFF *tiff) {
  struct cursor *cursor = (struct cursor *)TIFFClientdata(tiff);
  TIFFClose(tiff);
  free(cursor->data);
  free(cursor);
}

EMSCRIPTEN_KEEPALIVE
int tiff_decode(TIFF *tiff, uint32_t width, uint32_t height, int orientation,
                uint32_t *data) {
  return TIFFReadRGBAImageOriented(tiff, width, height, data, orientation, 0);
}

EMSCRIPTEN_KEEPALIVE
uint32_t tiff_field32(TIFF *tiff, uint32_t tag) {
  uint32_t value = 0;
  TIFFGetFieldDefaulted(tiff, tag, &value);
  return value;
}

EMSCRIPTEN_KEEPALIVE
uint16_t tiff_field16(TIFF *tiff, uint32_t tag) {
  uint16_t value = 0;
  TIFFGetFieldDefaulted(tiff, tag, &value);
  return value;
}
