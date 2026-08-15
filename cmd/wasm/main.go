package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"
	"time"
)

// generatePuzzleWrapper bridges generatePuzzle to JavaScript
// Signature: window.SudokuWasm.generatePuzzle(difficulty: string) -> string (JSON)
func generatePuzzleWrapper(this js.Value, args []js.Value) any {
	difficulty := "medium"
	if len(args) > 0 && args[0].Type() == js.TypeString {
		difficulty = args[0].String()
	}

	puzzle, solution, cluesCount := GeneratePuzzle(difficulty)

	res := map[string]any{
		"puzzle":     BoardToString(puzzle),
		"solution":   BoardToString(solution),
		"difficulty": difficulty,
		"cluesCount": cluesCount,
	}

	jsonBytes, err := json.Marshal(res)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(jsonBytes)
}

// solvePuzzleWrapper bridges solvePuzzle to JavaScript
// Signature: window.SudokuWasm.solvePuzzle(boardStr: string) -> string (JSON)
func solvePuzzleWrapper(this js.Value, args []js.Value) any {
	if len(args) < 1 || args[0].Type() != js.TypeString {
		return `{"success": false, "error": "Argument board string diperlukan"}`
	}

	boardStr := args[0].String()
	board, ok := StringToBoard(boardStr)
	if !ok {
		return `{"success": false, "error": "Format board string tidak valid (harus 81 karakter angka 0-9)"}`
	}

	start := time.Now()
	solution, success := Solve(board)
	duration := time.Since(start)

	res := map[string]any{
		"success":                  success,
		"solution":                 BoardToString(solution),
		"executionTimeMicroseconds": duration.Microseconds(),
	}

	jsonBytes, err := json.Marshal(res)
	if err != nil {
		return fmt.Sprintf(`{"success": false, "error": "%s"}`, err.Error())
	}
	return string(jsonBytes)
}

// validateMoveWrapper bridges validateMove to JavaScript
// Signature: window.SudokuWasm.validateMove(boardStr: string, row: int, col: int, val: int) -> bool
func validateMoveWrapper(this js.Value, args []js.Value) any {
	if len(args) < 4 {
		return false
	}
	boardStr := args[0].String()
	row := args[1].Int()
	col := args[2].Int()
	val := args[3].Int()

	board, ok := StringToBoard(boardStr)
	if !ok {
		return false
	}

	return IsValidPlacement(board, row, col, val)
}

// getHintWrapper bridges getHint to JavaScript
// Signature: window.SudokuWasm.getHint(currentBoardStr: string, solutionStr: string) -> string (JSON)
func getHintWrapper(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return `{"row": -1, "col": -1, "value": 0, "reason": "Missing arguments"}`
	}

	currentStr := args[0].String()
	solutionStr := args[1].String()

	current, ok1 := StringToBoard(currentStr)
	solution, ok2 := StringToBoard(solutionStr)
	if !ok1 || !ok2 {
		return `{"row": -1, "col": -1, "value": 0, "reason": "Invalid board strings"}`
	}

	hint := GetHint(current, solution)
	jsonBytes, err := json.Marshal(hint)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(jsonBytes)
}

// isCompleteWrapper bridges isComplete to JavaScript
// Signature: window.SudokuWasm.isComplete(boardStr: string) -> bool
func isCompleteWrapper(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return false
	}
	boardStr := args[0].String()
	board, ok := StringToBoard(boardStr)
	if !ok {
		return false
	}
	return IsBoardComplete(board)
}

// calculateScoreWrapper bridges calculateScore to JavaScript
// Signature: window.SudokuWasm.calculateScore(difficulty: string, timeSec: int, mistakes: int, hintsUsed: int) -> string (JSON)
func calculateScoreWrapper(this js.Value, args []js.Value) any {
	difficulty := "medium"
	timeSec := 0
	mistakes := 0
	hintsUsed := 0

	if len(args) > 0 && args[0].Type() == js.TypeString {
		difficulty = args[0].String()
	}
	if len(args) > 1 {
		timeSec = args[1].Int()
	}
	if len(args) > 2 {
		mistakes = args[2].Int()
	}
	if len(args) > 3 {
		hintsUsed = args[3].Int()
	}

	scoreRes := CalculateScore(difficulty, timeSec, mistakes, hintsUsed)
	jsonBytes, err := json.Marshal(scoreRes)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(jsonBytes)
}

// pingWrapper provides a quick health check
func pingWrapper(this js.Value, args []js.Value) any {
	return "pong from Go WebAssembly runtime"
}

func main() {
	// Dapatkan global object (window di browser)
	jsGlobal := js.Global()

	// Buat objek namespace window.SudokuWasm
	sudokuObj := jsGlobal.Get("Object").New()

	// Daftarkan semua fungsi Go
	sudokuObj.Set("generatePuzzle", js.FuncOf(generatePuzzleWrapper))
	sudokuObj.Set("solvePuzzle", js.FuncOf(solvePuzzleWrapper))
	sudokuObj.Set("validateMove", js.FuncOf(validateMoveWrapper))
	sudokuObj.Set("getHint", js.FuncOf(getHintWrapper))
	sudokuObj.Set("isComplete", js.FuncOf(isCompleteWrapper))
	sudokuObj.Set("calculateScore", js.FuncOf(calculateScoreWrapper))
	sudokuObj.Set("ping", js.FuncOf(pingWrapper))

	// Pasang ke window.SudokuWasm
	jsGlobal.Set("SudokuWasm", sudokuObj)

	fmt.Println("🚀 Go WebAssembly Sudoku Engine siap diinisialisasi!")

	// Blocking channel agar Go runtime tetap aktif di memory browser
	select {}
}
