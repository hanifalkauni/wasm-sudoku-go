#!/bin/bash
set -e

echo "=========================================="
echo "  Building Go WebAssembly Sudoku Engine   "
echo "=========================================="

mkdir -p web/js

# Check if 'go' binary is available in the environment
if command -v go >/dev/null 2>&1; then
    echo " [OK] Go compiler ditemukan: $(go version)"
    
    # 1. Salin wasm_exec.js dari instalasi Go
    GOROOT_PATH=$(go env GOROOT)
    if [ -f "$GOROOT_PATH/lib/wasm/wasm_exec.js" ]; then
        cp "$GOROOT_PATH/lib/wasm/wasm_exec.js" web/js/wasm_exec.js
        echo " [OK] wasm_exec.js disalin dari $GOROOT_PATH/lib/wasm/wasm_exec.js"
    elif [ -f "$GOROOT_PATH/misc/wasm/wasm_exec.js" ]; then
        cp "$GOROOT_PATH/misc/wasm/wasm_exec.js" web/js/wasm_exec.js
        echo " [OK] wasm_exec.js disalin dari $GOROOT_PATH/misc/wasm/wasm_exec.js"
    fi

    # 2. Kompilasi Go ke WebAssembly
    echo " Mengompilasi Go ke WebAssembly (web/main.wasm)..."
    GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o web/main.wasm ./cmd/wasm
    echo " [SUCCESS] main.wasm berhasil dikompilasi!"
else
    echo " [INFO] Go compiler tidak ditemukan di build environment ini."
    
    # Verifikasi apakah pre-compiled biner sudah ada di repository
    if [ -f "web/main.wasm" ] && [ -f "web/js/wasm_exec.js" ]; then
        echo " [OK] Menggunakan pre-compiled WebAssembly binary: web/main.wasm"
        echo " [OK] Menggunakan runtime: web/js/wasm_exec.js"
    else
        echo " [DOWNLOAD] Mengunduh Go compiler portabel untuk kompilasi..."
        curl -sL https://go.dev/dl/go1.24.0.linux-amd64.tar.gz | tar -xz -C /tmp/
        export PATH="/tmp/go/bin:$PATH"
        cp /tmp/go/lib/wasm/wasm_exec.js web/js/wasm_exec.js
        GOOS=js GOARCH=wasm /tmp/go/bin/go build -ldflags="-s -w" -o web/main.wasm ./cmd/wasm
        echo " [SUCCESS] main.wasm berhasil dibuat!"
    fi
fi

ls -lh web/main.wasm web/js/wasm_exec.js

echo "=========================================="
echo "  Build WebAssembly Siap untuk Vercel!   "
echo "=========================================="
