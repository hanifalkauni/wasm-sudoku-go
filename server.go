package main

import (
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// LeaderboardEntry represents a single leaderboard record.
type LeaderboardEntry struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Difficulty  string `json:"difficulty"`
	Score       int    `json:"score"`
	TimeSeconds int    `json:"timeSeconds"`
	Mistakes    int    `json:"mistakes"`
	HintsUsed   int    `json:"hintsUsed"`
	Date        string `json:"date"`
}

// submitPayload is the expected client request body.
// 'Score' field is intentionally IGNORED — server recalculates (BUG-13 fix).
type submitPayload struct {
	Name        string `json:"name"`
	Difficulty  string `json:"difficulty"`
	TimeSeconds int    `json:"timeSeconds"`
	Mistakes    int    `json:"mistakes"`
	HintsUsed   int    `json:"hintsUsed"`
	// Score field intentionally omitted — server computes it
}

// calculateScoreLocal mirrors the formula in cmd/wasm/score.go.
// BUG-13 fix: score is always computed server-side, never trusted from client.
func calculateScoreLocal(difficulty string, timeSeconds, mistakes, hintsUsed int) (score int, eligible bool) {
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

	if hintsUsed >= 5 {
		return 0, false
	}

	hintPenalties := map[int]int{0: 0, 1: 400, 2: 1000, 3: 2000, 4: 3500}
	hintPenalty := hintPenalties[hintsUsed]
	timePenalty := timeSeconds
	mistakePenalty := mistakes * 200

	total := baseScore - timePenalty - mistakePenalty - hintPenalty
	if total < 0 {
		total = 0
	}
	return total, total > 0
}

// isAllowedOrigin restricts which origins can POST to the leaderboard.
// BUG-17 fix: no longer wildcard.
func isAllowedOrigin(origin string) bool {
	allowed := []string{"localhost", "127.0.0.1", ".vercel.app"}
	for _, a := range allowed {
		if strings.Contains(origin, a) {
			return true
		}
	}
	return false
}

var (
	lbMutex     sync.RWMutex
	leaderboard = map[string][]LeaderboardEntry{
		"easy": {
			{ID: "1", Name: "Budi Wasm", Difficulty: "easy", Score: 2820, TimeSeconds: 65, Mistakes: 0, HintsUsed: 0, Date: "2026-08-15T12:00:00Z"},
			{ID: "2", Name: "Siti Logic", Difficulty: "easy", Score: 2650, TimeSeconds: 110, Mistakes: 1, HintsUsed: 0, Date: "2026-08-15T12:15:00Z"},
		},
		"medium": {
			{ID: "3", Name: "Arya Sudoku", Difficulty: "medium", Score: 4620, TimeSeconds: 140, Mistakes: 0, HintsUsed: 1, Date: "2026-08-15T12:30:00Z"},
			{ID: "4", Name: "Dewi Master", Difficulty: "medium", Score: 4300, TimeSeconds: 200, Mistakes: 2, HintsUsed: 0, Date: "2026-08-15T12:45:00Z"},
		},
		"hard": {
			{ID: "5", Name: "Rian Grandmaster", Difficulty: "hard", Score: 7200, TimeSeconds: 250, Mistakes: 1, HintsUsed: 1, Date: "2026-08-15T13:00:00Z"},
		},
		"expert": {
			{ID: "6", Name: "Eko Bytecode", Difficulty: "expert", Score: 10500, TimeSeconds: 420, Mistakes: 2, HintsUsed: 1, Date: "2026-08-15T13:30:00Z"},
		},
	}
)

func handleLeaderboardAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// BUG-17 fix: restrict CORS to known safe origins
	origin := r.Header.Get("Origin")
	if origin == "" || isAllowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "")
	}

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == http.MethodGet {
		diff := strings.ToLower(r.URL.Query().Get("difficulty"))
		if diff == "" {
			diff = "medium"
		}

		lbMutex.RLock()
		entries, exists := leaderboard[diff]
		if !exists {
			entries = []LeaderboardEntry{}
		}
		lbMutex.RUnlock()

		resp := map[string]any{
			"source":      "local_server_mock",
			"difficulty":  diff,
			"count":       len(entries),
			"leaderboard": entries,
		}
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	if r.Method == http.MethodPost {
		// BUG-13 fix: decode only editable fields; ignore any 'score' from client
		var payload submitPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, `{"error": "Invalid JSON"}`, http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(payload.Name)
		if name == "" {
			name = "Pemain Sudoku"
		}
		if len(name) > 25 {
			name = name[:25]
		}
		// Strip basic HTML tags
		name = strings.NewReplacer("<", "", ">", "", "/", "").Replace(name)

		diff := strings.ToLower(payload.Difficulty)
		validDiffs := map[string]bool{"easy": true, "medium": true, "hard": true, "expert": true}
		if !validDiffs[diff] {
			diff = "medium"
		}

		timeSeconds := payload.TimeSeconds
		if timeSeconds < 0 { timeSeconds = 0 }
		if timeSeconds > 86400 { timeSeconds = 86400 }

		mistakes := payload.Mistakes
		if mistakes < 0 { mistakes = 0 }
		if mistakes > 100 { mistakes = 100 }

		hintsUsed := payload.HintsUsed
		if hintsUsed < 0 { hintsUsed = 0 }
		if hintsUsed > 100 { hintsUsed = 100 }

		// Recalculate score server-side (client value ignored)
		serverScore, eligible := calculateScoreLocal(diff, timeSeconds, mistakes, hintsUsed)
		if !eligible {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Skor tidak memenuhi syarat masuk leaderboard.",
			})
			return
		}

		entry := LeaderboardEntry{
			ID:          fmt.Sprintf("%d", time.Now().UnixNano()),
			Name:        name,
			Difficulty:  diff,
			Score:       serverScore, // server-computed
			TimeSeconds: timeSeconds,
			Mistakes:    mistakes,
			HintsUsed:   hintsUsed,
			Date:        time.Now().UTC().Format(time.RFC3339),
		}

		lbMutex.Lock()
		list := leaderboard[entry.Difficulty]
		list = append(list, entry)
		sort.Slice(list, func(i, j int) bool {
			return list[i].Score > list[j].Score
		})
		if len(list) > 10 {
			list = list[:10]
		}
		leaderboard[entry.Difficulty] = list
		lbMutex.Unlock()

		w.WriteHeader(http.StatusCreated)
		resp := map[string]any{
			"success": true,
			"source":  "local_server_mock",
			"entry":   entry,
		}
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
}

func main() {
	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	// Register .wasm MIME type explicitly
	_ = mime.AddExtensionType(".wasm", "application/wasm")
	_ = mime.AddExtensionType(".js", "application/javascript")
	_ = mime.AddExtensionType(".css", "text/css")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")

	webDir := filepath.Join(".", "web")
	fs := http.FileServer(http.Dir(webDir))

	// Leaderboard API endpoint
	http.HandleFunc("/api/leaderboard", handleLeaderboardAPI)

	// Static files & Wasm handler
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if filepath.Ext(r.URL.Path) == ".wasm" {
			w.Header().Set("Content-Type", "application/wasm")
		}
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")

		fs.ServeHTTP(w, r)
	})

	fmt.Println("==================================================")
	fmt.Printf("🚀 WebAssembly Sudoku Server berjalan di http://localhost:%s\n", port)
	fmt.Printf("🏆 Leaderboard API aktif di http://localhost:%s/api/leaderboard\n", port)
	fmt.Printf("📂 Menyajikan folder: %s\n", webDir)
	fmt.Println("==================================================")

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
