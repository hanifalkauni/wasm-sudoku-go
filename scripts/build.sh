#!/bin/bash
set -e

echo "=========================================="
echo "  Building Go WebAssembly Sudoku Engine   "
echo "=========================================="

# 1. Pastikan folder output ada
mkdir -p web/js

# 2. Salin wasm_exec.js dari instalasi Go (mencakup path Go baru lib/wasm dan path lama misc/wasm)
GOROOT_PATH=$(go env GOROOT)
if [ -f "$GOROOT_PATH/lib/wasm/wasm_exec.js" ]; then
    cp "$GOROOT_PATH/lib/wasm/wasm_exec.js" web/js/wasm_exec.js
    echo " [OK] wasm_exec.js disalin dari $GOROOT_PATH/lib/wasm/wasm_exec.js"
elif [ -f "$GOROOT_PATH/misc/wasm/wasm_exec.js" ]; then
    cp "$GOROOT_PATH/misc/wasm/wasm_exec.js" web/js/wasm_exec.js
    echo " [OK] wasm_exec.js disalin dari $GOROOT_PATH/misc/wasm/wasm_exec.js"
else
    echo " [WARNING] wasm_exec.js tidak ditemukan di GOROOT"
fi

# 3. Kompilasi program Go ke WebAssembly
echo " Mengompilasi Go ke WebAssembly (web/main.wasm)..."
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o web/main.wasm ./cmd/wasm

echo " [SUCCESS] main.wasm berhasil dibuat!"
ls -lh web/main.wasm

echo "=========================================="
echo "  Build Selesai!                         "
echo "=========================================="
