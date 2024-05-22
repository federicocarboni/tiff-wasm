cmake_minimum_required(VERSION 3.22)

project(tiff-wasm)

set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)

include(FetchContent)

# FetchContent_Declare(
#   libjpeg
#   URL "http://www.ijg.org/files/jpegsrc.v9f.tar.gz"
# )
# FetchContent_MakeAvailable(libjpeg)

set(BUILD_SHARED_LIBS OFF)

set(jpeg OFF)
set(zlib OFF)
set(old-jpeg OFF)
set(webp OFF)
set(pixarlog OFF)
set(ojpeg OFF)
set(zstd OFF)
set(lzma OFF)
set(lerc OFF)
set(jbig OFF)

set(tiff-tools OFF)
set(tiff-tests OFF)
set(tiff-contrib OFF)
set(tiff-docs OFF)

FetchContent_Declare(
  libtiff
  GIT_REPOSITORY "https://gitlab.com/libtiff/libtiff.git"
  GIT_TAG "v4.6.0"
)
FetchContent_MakeAvailable(libtiff)

file(GLOB source_files "src/*.c")

set(CMAKE_EXECUTABLE_SUFFIX ".wasm")

add_executable(tiff-wasm ${source_files})

target_link_libraries(tiff-wasm tiff)
target_link_options(
  tiff-wasm
  PUBLIC
  -sEXPORTED_FUNCTIONS=_malloc,_free,__emscripten_stack_alloc
  -sERROR_ON_UNDEFINED_SYMBOLS=0
  -sALLOW_MEMORY_GROWTH
  -sSTANDALONE_WASM
  --no-entry
)
target_include_directories(tiff-wasm PUBLIC tiff)

if(NOT CMAKE_BUILD_TYPE STREQUAL Debug)
  target_link_options(tiff-wasm PUBLIC -flto)
else()
  # target_link_options(tiff-wasm PUBLIC -fsanitize=address)
endif()
