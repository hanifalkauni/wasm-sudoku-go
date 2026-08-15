package main

import (
	"fmt"
)

// HintResult contains details about the recommended move.
type HintResult struct {
	Row     int    `json:"row"`
	Col     int    `json:"col"`
	Value   int    `json:"value"`
	Reason  string `json:"reason"`
	IsError bool   `json:"isError"`
}

// GetHint analyzes the player's current board against the ground-truth solution
// and returns the best recommended hint.
func GetHint(current Board, solution Board) HintResult {
	// 1. Check for incorrect cells first
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			if current[r][c] != 0 && current[r][c] != solution[r][c] {
				return HintResult{
					Row:     r,
					Col:     c,
					Value:   solution[r][c],
					Reason:  fmt.Sprintf("Angka %d di baris %d kolom %d salah. Nilai yang benar adalah %d.", current[r][c], r+1, c+1, solution[r][c]),
					IsError: true,
				}
			}
		}
	}

	// 2. Find Naked Singles (cells that can only contain 1 number logically)
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			if current[r][c] == 0 {
				candidates := GetCandidates(current, r, c)
				if len(candidates) == 1 {
					return HintResult{
						Row:     r,
						Col:     c,
						Value:   candidates[0],
						Reason:  fmt.Sprintf("Naked Single: Sel baris %d kolom %d hanya memiliki satu kemungkinan angka yaitu %d.", r+1, c+1, candidates[0]),
						IsError: false,
					}
				}
			}
		}
	}

	// 3. Find any empty cell that has the fewest candidates
	bestR, bestC, bestCandidates, hasEmpty := findBestEmptyCell(current)
	if hasEmpty && bestR != -1 {
		correctVal := solution[bestR][bestC]
		return HintResult{
			Row:     bestR,
			Col:     bestC,
			Value:   correctVal,
			Reason:  fmt.Sprintf("Petunjuk: Isi sel baris %d kolom %d dengan angka %d (Kandidat: %v).", bestR+1, bestC+1, correctVal, bestCandidates),
			IsError: false,
		}
	}

	return HintResult{
		Row:     -1,
		Col:     -1,
		Value:   0,
		Reason:  "Papan sudah selesai terisi!",
		IsError: false,
	}
}
