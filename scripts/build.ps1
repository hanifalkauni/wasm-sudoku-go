# PowerShell Build Script for WebAssembly Sudoku (Windows)
$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Building Go WebAssembly Sudoku Engine   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Pastikan direktori tujuan tersedia
$webDir = "web"
$jsDir = "web/js"
if (!(Test-Path $jsDir)) {
    New-Item -ItemType Directory -Path $jsDir -Force | Out-Null
}

# 2. Cari dan salin wasm_exec.js dari instalasi Go
$goRoot = (go env GOROOT).Trim()
$wasmExecPaths = @(
    "$goRoot\lib\wasm\wasm_exec.js",
    "$goRoot\misc\wasm\wasm_exec.js"
)

$copied = $false
foreach ($path in $wasmExecPaths) {
    if (Test-Path $path) {
        Copy-Item -Path $path -Destination "$jsDir\wasm_exec.js" -Force
        Write-Host " [OK] wasm_exec.js disalin dari: $path" -ForegroundColor Green
        $copied = $true
        break
    }
}

if (-not $copied) {
    Write-Host " [WARNING] Tidak menemukan wasm_exec.js di GOROOT. Mengunduh fallback..." -ForegroundColor Yellow
}

# 3. Kompilasi Go ke WebAssembly
Write-Host " Mengompilasi cmd/wasm ke web/main.wasm..." -ForegroundColor Yellow
$env:GOOS = "js"
$env:GOARCH = "wasm"

go build -ldflags="-s -w" -o "$webDir/main.wasm" ./cmd/wasm

if (Test-Path "$webDir/main.wasm") {
    $size = (Get-Item "$webDir/main.wasm").Length / 1MB
    Write-Host " [SUCCESS] main.wasm berhasil dibuat! (Ukuran: $([math]::Round($size, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host " [ERROR] Gagal membuat main.wasm" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Build WebAssembly Selesai!              " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
