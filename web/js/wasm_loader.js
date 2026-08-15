/**
 * WebAssembly Loader for Sudoku Game
 * Initializes the Go WebAssembly runtime and verifies the window.SudokuWasm API bridge.
 */

class WasmLoader {
    constructor(wasmPath = 'main.wasm') {
        this.wasmPath = wasmPath;
        this.isReady = false;
        this.go = null;
    }

    async init(onProgress) {
        if (typeof Go === 'undefined') {
            throw new Error('Runtime Go tidak ditemukan. Pastikan wasm_exec.js telah dimuat.');
        }

        this.go = new Go();

        if (onProgress) onProgress('Mengunduh biner WebAssembly...');

        let wasmModule;
        try {
            // Coba instantiate streaming terlebih dahulu (paling efisien & cepat)
            if (WebAssembly.instantiateStreaming) {
                const response = await fetch(this.wasmPath);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                wasmModule = await WebAssembly.instantiateStreaming(response, this.go.importObject);
            } else {
                throw new Error('instantiateStreaming tidak didukung');
            }
        } catch (streamingErr) {
            console.warn('Streaming compilation gagal, beralih ke ArrayBuffer fallback:', streamingErr);
            if (onProgress) onProgress('Memuat WebAssembly (ArrayBuffer fallback)...');

            const resp = await fetch(this.wasmPath);
            if (!resp.ok) {
                throw new Error(`Gagal mengunduh ${this.wasmPath}: ${resp.statusText}`);
            }
            const bytes = await resp.arrayBuffer();
            wasmModule = await WebAssembly.instantiate(bytes, this.go.importObject);
        }

        if (onProgress) onProgress('Menjalankan Go WebAssembly Runtime...');

        // Jalankan program Go di latar belakang
        this.go.run(wasmModule.instance);

        // Tunggu hingga window.SudokuWasm terdaftar
        await this.waitForBridge();

        this.isReady = true;
        console.log('✅ WebAssembly Sudoku Engine siap!', window.SudokuWasm.ping());
        return window.SudokuWasm;
    }

    async waitForBridge(timeoutMs = 5000) {
        const start = Date.now();
        while (!window.SudokuWasm || typeof window.SudokuWasm.generatePuzzle !== 'function') {
            if (Date.now() - start > timeoutMs) {
                throw new Error('Timeout: Objek window.SudokuWasm tidak terdaftar tepat waktu.');
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

// Global instance
window.wasmLoader = new WasmLoader();
