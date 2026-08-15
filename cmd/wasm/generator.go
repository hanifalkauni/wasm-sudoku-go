package main

import (
	"math/rand"
)

// Difficulty parameters
type DifficultyConfig struct {
	Name      string
	MinClues  int
	MaxClues  int
}

var difficultyConfigs = map[string]DifficultyConfig{
	"easy": {
		Name:     "easy",
		MinClues: 38,
		MaxClues: 44,
	},
	"medium": {
		Name:     "medium",
		MinClues: 30,
		MaxClues: 36,
	},
	"hard": {
		Name:     "hard",
		MinClues: 25,
		MaxClues: 29,
	},
	"expert": {
		Name:     "expert",
		MinClues: 22,
		MaxClues: 24,
	},
}

// GeneratePuzzle generates a new puzzle with a guaranteed unique solution.
func GeneratePuzzle(difficulty string) (Board, Board, int) {
	cfg, ok := difficultyConfigs[difficulty]
	if !ok {
		cfg = difficultyConfigs["medium"]
	}

	// Target clues in range [MinClues, MaxClues]
	targetClues := cfg.MinClues
	if cfg.MaxClues > cfg.MinClues {
		targetClues += rand.Intn(cfg.MaxClues - cfg.MinClues + 1)
	}

	// 1. Generate a full valid random board (solution)
	var empty Board
	solution, _ := SolveRandomized(empty)

	// 2. Start digging holes from solution while maintaining unique solution
	puzzle := solution
	type Pos struct {
		r, c int
	}

	// Create list of 81 positions
	positions := make([]Pos, 81)
	for i := 0; i < 81; i++ {
		positions[i] = Pos{r: i / 9, c: i % 9}
	}

	// Shuffle positions
	rand.Shuffle(len(positions), func(i, j int) {
		positions[i], positions[j] = positions[j], positions[i]
	})

	currentClues := 81

	for _, pos := range positions {
		if currentClues <= targetClues {
			break
		}

		r, c := pos.r, pos.c
		backup := puzzle[r][c]
		if backup == 0 {
			continue
		}

		// Remove number
		puzzle[r][c] = 0

		// Verify uniqueness
		if CountSolutions(puzzle, 2) == 1 {
			currentClues--
		} else {
			// Restore if uniqueness is broken
			puzzle[r][c] = backup
		}
	}

	return puzzle, solution, currentClues
}
