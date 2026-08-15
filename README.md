# WebAssembly Sudoku Master (Go + WASM)

Game Sudoku modern berbasis web dengan komputasi tinggi menggunakan **WebAssembly (WASM)** yang dikompilasi dari bahasa **Go (Golang)**. Game ini berjalan 100% di sisi klien (browser) tanpa memerlukan backend server untuk pembuatan puzzle, validasi, dan pencarian solusi.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Go](https://img.shields.io/badge/Go-1.24%2B-00ADD8?logo=go)
![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-654FF0?logo=webassembly)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

---

## 🌟 Fitur Utama

- 🏆 **Global Leaderboard (Vercel KV / Redis)**: Papan peringkat publik yang menyimpan rekor skor dan waktu tercepat seluruh pemain global via database Redis Vercel KV.
- ⚡ **Go WebAssembly Scoring Engine**: Formula matematis penghitungan skor adil dan predikat gelar kehormatan (*Sudoku Grandmaster*, *Logic Wizard*, dll.).
- 🎨 **Modern Glassmorphism UI**: Antarmuka estetis bertema *Dark / Light mode*, efek pencahayaan dinamis, dan animasi mikro halus.
- 🎯 **4 Tingkat Kesulitan**: *Easy*, *Medium*, *Hard*, dan *Expert*.
- ✏️ **Notes / Pencil Mode**: Mencatat angka-angka kandidat di dalam sel.
- ⏪ **Unlimited Undo / Redo**: Kemudahan membatalkan langkah permainan.
- 💡 **Smart Hint System**: Memberikan petunjuk langkah logis berikutnya beserta alasannya.
- ⌨️ **Dukungan Input Lengkap**: Keyboard (Panah, WASD, 1–9, N, U, H, Space) serta On-Screen Numpad untuk perangkat mobile/touchscreen.
- ☁️ **Siap Deploy ke Vercel**: Dilengkapi dengan konfigurasi `vercel.json` dan MIME type `application/wasm`.

---

## 📂 Struktur Proyek

```text
├── api/
│   └── leaderboard.js         # Vercel Serverless REST API (Vercel KV / Redis)
├── cmd/
│   └── wasm/
│       ├── main.go            # Entry point Wasm & registrasi syscall/js
│       ├── solver.go          # Algoritma Recursive Backtracking Solver & Unique Counter
│       ├── generator.go       # Generator puzzle acak dengan tingkat kesulitan
│       ├── validator.go       # Validasi aturan baris, kolom, dan sub-grid 3x3
│       ├── score.go           # Engine penghitung skor & gelar kehormatan Wasm
│       └── hint.go            # Mesin analisis & rekomendasi petunjuk
├── web/
│   ├── index.html             # Struktur UI Game & Leaderboard Modal
│   ├── css/
│   │   └── style.css          # Desain modern Glassmorphism & responsive layout
│   ├── js/
│   │   ├── wasm_exec.js       # Runtime glue resmi dari Go
│   │   ├── wasm_loader.js     # Loader WebAssembly dengan fallback
│   │   └── app.js             # Game controller, Wasm bridge, & API client
│   └── assets/
│       └── favicon.svg        # Logo & Favicon
├── docs/
│   ├── PRD.md                 # Product Requirements Document & Arsitektur Sistem
│   ├── PANDUAN_WEBASSEMBLY.md # Panduan Edukatif & Cara Kerja WebAssembly
│   └── LEADERBOARD_VERCEL_KV.md # Panduan 1-Click Setup Vercel KV Database
├── scripts/
│   ├── build.ps1              # Build script PowerShell (Windows)
│   └── build.sh               # Build script Bash (Linux/macOS/Vercel)
├── vercel.json                # Konfigurasi deployment Vercel
├── server.go                  # Local development server Go (+ Mock API)
├── go.mod                     # Go module definition
└── README.md                  # Dokumentasi proyek
```

---

## 🚀 Cara Menjalankan Secara Lokal

### 1. Kompilasi Kode Go ke WebAssembly
**Di Windows (PowerShell):**
```powershell
.\scripts\build.ps1
```

**Di Linux / macOS (Bash):**
```bash
chmod +x scripts/build.sh
./scripts/build.sh
```

Perintah di atas akan menyalin `wasm_exec.js` dan mengompilasi `cmd/wasm` menjadi `web/main.wasm`.

### 2. Jalankan Local Server
Jalankan development server bawaan:
```bash
go run server.go
```
Buka browser Anda dan akses: **`http://localhost:8080`**

---

## ☁️ Cara Deploy ke Vercel

1. **Push ke GitHub / GitLab / Bitbucket**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit WebAssembly Sudoku"
   git remote add origin <URL_REPOSITORY_ANDA>
   git push -u origin main
   ```

2. **Impor Proyek di Vercel Dashboard**:
   - Buka [vercel.com](https://vercel.com) dan login.
   - Klik **"Add New Project"** dan pilih repository Anda.
   - Vercel akan otomatis membaca file `vercel.json` dan menjalankan build command:
     - **Build Command**: `bash scripts/build.sh`
     - **Output Directory**: `web`
   - Klik **Deploy**!

Aplikasi Sudoku WebAssembly Anda kini live dan dapat diakses dari seluruh dunia! 🚀
