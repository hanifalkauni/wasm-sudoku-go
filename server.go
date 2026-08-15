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
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

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
		var entry LeaderboardEntry
		if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
			http.Error(w, `{"error": "Invalid JSON"}`, http.StatusBadRequest)
			return
		}

		if entry.Name == "" {
			entry.Name = "Pemain Sudoku"
		}
		if len(entry.Name) > 25 {
			entry.Name = entry.Name[:25]
		}
		entry.Difficulty = strings.ToLower(entry.Difficulty)
		if entry.Difficulty == "" {
			entry.Difficulty = "medium"
		}
		entry.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		entry.Date = time.Now().UTC().Format(time.RFC3339)

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
