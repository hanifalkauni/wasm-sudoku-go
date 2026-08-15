# 🏆 Panduan Setup Global Leaderboard dengan Vercel KV (Redis)

Dokumen ini menjelaskan cara menghubungkan database **Vercel KV (Redis)** ke proyek WebAssembly Sudoku Anda agar fitur leaderboard global dapat menyimpan dan menampilkan skor seluruh pemain di internet secara realtime.

---

## 📌 Apa itu Vercel KV?
**Vercel KV** adalah database *key-value* berbasis **Redis (Upstash)** berlatensi sangat rendah yang terintegrasi secara *native* di dalam platform Vercel.

Dalam game Sudoku ini, kita menggunakan fitur **Redis Sorted Set (`ZADD` dan `ZREVRANGE`)**:
- Setiap skor pemain disimpan bersama payload data (Nama, Waktu, Kesalahan, Tanggal).
- Redis secara otomatis mengurutkan pemain dari skor tertinggi ke terendah secara instan.

---

## 🚀 Langkah 1: Buat KV Database di Vercel Dashboard

1. Buka [vercel.com](https://vercel.com) dan login ke akun Anda.
2. Masuk ke proyek Sudoku Anda.
3. Klik tab **"Storage"** di navigasi atas proyek.
4. Klik tombol **"Create Database"** dan pilih **"KV (Durable Redis)"**.
5. Beri nama database, misalnya: `sudoku-kv-db`.
6. Pilih region yang paling dekat (misal: *Singapore / sin1* untuk Indonesia/Asia).
7. Klik **"Create"**.

---

## 🔗 Langkah 2: Hubungkan Database ke Proyek (Automatic Environment Variables)

Setelah database dibuat:
1. Klik tombol **"Connect to Project"** dan pilih project Sudoku Anda.
2. Vercel akan secara otomatis menambahkan variabel lingkungan (*Environment Variables*) berikut ke proyek Anda:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_URL`
   - `KV_REST_API_READ_ONLY_TOKEN`
3. Klik **"Save"** atau **"Redeploy"**.

---

## 🧪 Langkah 3: Pengujian & Verifikasi

1. Buka URL aplikasi Anda yang sudah di-deploy di Vercel (misal: `https://sudoku-wasm.vercel.app`).
2. Klik ikon piala 🏆 di navbar:
   - Badge sumber data akan menampilkan **`Vercel KV (Live Redis)`**.
3. Mainkan Sudoku hingga selesai atau gunakan tombol *Instant Solve (WASM)*.
4. Masukkan nama Anda di modal kemenangan dan klik **"Kirim Skor 🚀"**.
5. Skor Anda akan langsung tersimpan di Redis Vercel KV dan tampil di urutan teratas leaderboard global!

---

## 💻 Catatan Mode Offline / Local Server

Saat Anda menjalankan aplikasi di komputer lokal melalui:
```powershell
go run server.go
```
Aplikasi secara cerdas menggunakan **Local Memory Mock Server** (`api/leaderboard.js` & `server.go`). Anda tetap dapat melihat, mengirim, dan menguji skor tanpa memerlukan koneksi internet ataupun konfigurasi environment variable tambahan.
