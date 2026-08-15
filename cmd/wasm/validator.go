package main

// Board represents a 9x9 Sudoku grid.
type Board [9][9]int

// StringToBoard converts an 81-character string into a 9x9 Board.
// Characters '1'-'9' are converted to integers 1-9, while '0' or '.' represent empty cells (0).
func StringToBoard(str string) (Board, bool) {
	var b Board
	if len(str) != 81 {
		return b, false
	}
	for i := 0; i < 81; i++ {
		r := i / 9
		c := i % 9
		ch := str[i]
		if ch >= '1' && ch <= '9' {
			b[r][c] = int(ch - '0')
		} else if ch == '0' || ch == '.' {
			b[r][c] = 0
		} else {
			return b, false
		}
	}
	return b, true
}

// BoardToString converts a 9x9 Board into an 81-character string.
func BoardToString(b Board) string {
	bytes := make([]byte, 81)
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			val := b[r][c]
			if val >= 1 && val <= 9 {
				bytes[r*9+c] = byte('0' + val)
			} else {
				bytes[r*9+c] = '0'
			}
		}
	}
	return string(bytes)
}

// IsValidPlacement checks if placing `val` at board[row][col] is valid
// according to standard Sudoku rules (Row, Column, and 3x3 Box uniqueness).
func IsValidPlacement(b Board, row, col, val int) bool {
	if val < 1 || val > 9 || row < 0 || row >= 9 || col < 0 || col >= 9 {
		return false
	}

	// Check Row
	for c := 0; c < 9; c++ {
		if c != col && b[row][c] == val {
			return false
		}
	}

	// Check Column
	for r := 0; r < 9; r++ {
		if r != row && b[r][col] == val {
			return false
		}
	}

	// Check 3x3 Box
	startRow := (row / 3) * 3
	startCol := (col / 3) * 3
	for r := 0; r < 3; r++ {
		for c := 0; c < 3; c++ {
			currR := startRow + r
			currC := startCol + c
			if (currR != row || currC != col) && b[currR][currC] == val {
				return false
			}
		}
	}

	return true
}

// IsBoardValid checks if the current board has any rule violations.
func IsBoardValid(b Board) bool {
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			val := b[r][c]
			if val != 0 {
				if !IsValidPlacement(b, r, c, val) {
					return false
				}
			}
		}
	}
	return true
}

// IsBoardComplete checks if all cells are filled and valid.
func IsBoardComplete(b Board) bool {
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			if b[r][c] == 0 || !IsValidPlacement(b, r, c, b[r][c]) {
				return false
			}
		}
	}
	return true
}
