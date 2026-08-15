package main

import (
	"math/rand"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// GetCandidates returns a slice of valid numbers (1-9) that can be placed at board[row][col].
func GetCandidates(b Board, row, col int) []int {
	var candidates []int
	for val := 1; val <= 9; val++ {
		if IsValidPlacement(b, row, col, val) {
			candidates = append(candidates, val)
		}
	}
	return candidates
}

// findBestEmptyCell finds the empty cell with the fewest candidates (MRV Heuristic).
// Returns row, col, candidates list, and found flag.
func findBestEmptyCell(b Board) (int, int, []int, bool) {
	bestR, bestC := -1, -1
	var bestCandidates []int
	minCount := 10

	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			if b[r][c] == 0 {
				candidates := GetCandidates(b, r, c)
				count := len(candidates)
				if count == 0 {
					// Dead end: this cell has no valid candidates
					return r, c, nil, true
				}
				if count < minCount {
					minCount = count
					bestR = r
					bestC = c
					bestCandidates = candidates
					if count == 1 {
						// Optimal choice (forced move)
						return bestR, bestC, bestCandidates, true
					}
				}
			}
		}
	}

	if bestR == -1 {
		return -1, -1, nil, false // Board is completely filled
	}
	return bestR, bestC, bestCandidates, true
}

// Solve finds a valid solution for the given board.
func Solve(b Board) (Board, bool) {
	if !IsBoardValid(b) {
		return b, false
	}
	var solvedBoard Board
	found := false

	var backtrack func(curr Board) bool
	backtrack = func(curr Board) bool {
		r, c, candidates, hasEmpty := findBestEmptyCell(curr)
		if !hasEmpty {
			solvedBoard = curr
			found = true
			return true
		}
		if len(candidates) == 0 {
			return false
		}

		for _, val := range candidates {
			curr[r][c] = val
			if backtrack(curr) {
				return true
			}
			curr[r][c] = 0
		}
		return false
	}

	backtrack(b)
	return solvedBoard, found
}

// CountSolutions counts the number of valid solutions up to a given limit (useful for uniqueness testing).
func CountSolutions(b Board, limit int) int {
	if !IsBoardValid(b) {
		return 0
	}
	count := 0

	var backtrack func(curr Board)
	backtrack = func(curr Board) {
		if count >= limit {
			return
		}
		r, c, candidates, hasEmpty := findBestEmptyCell(curr)
		if !hasEmpty {
			count++
			return
		}
		if len(candidates) == 0 {
			return
		}

		for _, val := range candidates {
			curr[r][c] = val
			backtrack(curr)
			curr[r][c] = 0
			if count >= limit {
				return
			}
		}
	}

	backtrack(b)
	return count
}

// SolveRandomized generates a random valid solution from a given board state.
func SolveRandomized(b Board) (Board, bool) {
	var solvedBoard Board
	found := false

	var backtrack func(curr Board) bool
	backtrack = func(curr Board) bool {
		r, c, candidates, hasEmpty := findBestEmptyCell(curr)
		if !hasEmpty {
			solvedBoard = curr
			found = true
			return true
		}
		if len(candidates) == 0 {
			return false
		}

		// Shuffle candidates for randomness
		shuffled := make([]int, len(candidates))
		copy(shuffled, candidates)
		rand.Shuffle(len(shuffled), func(i, j int) {
			shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
		})

		for _, val := range shuffled {
			curr[r][c] = val
			if backtrack(curr) {
				return true
			}
			curr[r][c] = 0
		}
		return false
	}

	backtrack(b)
	return solvedBoard, found
}
