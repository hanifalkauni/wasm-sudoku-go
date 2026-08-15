package main

// ScoreResult represents the calculated score and rank.
type ScoreResult struct {
	Score                  int    `json:"score"`
	RankTitle              string `json:"rankTitle"`
	Difficulty             string `json:"difficulty"`
	EligibleForLeaderboard bool   `json:"eligibleForLeaderboard"`
	Message                string `json:"message"`
}

// CalculateScore computes a competitive score based on difficulty, time, mistakes, and hints used.
func CalculateScore(difficulty string, timeSeconds int, mistakes int, hintsUsed int) ScoreResult {
	baseScore := 5000

	switch difficulty {
	case "easy":
		baseScore = 3500
	case "medium":
		baseScore = 5500
	case "hard":
		baseScore = 8500
	case "expert":
		baseScore = 13000
	}

	// Strict Anti-Spam: If user spammed 5 or more hints, 0 points and disqualified from leaderboard
	if hintsUsed >= 5 {
		return ScoreResult{
			Score:                  0,
			RankTitle:              "🌱 Mode Latihan (Spam Hint)",
			Difficulty:             difficulty,
			EligibleForLeaderboard: false,
			Message:                "Penggunaan hint lebih dari 4x dihitung sebagai mode latihan (0 poin).",
		}
	}

	// Gentle Time penalty: 1 point per second (so thoughtful normal play is rewarded)
	timePenalty := timeSeconds * 1

	// Mistake penalty: 200 points per mistake
	mistakePenalty := mistakes * 200

	// Progressive Hint penalty:
	// 1 hint: 400, 2 hints: 1000, 3 hints: 2000, 4 hints: 3500
	hintPenalty := 0
	switch hintsUsed {
	case 1:
		hintPenalty = 400
	case 2:
		hintPenalty = 1000
	case 3:
		hintPenalty = 2000
	case 4:
		hintPenalty = 3500
	}

	totalScore := baseScore - timePenalty - mistakePenalty - hintPenalty
	if totalScore < 0 {
		totalScore = 0
	}

	// If score is 0, not eligible for leaderboard
	eligible := totalScore > 0

	// Determine honorary rank title
	rankTitle := "🔍 Sudoku Solver"
	if hintsUsed == 0 && mistakes == 0 {
		if totalScore >= 10000 {
			rankTitle = "👑 Sudoku Grandmaster"
		} else if totalScore >= 6500 {
			rankTitle = "⚡ Sudoku Master"
		} else if totalScore >= 4000 {
			rankTitle = "🧠 Logic Wizard"
		} else {
			rankTitle = "✨ Flawless Solver"
		}
	} else if totalScore >= 8000 {
		rankTitle = "⚡ Sudoku Master"
	} else if totalScore >= 5000 {
		rankTitle = "🧠 Logic Wizard"
	} else if totalScore >= 2000 {
		rankTitle = "🔍 Puzzle Solver"
	} else if totalScore > 0 {
		rankTitle = "🌱 Sudoku Apprentice"
	} else {
		rankTitle = "🌱 Mode Latihan"
	}

	return ScoreResult{
		Score:                  totalScore,
		RankTitle:              rankTitle,
		Difficulty:             difficulty,
		EligibleForLeaderboard: eligible,
		Message:                "",
	}
}
