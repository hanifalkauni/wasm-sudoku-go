package main

// ScoreResult represents the calculated score and rank.
type ScoreResult struct {
	Score      int    `json:"score"`
	RankTitle  string `json:"rankTitle"`
	Difficulty string `json:"difficulty"`
}

// CalculateScore computes a competitive score based on difficulty, time, mistakes, and hints used.
func CalculateScore(difficulty string, timeSeconds int, mistakes int, hintsUsed int) ScoreResult {
	baseScore := 5000

	switch difficulty {
	case "easy":
		baseScore = 3000
	case "medium":
		baseScore = 5000
	case "hard":
		baseScore = 8000
	case "expert":
		baseScore = 12000
	}

	// Time penalty: 2 points per second
	timePenalty := timeSeconds * 2

	// Mistake penalty: 150 points per mistake
	mistakePenalty := mistakes * 150

	// Hint penalty: 100 points per hint used
	hintPenalty := hintsUsed * 100

	totalScore := baseScore - timePenalty - mistakePenalty - hintPenalty
	if totalScore < 100 {
		totalScore = 100 // Minimum participation score
	}

	// Determine honorary rank title
	rankTitle := "Sudoku Novice"
	if totalScore >= 10000 {
		rankTitle = "👑 Sudoku Grandmaster"
	} else if totalScore >= 7000 {
		rankTitle = "⚡ Sudoku Master"
	} else if totalScore >= 4500 {
		rankTitle = "🧠 Logic Wizard"
	} else if totalScore >= 2500 {
		rankTitle = "🔍 Puzzle Solver"
	}

	return ScoreResult{
		Score:      totalScore,
		RankTitle:  rankTitle,
		Difficulty: difficulty,
	}
}
