/**
 * Sudoku WebAssembly Game Controller
 * Manages game state, UI events, board rendering, and Go WebAssembly bridge.
 */

class SudokuApp {
    constructor() {
        this.board = Array(81).fill(0);
        this.initialClues = Array(81).fill(false);
        this.solution = Array(81).fill(0);
        this.notes = Array.from({ length: 81 }, () => new Set());
        
        this.selectedCell = null; // { row, col }
        this.isNotesMode = false;
        this.difficulty = 'medium';
        this.mistakes = 0;
        this.maxMistakes = 3;
        this.history = [];
        
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.isGameStarted = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.isAutoSolved = false;

        this.hintsUsed = 0;
        this.calculatedScore = 0;
        this.leaderboardDiff = 'medium';

        this.dom = {
            grid: document.getElementById('sudokuGrid'),
            boardWrapper: document.getElementById('boardWrapper'),
            boardBlurOverlay: document.getElementById('boardBlurOverlay'),
            diffBadge: document.getElementById('currentDiffBadge'),
            mistakeCounter: document.getElementById('mistakeCounter'),
            timerText: document.getElementById('gameTimer'),
            timerContainer: document.getElementById('timerContainer'),
            pauseGameBtn: document.getElementById('pauseGameBtn'),
            notesToggleBtn: document.getElementById('notesToggleBtn'),
            notesBadge: document.getElementById('notesBadge'),
            undoBtn: document.getElementById('undoBtn'),
            eraseBtn: document.getElementById('eraseBtn'),
            hintBtn: document.getElementById('hintBtn'),
            newGameBtn: document.getElementById('newGameBtn'),
            solveWasmBtn: document.getElementById('solveWasmBtn'),
            diffTabs: document.querySelectorAll('.diff-tab'),
            numBtns: document.querySelectorAll('.num-btn'),
            wasmBenchmarkText: document.getElementById('wasmBenchmarkText'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingStatus: document.getElementById('loadingStatus'),
            themeToggleBtn: document.getElementById('themeToggleBtn'),
            infoBtn: document.getElementById('infoBtn'),
            infoModal: document.getElementById('infoModal'),
            closeInfoBtn: document.getElementById('closeInfoBtn'),
            victoryModal: document.getElementById('victoryModal'),
            gameOverModal: document.getElementById('gameOverModal'),
            pauseModal: document.getElementById('pauseModal'),
            resumeBtn: document.getElementById('resumeBtn'),
            vicNewGameBtn: document.getElementById('vicNewGameBtn'),
            retryBtn: document.getElementById('retryBtn'),
            solveConfirmModal: document.getElementById('solveConfirmModal'),
            cancelSolveBtn: document.getElementById('cancelSolveBtn'),
            confirmSolveBtn: document.getElementById('confirmSolveBtn'),
            vicTime: document.getElementById('vicTime'),
            vicDiff: document.getElementById('vicDiff'),
            vicScore: document.getElementById('vicScore'),
            vicRankBadge: document.getElementById('vicRankBadge'),
            playerNameInput: document.getElementById('playerNameInput'),
            submitScoreBtn: document.getElementById('submitScoreBtn'),
            submitStatusText: document.getElementById('submitStatusText'),
            openLeaderboardFromVicBtn: document.getElementById('openLeaderboardFromVicBtn'),
            leaderboardBtn: document.getElementById('leaderboardBtn'),
            leaderboardModal: document.getElementById('leaderboardModal'),
            closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
            refreshLbBtn: document.getElementById('refreshLbBtn'),
            lbDiffTabs: document.querySelectorAll('.lb-diff-tab'),
            lbLoading: document.getElementById('lbLoading'),
            lbTable: document.getElementById('lbTable'),
            lbTableBody: document.getElementById('lbTableBody'),
            lbEmptyState: document.getElementById('lbEmptyState'),
            lbSourceBadge: document.getElementById('lbSourceBadge'),
            virtualMobileInput: document.getElementById('virtualMobileInput'),
            toastContainer: document.getElementById('toastContainer')
        };
    }

    async init() {
        this.setupTheme();
        this.setupEventListeners();
        this.createBoardElements();

        try {
            // Load Go WebAssembly Engine
            await window.wasmLoader.init((status) => {
                if (this.dom.loadingStatus) this.dom.loadingStatus.textContent = status;
            });

            // Sembunyikan loading overlay
            if (this.dom.loadingOverlay) {
                this.dom.loadingOverlay.classList.add('hidden');
            }

            // Cek apakah ada game sebelumnya yang tersimpan di local storage
            const restored = this.restoreSavedGame();
            if (!restored) {
                this.startNewGame(this.difficulty);
                this.showToast('Go WebAssembly Engine siap! Selamat bermain!');
            }
        } catch (err) {
            console.error('Error saat inisialisasi:', err);
            if (this.dom.loadingStatus) {
                this.dom.loadingStatus.textContent = 'Gagal memuat WebAssembly: ' + err.message;
            }
        }
    }

    // --------------------------------------------------------------------------
    // Theme Management
    // --------------------------------------------------------------------------
    setupTheme() {
        const savedTheme = localStorage.getItem('sudoku-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        if (this.dom.themeToggleBtn) {
            this.dom.themeToggleBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('sudoku-theme', newTheme);
            });
        }
    }

    // --------------------------------------------------------------------------
    // Board DOM Creation
    // --------------------------------------------------------------------------
    createBoardElements() {
        this.dom.grid.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.index = r * 9 + c;

                // Mini notes grid container
                const notesGrid = document.createElement('div');
                notesGrid.className = 'notes-grid';
                for (let n = 1; n <= 9; n++) {
                    const noteNum = document.createElement('span');
                    noteNum.className = 'note-num';
                    noteNum.dataset.note = n;
                    notesGrid.appendChild(noteNum);
                }
                cell.appendChild(notesGrid);

                // Main number element
                const mainVal = document.createElement('span');
                mainVal.className = 'main-val';
                cell.appendChild(mainVal);

                cell.addEventListener('click', () => this.selectCell(r, c));
                this.dom.grid.appendChild(cell);
            }
        }
    }

    // --------------------------------------------------------------------------
    // Auto-Save & Resume Game (Local Storage Persistence)
    // --------------------------------------------------------------------------
    saveGameState() {
        if (this.isGameOver || !this.board || this.board.length !== 81) return;

        const state = {
            difficulty: this.difficulty,
            board: this.board,
            initialClues: this.initialClues,
            // BUG-16 fix: solution is NOT stored in localStorage (prevents answer exposure via DevTools)
            // solution will be regenerated from WASM solver on restore
            notes: this.notes.map(s => Array.from(s)),
            history: this.history,
            timerSeconds: this.timerSeconds,
            mistakes: this.mistakes,
            hintsUsed: this.hintsUsed,
            savedAt: Date.now()
        };

        try {
            localStorage.setItem('sudoku-recent-game', JSON.stringify(state));
        } catch (e) {
            console.warn('Gagal menyimpan game ke localStorage:', e);
        }
    }

    restoreSavedGame() {
        try {
            const raw = localStorage.getItem('sudoku-recent-game');
            if (!raw) return false;

            const state = JSON.parse(raw);
            if (!state || !state.board || !Array.isArray(state.board) || state.board.length !== 81 || !state.initialClues || !Array.isArray(state.initialClues) || state.initialClues.length !== 81) return false;

            // Validasi apakah board belum selesai
            const boardStr = state.board.map(n => n.toString()).join('');
            if (window.SudokuWasm.isComplete(boardStr)) {
                this.clearSavedGame();
                return false;
            }

            this.difficulty = state.difficulty || 'medium';
            this.board = state.board;
            this.initialClues = state.initialClues;

            // BUG-16 fix: regenerate solution from WASM instead of reading from localStorage
            // Reconstruct initial clue-only board, then solve to get the solution
            const clueOnly = this.board.map((val, i) => this.initialClues[i] ? val : 0);
            const clueStr = clueOnly.map(n => n.toString()).join('');
            try {
                const solveResult = JSON.parse(window.SudokuWasm.solvePuzzle(clueStr));
                if (solveResult.success) {
                    this.solution = solveResult.solution.split('').map(Number);
                } else {
                    // Fallback: use stored solution if available (legacy saves)
                    this.solution = state.solution || Array(81).fill(0);
                }
            } catch (_) {
                this.solution = state.solution || Array(81).fill(0);
            }
            this.notes = state.notes ? state.notes.map(arr => new Set(arr)) : Array.from({ length: 81 }, () => new Set());
            this.history = state.history || [];
            this.timerSeconds = state.timerSeconds || 0;
            this.mistakes = state.mistakes || 0;
            this.hintsUsed = state.hintsUsed || 0;
            this.isGameOver = false;
            this.isAutoSolved = false; // BUG-08 fix: reset auto-solve flag on restore

            this.dom.diffBadge.textContent = this.difficulty;
            this.dom.mistakeCounter.textContent = `${this.mistakes} / ${this.maxMistakes}`;
            this.dom.diffTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.diff === this.difficulty);
            });
            this.dom.timerText.textContent = this.formatTime(this.timerSeconds);
            this.dom.wasmBenchmarkText.textContent = `Melanjutkan game (${this.difficulty})`;

            if (this.timerSeconds > 0 || (this.history && this.history.length > 0)) {
                this.isGameStarted = true;
                this.startTimer();
            } else {
                this.isGameStarted = false;
            }
            this.updatePlayPauseBtn();
            this.updateBoardLock();

            this.renderBoard();
            this.updateNumpadCounts();

            this.showToast(`🎮 Melanjutkan permainan (${this.difficulty.toUpperCase()} • ${this.formatTime(this.timerSeconds)})`);
            return true;
        } catch (e) {
            console.error('Error saat memulihkan saved game:', e);
            return false;
        }
    }

    clearSavedGame() {
        try {
            localStorage.removeItem('sudoku-recent-game');
        } catch (e) {
            console.warn('Gagal menghapus saved game:', e);
        }
    }

    // --------------------------------------------------------------------------
    // Game Initialization & WASM Calls
    // --------------------------------------------------------------------------
    startNewGame(difficulty = 'medium') {
        this.clearSavedGame();
        this.difficulty = difficulty;
        this.isGameOver = false;
        this.isGameStarted = false;
        this.isAutoSolved = false;
        this.mistakes = 0;
        this.hintsUsed = 0;
        this.calculatedScore = 0;
        this.history = [];
        this.notes = Array.from({ length: 81 }, () => new Set());
        this.selectedCell = null;

        this.dom.diffBadge.textContent = difficulty;
        this.dom.mistakeCounter.textContent = `${this.mistakes} / ${this.maxMistakes}`;
        this.dom.diffTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.diff === difficulty);
        });

        // Panggil Go WebAssembly generator
        const startTime = performance.now();
        const jsonResult = window.SudokuWasm.generatePuzzle(difficulty);
        const elapsed = (performance.now() - startTime).toFixed(1);

        try {
            const data = JSON.parse(jsonResult);
            this.parseBoardData(data.puzzle, data.solution);
            this.dom.wasmBenchmarkText.textContent = `Generated in ${elapsed}ms (${data.cluesCount} clues)`;
        } catch (e) {
            console.error('Gagal parse puzzle dari Go Wasm:', e);
        }

        this.resetTimer();
        this.updatePlayPauseBtn();
        this.updateBoardLock();
        this.renderBoard();
        this.updateNumpadCounts();
        this.saveGameState();

        // Close modals if open
        this.dom.victoryModal.classList.remove('active');
        this.dom.gameOverModal.classList.remove('active');
        if (this.dom.pauseModal) this.dom.pauseModal.classList.remove('active');
        if (this.dom.solveConfirmModal) this.dom.solveConfirmModal.classList.remove('active');
        if (this.dom.leaderboardModal) this.dom.leaderboardModal.classList.remove('active');

        this.showToast('💡 Puzzle siap! Klik "Mulai ▶️" atau sentuh kotak untuk bermain.');
    }

    parseBoardData(puzzleStr, solutionStr) {
        for (let i = 0; i < 81; i++) {
            const char = puzzleStr[i];
            const solChar = solutionStr[i];
            const num = parseInt(char, 10);
            this.board[i] = isNaN(num) ? 0 : num;
            this.initialClues[i] = num > 0;
            this.solution[i] = parseInt(solChar, 10) || 0;
        }
    }

    // --------------------------------------------------------------------------
    // Board Rendering & Highlights
    // --------------------------------------------------------------------------
    renderBoard() {
        const cells = this.dom.grid.children;
        for (let i = 0; i < 81; i++) {
            const cell = cells[i];
            const val = this.board[i];
            const isClue = this.initialClues[i];
            const mainValElem = cell.querySelector('.main-val');
            const notesGridElem = cell.querySelector('.notes-grid');
            const noteNums = notesGridElem.querySelectorAll('.note-num');

            // Reset classes & apply 3x3 block checkerboard
            const r = Math.floor(i / 9);
            const c = i % 9;
            const boxR = Math.floor(r / 3);
            const boxC = Math.floor(c / 3);

            cell.className = 'sudoku-cell';
            if ((boxR + boxC) % 2 === 1) {
                cell.classList.add('block-alt');
            }
            if (isClue) cell.classList.add('clue');

            // Render value or notes
            if (val > 0) {
                mainValElem.textContent = val;
                notesGridElem.style.display = 'none';

                // Check error
                if (!isClue && val !== this.solution[i]) {
                    cell.classList.add('error');
                }
            } else {
                mainValElem.textContent = '';
                notesGridElem.style.display = 'grid';
                
                // Render candidate notes
                const cellNotes = this.notes[i];
                noteNums.forEach(span => {
                    const noteDigit = parseInt(span.dataset.note, 10);
                    span.textContent = cellNotes.has(noteDigit) ? noteDigit : '';
                });
            }
        }

        this.updateHighlights();
        this.updateNumpadCounts();
    }

    selectCell(row, col) {
        if (this.isPaused || this.isGameOver) return;
        this.selectedCell = { row, col };
        this.updateHighlights();

        const idx = row * 9 + col;

        // Auto-start timer on first cell interaction if not yet started
        if (!this.isGameStarted && !this.initialClues[idx]) {
            this.startGame();
        }

        // Trigger Mobile Numeric Keyboard if cell is editable
        if (this.dom.virtualMobileInput) {
            if (!this.initialClues[idx]) {
                this.dom.virtualMobileInput.value = '';
                try {
                    this.dom.virtualMobileInput.focus({ preventScroll: true });
                } catch (err) {
                    this.dom.virtualMobileInput.focus();
                }
            } else {
                this.dom.virtualMobileInput.blur();
            }
        }
    }

    updateHighlights() {
        const cells = this.dom.grid.children;
        if (!this.selectedCell) {
            for (let i = 0; i < 81; i++) {
                cells[i].classList.remove('selected', 'related', 'same-number');
            }
            return;
        }

        const { row: selR, col: selC } = this.selectedCell;
        const selIdx = selR * 9 + selC;
        const selVal = this.board[selIdx];

        const selBoxR = Math.floor(selR / 3);
        const selBoxC = Math.floor(selC / 3);

        for (let i = 0; i < 81; i++) {
            const cell = cells[i];
            const r = Math.floor(i / 9);
            const c = i % 9;
            const val = this.board[i];

            cell.classList.remove('selected', 'related', 'same-number');

            if (r === selR && c === selC) {
                cell.classList.add('selected');
            } else if (r === selR || c === selC || (Math.floor(r / 3) === selBoxR && Math.floor(c / 3) === selBoxC)) {
                cell.classList.add('related');
            }

            if (selVal > 0 && val === selVal) {
                cell.classList.add('same-number');
            }
        }
    }

    updateNumpadCounts() {
        const counts = Array(10).fill(0);
        for (let i = 0; i < 81; i++) {
            const val = this.board[i];
            if (val >= 1 && val <= 9) {
                counts[val]++;
            }
        }

        for (let n = 1; n <= 9; n++) {
            const countElem = document.getElementById(`count-${n}`);
            const btn = document.querySelector(`.num-btn[data-num="${n}"]`);
            const remaining = 9 - counts[n];
            if (countElem) countElem.textContent = remaining > 0 ? remaining : '✓';
            if (btn) btn.classList.toggle('completed', remaining <= 0);
        }
    }

    // --------------------------------------------------------------------------
    // User Actions (Input, Erase, Notes, Undo, Hint, Solve)
    // --------------------------------------------------------------------------
    inputNumber(num) {
        if (!this.selectedCell || this.isPaused || this.isGameOver) return;
        const { row, col } = this.selectedCell;
        const idx = row * 9 + col;

        // Cannot overwrite initial clues
        if (this.initialClues[idx]) return;

        // Auto-start timer if not started
        if (!this.isGameStarted) {
            this.startGame();
        }

        if (this.isNotesMode) {
            // Toggle note
            const cellNotes = this.notes[idx];
            const prevNotes = new Set(cellNotes);
            if (cellNotes.has(num)) {
                cellNotes.delete(num);
            } else {
                cellNotes.add(num);
            }

            this.history.push({
                type: 'note',
                idx,
                prevNotes,
                newNotes: new Set(cellNotes)
            });
            this.renderBoard();
        } else {
            const prevVal = this.board[idx];
            if (prevVal === num) return;

            const prevNotes = new Set(this.notes[idx]);

            // Save history
            this.history.push({
                type: 'value',
                idx,
                prevVal,
                newVal: num,
                prevNotes
            });

            this.board[idx] = num;
            this.notes[idx].clear();

            // Validate Move with Go WASM / Solution
            if (num !== this.solution[idx]) {
                this.mistakes++;
                this.dom.mistakeCounter.textContent = `${this.mistakes} / ${this.maxMistakes}`;
                this.showToast(`Angka ${num} salah!`, 'error');

                if (this.mistakes >= this.maxMistakes) {
                    this.triggerGameOver();
                    return;
                }
            } else {
                // Auto clean notes in related cells
                this.cleanRelatedNotes(row, col, num);
            }

            this.renderBoard();
            this.saveGameState();
            this.checkVictory();
        }
    }

    cleanRelatedNotes(row, col, num) {
        const boxR = Math.floor(row / 3);
        const boxC = Math.floor(col / 3);

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (r === row || c === col || (Math.floor(r / 3) === boxR && Math.floor(c / 3) === boxC)) {
                    const idx = r * 9 + c;
                    this.notes[idx].delete(num);
                }
            }
        }
    }

    eraseNumber() {
        if (!this.selectedCell || this.isPaused || this.isGameOver) return;
        // BUG-06 fix: jangan erase sebelum game dimulai
        if (!this.isGameStarted) return;
        const { row, col } = this.selectedCell;
        const idx = row * 9 + col;

        if (this.initialClues[idx]) return;

        const prevVal = this.board[idx];
        const prevNotes = new Set(this.notes[idx]);

        if (prevVal === 0 && prevNotes.size === 0) return;

        this.history.push({
            type: 'erase',
            idx,
            prevVal,
            prevNotes
        });

        this.board[idx] = 0;
        this.notes[idx].clear();
        this.renderBoard();
        this.saveGameState();
    }

    undo() {
        // BUG-05 fix: jangan undo sebelum game dimulai
        if (!this.isGameStarted || this.history.length === 0 || this.isPaused || this.isGameOver) {
            this.showToast('Tidak ada langkah untuk di-undo');
            return;
        }

        const lastAction = this.history.pop();
        const { type, idx, prevVal, prevNotes } = lastAction;

        if (type === 'value' || type === 'erase') {
            this.board[idx] = prevVal;
            this.notes[idx] = new Set(prevNotes);
        } else if (type === 'note') {
            this.notes[idx] = new Set(prevNotes);
        }

        const row = Math.floor(idx / 9);
        const col = idx % 9;
        this.selectedCell = { row, col };
        this.renderBoard();
        this.saveGameState();
    }

    toggleNotesMode() {
        this.isNotesMode = !this.isNotesMode;
        this.dom.notesToggleBtn.classList.toggle('active', this.isNotesMode);
        this.dom.notesBadge.textContent = this.isNotesMode ? 'ON' : 'OFF';
    }

    getHint() {
        if (this.isPaused || this.isGameOver) return;
        // BUG-04 fix: auto-start game jika belum dimulai saat hint diklik
        if (!this.isGameStarted) this.startGame();

        const currentBoardStr = this.board.map(n => n.toString()).join('');
        const solutionStr = this.solution.map(n => n.toString()).join('');

        const hintJson = window.SudokuWasm.getHint(currentBoardStr, solutionStr);
        try {
            const hint = JSON.parse(hintJson);
            if (hint.row !== -1 && hint.col !== -1) {
                this.hintsUsed++;
                const idx = hint.row * 9 + hint.col;
                this.selectedCell = { row: hint.row, col: hint.col };
                
                // Highlight hint cell
                const cell = this.dom.grid.children[idx];
                cell.classList.add('hint-highlight');
                setTimeout(() => cell.classList.remove('hint-highlight'), 2000);

                const prevNotesMode = this.isNotesMode;
                this.isNotesMode = false;
                this.inputNumber(hint.value);
                this.isNotesMode = prevNotesMode;
                this.saveGameState();
                this.showToast(`💡 ${hint.reason}`);
            } else {
                this.showToast(hint.reason || 'Semua sel terisi!');
            }
        } catch (e) {
            console.error('Error saat request hint:', e);
        }
    }

    solveWasm() {
        if (this.isGameOver) return;
        if (this.dom.solveConfirmModal) {
            this.dom.solveConfirmModal.classList.add('active');
        } else {
            this.executeSolveWasm();
        }
    }

    closeSolveConfirmModal() {
        if (this.dom.solveConfirmModal) {
            this.dom.solveConfirmModal.classList.remove('active');
        }
    }

    executeSolveWasm() {
        if (this.isGameOver) return;
        this.closeSolveConfirmModal();
        this.isAutoSolved = true;

        const boardStr = this.board.map(n => n.toString()).join('');
        const start = performance.now();
        const resultJson = window.SudokuWasm.solvePuzzle(boardStr);
        const elapsed = (performance.now() - start).toFixed(2);

        try {
            const result = JSON.parse(resultJson);
            if (result.success) {
                for (let i = 0; i < 81; i++) {
                    this.board[i] = parseInt(result.solution[i], 10);
                    this.notes[i].clear();
                }
                this.renderBoard();
                this.dom.wasmBenchmarkText.textContent = `Wasm Solver: ${result.executionTimeMicroseconds}µs (${elapsed}ms JS)`;
                this.showToast(`⚡ Diselesaikan oleh Go WASM dalam ${result.executionTimeMicroseconds}µs!`);
                this.checkVictory();
            } else {
                this.showToast('Gagal menyelesaikan puzzle (ada kesalahan angka)', 'error');
            }
        } catch (e) {
            console.error('Error solver WASM:', e);
        }
    }

    checkVictory() {
        const boardStr = this.board.map(n => n.toString()).join('');
        if (window.SudokuWasm.isComplete(boardStr)) {
            this.pauseTimer();
            this.isGameOver = true;
            this.clearSavedGame();

            // Pastikan pause modal & confirm modal tidak aktif
            if (this.dom.pauseModal) this.dom.pauseModal.classList.remove('active');
            if (this.dom.solveConfirmModal) this.dom.solveConfirmModal.classList.remove('active');

            // 1. Calculate Score using Go WebAssembly Scoring Engine
            const scoreJson = window.SudokuWasm.calculateScore(this.difficulty, this.timerSeconds, this.mistakes, this.hintsUsed);
            try {
                const scoreData = JSON.parse(scoreJson);
                this.calculatedScore = scoreData.score || 0;
                this.dom.vicScore.textContent = this.calculatedScore.toLocaleString();
                this.dom.vicRankBadge.textContent = scoreData.rankTitle || 'Sudoku Solver';

                // Jika diselesaikan otomatis oleh AI/WASM Solver: 0 Poin dan diskualifikasi
                if (this.isAutoSolved) {
                    this.calculatedScore = 0;
                    this.dom.vicScore.textContent = '0';
                    this.dom.vicRankBadge.textContent = '🤖 WASM Solver (0 Poin)';
                    this.dom.submitScoreBtn.disabled = true;
                    this.dom.submitScoreBtn.textContent = 'Tidak Memenuhi Syarat';
                    this.dom.submitStatusText.style.color = 'var(--accent-rose)';
                    this.dom.submitStatusText.textContent = '⚠️ Puzzle diselesaikan otomatis oleh AI/WASM Solver. Skor 0 (Tidak dapat masuk Leaderboard).';
                } else {
                    // Evaluasi kelayakan Leaderboard (Anti-Spam Hint: diskualifikasi jika >= 5 hint atau skor 0)
                    const isDisqualified = this.hintsUsed >= 5 || this.calculatedScore <= 0 || scoreData.eligibleForLeaderboard === false;

                    if (isDisqualified) {
                        this.dom.submitScoreBtn.disabled = true;
                        this.dom.submitScoreBtn.textContent = 'Tidak Memenuhi Syarat';
                        this.dom.submitStatusText.style.color = 'var(--accent-rose)';
                        this.dom.submitStatusText.textContent = scoreData.message || `⚠️ Penggunaan Hint berlebih (${this.hintsUsed}x). Skor 0 (Mode Belajar/Latihan).`;
                    } else {
                        this.dom.submitScoreBtn.disabled = false;
                        this.dom.submitScoreBtn.textContent = 'Kirim Skor 🚀';
                        this.dom.submitStatusText.textContent = '';
                    }
                }
            } catch (e) {
                console.error('Error saat parse score dari Wasm:', e);
                this.calculatedScore = 0;
                this.dom.vicScore.textContent = '0';
                this.dom.vicRankBadge.textContent = 'Sudoku Solver';
            }

            this.dom.vicTime.textContent = this.formatTime(this.timerSeconds);
            this.dom.vicDiff.textContent = this.difficulty;

            // Prefill player name from localStorage
            const savedName = localStorage.getItem('sudoku-player-name') || '';
            this.dom.playerNameInput.value = savedName;

            this.dom.victoryModal.classList.add('active');
        }
    }

    triggerGameOver() {
        this.pauseTimer();
        this.isGameOver = true;
        this.clearSavedGame();
        this.dom.gameOverModal.classList.add('active');
    }

    // --------------------------------------------------------------------------
    // Leaderboard (Vercel KV / REST API Integration)
    // --------------------------------------------------------------------------
    async openLeaderboard(difficulty = null) {
        if (difficulty) {
            this.leaderboardDiff = difficulty;
        } else {
            this.leaderboardDiff = this.difficulty || 'medium';
        }

        // Update active tab in Leaderboard Modal
        this.dom.lbDiffTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.diff === this.leaderboardDiff);
        });

        this.dom.leaderboardModal.classList.add('active');
        await this.fetchLeaderboard(this.leaderboardDiff);
    }

    closeLeaderboard() {
        this.dom.leaderboardModal.classList.remove('active');
    }

    async fetchLeaderboard(difficulty) {
        this.dom.lbLoading.style.display = 'flex';
        this.dom.lbTable.style.display = 'none';
        this.dom.lbEmptyState.style.display = 'none';

        try {
            const resp = await fetch(`/api/leaderboard?difficulty=${encodeURIComponent(difficulty)}`);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();

            // Update source badge
            if (data.source === 'vercel_kv') {
                this.dom.lbSourceBadge.textContent = 'Vercel KV (Live Redis)';
            } else {
                this.dom.lbSourceBadge.textContent = 'Local / Mock Mode';
            }

            this.renderLeaderboard(data.leaderboard || []);
        } catch (err) {
            console.warn('Gagal fetch leaderboard dari API, menggunakan data offline:', err);
            this.dom.lbSourceBadge.textContent = 'Offline Mode';
            this.renderLeaderboard([]);
        } finally {
            this.dom.lbLoading.style.display = 'none';
        }
    }

    renderLeaderboard(items) {
        this.dom.lbTableBody.innerHTML = '';

        if (!items || items.length === 0) {
            this.dom.lbTable.style.display = 'none';
            this.dom.lbEmptyState.style.display = 'block';
            return;
        }

        this.dom.lbEmptyState.style.display = 'none';
        this.dom.lbTable.style.display = 'table';

        items.forEach((item, index) => {
            const row = document.createElement('tr');
            const rank = index + 1;

            let rankBadgeClass = 'rank-normal';
            let rankText = `#${rank}`;
            if (rank === 1) {
                rankBadgeClass = 'rank-1';
                rankText = '🥇';
            } else if (rank === 2) {
                rankBadgeClass = 'rank-2';
                rankText = '🥈';
            } else if (rank === 3) {
                rankBadgeClass = 'rank-3';
                rankText = '🥉';
            }

            const formattedTime = this.formatTime(item.timeSeconds || 0);
            const scoreVal = (item.score || 0).toLocaleString();

            row.innerHTML = `
                <td><span class="rank-badge ${rankBadgeClass}">${rankText}</span></td>
                <td style="font-weight: 700; color: var(--text-primary);">${this.escapeHtml(item.name || 'Anonymous')}</td>
                <td class="lb-score-val">${scoreVal}</td>
                <td style="font-feature-settings: 'tnum'; font-variant-numeric: tabular-nums;">${formattedTime}</td>
                <td style="color: var(--text-muted);">${item.mistakes ?? 0} salah</td>
            `;

            this.dom.lbTableBody.appendChild(row);
        });
    }

    async submitScore() {
        // BUG-03 fix: guard terhadap bypass via console
        if (this.isAutoSolved || this.hintsUsed >= 5 || this.calculatedScore <= 0) {
            this.showToast('⚠️ Skor tidak memenuhi syarat untuk dikirim.', 'error');
            return;
        }

        let name = (this.dom.playerNameInput.value || '').trim();
        if (!name) name = 'Pemain Sudoku';

        localStorage.setItem('sudoku-player-name', name);

        this.dom.submitScoreBtn.disabled = true;
        this.dom.submitScoreBtn.textContent = 'Mengirim...';
        this.dom.submitStatusText.style.color = 'var(--accent-cyan)';
        this.dom.submitStatusText.textContent = 'Menyimpan skor ke Vercel KV...';

        const payload = {
            name,
            difficulty: this.difficulty,
            timeSeconds: this.timerSeconds,
            mistakes: this.mistakes,
            hintsUsed: this.hintsUsed,
            score: this.calculatedScore
        };

        try {
            const resp = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            this.dom.submitStatusText.style.color = 'var(--accent-emerald)';
            this.dom.submitStatusText.textContent = '✅ Skor Anda berhasil masuk ke Leaderboard!';
            this.dom.submitScoreBtn.textContent = 'Terkirim ✓';

            this.showToast('🎉 Skor berhasil dikirim ke Leaderboard Global!');
        } catch (err) {
            console.error('Gagal kirim skor:', err);
            this.dom.submitStatusText.style.color = 'var(--accent-rose)';
            this.dom.submitStatusText.textContent = 'Gagal mengirim skor (koneksi offline).';
            this.dom.submitScoreBtn.disabled = false;
            this.dom.submitScoreBtn.textContent = 'Coba Lagi 🔄';
        }
    }

    escapeHtml(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    // --------------------------------------------------------------------------
    // Timer, Modal & Pause Management
    // --------------------------------------------------------------------------
    isDialogModalOpen() {
        return (
            (this.dom.victoryModal && this.dom.victoryModal.classList.contains('active')) ||
            (this.dom.gameOverModal && this.dom.gameOverModal.classList.contains('active')) ||
            (this.dom.solveConfirmModal && this.dom.solveConfirmModal.classList.contains('active')) ||
            (this.dom.infoModal && this.dom.infoModal.classList.contains('active')) ||
            (this.dom.leaderboardModal && this.dom.leaderboardModal.classList.contains('active'))
        );
    }

    isModalOpen() {
        return (
            this.isDialogModalOpen() ||
            (this.dom.pauseModal && this.dom.pauseModal.classList.contains('active'))
        );
    }

    updateBoardLock() {
        if (!this.dom.boardWrapper) return;
        if (this.isGameStarted) {
            this.dom.boardWrapper.classList.remove('board-locked');
        } else {
            this.dom.boardWrapper.classList.add('board-locked');
        }
    }

    startGame() {
        if (this.isGameStarted || this.isGameOver) return;
        this.isGameStarted = true;
        this.isPaused = false;
        this.startTimer();
        this.updatePlayPauseBtn();
        this.updateBoardLock();
        this.showToast('⏱️ Permainan dimulai! Selamat bermain!');
    }

    updatePlayPauseBtn() {
        if (!this.dom.pauseGameBtn) return;

        if (!this.isGameStarted) {
            this.dom.pauseGameBtn.classList.add('ready');
            this.dom.pauseGameBtn.title = 'Mulai Bermain (Aktifkan Timer)';
            this.dom.pauseGameBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>Mulai</span>
            `;
        } else if (this.isPaused) {
            this.dom.pauseGameBtn.classList.remove('ready');
            this.dom.pauseGameBtn.title = 'Lanjutkan Permainan (Spasi)';
            this.dom.pauseGameBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>Lanjut</span>
            `;
        } else {
            this.dom.pauseGameBtn.classList.remove('ready');
            this.dom.pauseGameBtn.title = 'Jeda Permainan (Pause / Spasi)';
            this.dom.pauseGameBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <rect x="5" y="4" width="4" height="16" rx="1"/>
                    <rect x="15" y="4" width="4" height="16" rx="1"/>
                </svg>
                <span>Pause</span>
            `;
        }
    }

    togglePause() {
        // Jangan toggle jika game over atau modal dialog (info, leaderboard, victory, gameover) sedang terbuka
        if (this.isGameOver || this.isDialogModalOpen()) return;

        if (!this.isGameStarted) {
            this.startGame();
            return;
        }

        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    pauseGame() {
        if (!this.isGameStarted || this.isPaused || this.isGameOver || this.isDialogModalOpen()) return;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isPaused = true;
        this.updatePlayPauseBtn();
        if (this.dom.pauseModal) this.dom.pauseModal.classList.add('active');
        this.showToast('Game di-pause (Tekan Spasi untuk lanjut)');
    }

    resumeGame() {
        if (!this.isPaused) return;

        this.isPaused = false;
        if (this.dom.pauseModal) this.dom.pauseModal.classList.remove('active');
        this.startTimer();
        this.updatePlayPauseBtn();
        this.showToast('Game dilanjutkan');
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.isPaused = false;
        this.timerInterval = setInterval(() => {
            // BUG-20 fix: cap timer at 24 hours to prevent negative scores from extremely long sessions
            if (this.timerSeconds < 86400) {
                this.timerSeconds++;
            }
            this.dom.timerText.textContent = this.formatTime(this.timerSeconds);
            if (this.timerSeconds % 3 === 0) {
                this.saveGameState();
            }
        }, 1000);
    }

    pauseTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isPaused = false;
        this.timerSeconds = 0;
        this.dom.timerText.textContent = '00:00';
    }

    formatTime(totalSec) {
        const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const secs = (totalSec % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'error') {
            toast.style.borderColor = 'var(--accent-rose)';
        }
        toast.textContent = message;
        this.dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    // --------------------------------------------------------------------------
    // Event Listeners Registration
    // --------------------------------------------------------------------------
    setupEventListeners() {
        // Toolbar actions
        this.dom.undoBtn.addEventListener('click', () => this.undo());
        this.dom.eraseBtn.addEventListener('click', () => this.eraseNumber());
        this.dom.notesToggleBtn.addEventListener('click', () => this.toggleNotesMode());
        this.dom.hintBtn.addEventListener('click', () => this.getHint());
        this.dom.solveWasmBtn.addEventListener('click', () => this.solveWasm());
        if (this.dom.cancelSolveBtn) {
            this.dom.cancelSolveBtn.addEventListener('click', () => this.closeSolveConfirmModal());
        }
        if (this.dom.confirmSolveBtn) {
            this.dom.confirmSolveBtn.addEventListener('click', () => this.executeSolveWasm());
        }
        this.dom.newGameBtn.addEventListener('click', () => this.startNewGame(this.difficulty));

        // Blur overlay click - start game when user taps the locked board
        if (this.dom.boardBlurOverlay) {
            this.dom.boardBlurOverlay.addEventListener('click', () => {
                if (!this.isGameStarted && !this.isGameOver) {
                    this.startGame();
                }
            });
            this.dom.boardBlurOverlay.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !this.isGameStarted) {
                    e.preventDefault();
                    this.startGame();
                }
            });
        }

        // Numpad clicks
        this.dom.numBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num, 10);
                this.inputNumber(num);
            });
        });

        // Difficulty tabs in main game
        this.dom.diffTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const diff = tab.dataset.diff;
                this.startNewGame(diff);
            });
        });

        // Timer & Pause Button toggles
        this.dom.timerContainer.addEventListener('click', () => {
            if (!this.isGameStarted) {
                this.startGame();
            } else {
                this.togglePause();
            }
        });

        if (this.dom.pauseGameBtn) {
            this.dom.pauseGameBtn.addEventListener('click', () => {
                if (!this.isGameStarted) {
                    this.startGame();
                } else {
                    this.togglePause();
                }
            });
        }

        // Resume button inside Pause Modal
        if (this.dom.resumeBtn) {
            this.dom.resumeBtn.addEventListener('click', () => this.resumeGame());
        }

        // Leaderboard modal toggles
        if (this.dom.leaderboardBtn) {
            this.dom.leaderboardBtn.addEventListener('click', () => this.openLeaderboard());
        }
        if (this.dom.closeLeaderboardBtn) {
            this.dom.closeLeaderboardBtn.addEventListener('click', () => this.closeLeaderboard());
        }
        if (this.dom.refreshLbBtn) {
            this.dom.refreshLbBtn.addEventListener('click', () => this.fetchLeaderboard(this.leaderboardDiff));
        }
        if (this.dom.openLeaderboardFromVicBtn) {
            this.dom.openLeaderboardFromVicBtn.addEventListener('click', () => {
                this.dom.victoryModal.classList.remove('active');
                this.openLeaderboard(this.difficulty);
            });
        }

        // Leaderboard difficulty tabs
        if (this.dom.lbDiffTabs) {
            this.dom.lbDiffTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.dom.lbDiffTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.leaderboardDiff = tab.dataset.diff;
                    this.fetchLeaderboard(this.leaderboardDiff);
                });
            });
        }

        // Submit Score button in Victory modal
        if (this.dom.submitScoreBtn) {
            this.dom.submitScoreBtn.addEventListener('click', () => this.submitScore());
        }
        if (this.dom.playerNameInput) {
            this.dom.playerNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // BUG-18 fix: only submit if button is not disabled
                    if (!this.dom.submitScoreBtn.disabled) {
                        this.submitScore();
                    }
                }
            });
        }

        // Mobile Soft Keyboard Proxy Events
        if (this.dom.virtualMobileInput) {
            this.dom.virtualMobileInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val) {
                    const lastChar = val.slice(-1);
                    if (lastChar >= '1' && lastChar <= '9') {
                        this.inputNumber(parseInt(lastChar, 10));
                    }
                }
                e.target.value = '';
            });
        }

        // Info modal
        this.dom.infoBtn.addEventListener('click', () => this.dom.infoModal.classList.add('active'));
        this.dom.closeInfoBtn.addEventListener('click', () => this.dom.infoModal.classList.remove('active'));

        // Modals retry / new game
        this.dom.vicNewGameBtn.addEventListener('click', () => this.startNewGame(this.difficulty));
        this.dom.retryBtn.addEventListener('click', () => this.startNewGame(this.difficulty));

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            // 0. ESCAPE KEY HANDLING (Close active dialog modals)
            if (e.key === 'Escape') {
                if (this.dom.infoModal && this.dom.infoModal.classList.contains('active')) {
                    this.dom.infoModal.classList.remove('active');
                    return;
                }
                if (this.dom.leaderboardModal && this.dom.leaderboardModal.classList.contains('active')) {
                    this.closeLeaderboard();
                    return;
                }
                if (this.dom.solveConfirmModal && this.dom.solveConfirmModal.classList.contains('active')) {
                    this.closeSolveConfirmModal();
                    return;
                }
            }
            // 1. SPACE KEY HANDLING (Global Pause & Resume)
            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                // If typing inside player name input, allow space
                if (e.target && e.target.tagName === 'INPUT') return;

                e.preventDefault();
                // Remove focus from any active element so Space doesn't re-trigger buttons
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
                this.togglePause();
                return;
            }

            // 2. Ignore gameplay inputs if paused, game over, or modal is open
            if (this.isPaused || this.isGameOver || this.isModalOpen()) return;

            // Numbers 1-9 (Main keyboard and Numpad)
            if ((e.key >= '1' && e.key <= '9') || (e.code && e.code.startsWith('Numpad') && e.code.slice(6) >= '1' && e.code.slice(6) <= '9')) {
                e.preventDefault();
                const num = (e.key >= '1' && e.key <= '9') ? parseInt(e.key, 10) : parseInt(e.code.slice(6), 10);
                this.inputNumber(num);
                if (this.dom.virtualMobileInput) this.dom.virtualMobileInput.value = '';
                return;
            }

            // Erase (Backspace / Delete)
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                this.eraseNumber();
                if (this.dom.virtualMobileInput) this.dom.virtualMobileInput.value = '';
                return;
            }

            // Shortcuts
            if (e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.toggleNotesMode();
                return;
            }
            if (e.key.toLowerCase() === 'u') {
                e.preventDefault();
                this.undo();
                return;
            }
            if (e.key.toLowerCase() === 'h') {
                e.preventDefault();
                this.getHint();
                return;
            }

            // Arrow Keys Navigation
            // BUG-14 fix: arrow / WASD only navigates, does NOT auto-start timer
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
                e.preventDefault();
                let r = this.selectedCell ? this.selectedCell.row : 0;
                let c = this.selectedCell ? this.selectedCell.col : 0;

                if (e.key === 'ArrowUp' || e.key === 'w') r = (r - 1 + 9) % 9;
                if (e.key === 'ArrowDown' || e.key === 's') r = (r + 1) % 9;
                if (e.key === 'ArrowLeft' || e.key === 'a') c = (c - 1 + 9) % 9;
                if (e.key === 'ArrowRight' || e.key === 'd') c = (c + 1) % 9;

                // Only update selectedCell highlight, do NOT call startGame()
                if (!this.isPaused && !this.isGameOver) {
                    this.selectedCell = { row: r, col: c };
                    this.updateHighlights();
                }
            }
        });

        // Auto-save game state when leaving/switching tabs
        window.addEventListener('beforeunload', () => this.saveGameState());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveGameState();
            }
        });
    }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.sudokuApp = new SudokuApp();
    window.sudokuApp.init();
});
