#!/usr/bin/env bash
# Build jww2jif from LibreCAD's jwwlib (GPL-2.0) plus the adapter in this folder.
#
#   ./build.sh                 -> ./jww2jif           (native, Linux/macOS)
#   TARGET=windows ./build.sh  -> ./jww2jif.exe       (needs g++-mingw-w64-x86-64-posix)
#
# jwwlib is fetched at a pinned LibreCAD commit instead of being vendored.
set -euo pipefail
cd "$(dirname "$0")"

LIBRECAD_REF="${LIBRECAD_REF:-c51cd8474ad3ec79d8a24711d6f6da2e91f72e06}"
SRC_DIR="${JWWLIB_SRC:-$PWD/jwwlib}"
BASE_URL="https://raw.githubusercontent.com/LibreCAD/LibreCAD/${LIBRECAD_REF}/libraries/jwwlib/src"
FILES="dl_attributes.h dl_codes.h dl_creationinterface.h dl_entities.h dl_exception.h \
dl_extrusion.h dl_jww.cpp dl_jww.h dl_writer.h dl_writer_ascii.cpp dl_writer_ascii.h \
jwtype.h jwwdoc.cpp jwwdoc.h"

if [ ! -f "$SRC_DIR/dl_jww.cpp" ]; then
    mkdir -p "$SRC_DIR"
    for f in $FILES; do
        curl -fsSL "$BASE_URL/$f" -o "$SRC_DIR/$f"
    done
fi

SOURCES="jww2jif.cpp $SRC_DIR/dl_jww.cpp $SRC_DIR/jwwdoc.cpp $SRC_DIR/dl_writer_ascii.cpp"
FLAGS="-std=c++17 -O2 -w -I. -I$SRC_DIR"

if [ "${TARGET:-native}" = "windows" ]; then
    x86_64-w64-mingw32-g++-posix $FLAGS -static -o jww2jif.exe $SOURCES
    echo "built $(pwd)/jww2jif.exe"
else
    ${CXX:-g++} $FLAGS -o jww2jif $SOURCES
    echo "built $(pwd)/jww2jif"
fi
