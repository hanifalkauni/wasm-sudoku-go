/**
 * Vercel Serverless Function: Sudoku Global Leaderboard (Vercel KV / Redis)
 * 
 * Endpoints:
 * - GET  /api/leaderboard?difficulty=easy|medium|hard|expert
 * - POST /api/leaderboard (body: { name, difficulty, timeSeconds, mistakes, hintsUsed, score })
 */

// In-memory fallback if Vercel KV environment variables are not yet configured
let inMemoryLeaderboard = {
    easy: [
        { name: "Budi Wasm", score: 2820, timeSeconds: 65, mistakes: 0, hintsUsed: 0, date: "2026-08-15T12:00:00.000Z" },
        { name: "Siti Logic", score: 2650, timeSeconds: 110, mistakes: 1, hintsUsed: 0, date: "2026-08-15T12:15:00.000Z" }
    ],
    medium: [
        { name: "Arya Sudoku", score: 4620, timeSeconds: 140, mistakes: 0, hintsUsed: 1, date: "2026-08-15T12:30:00.000Z" },
        { name: "Dewi Master", score: 4300, timeSeconds: 200, mistakes: 2, hintsUsed: 0, date: "2026-08-15T12:45:00.000Z" }
    ],
    hard: [
        { name: "Rian Grandmaster", score: 7200, timeSeconds: 250, mistakes: 1, hintsUsed: 1, date: "2026-08-15T13:00:00.000Z" }
    ],
    expert: [
        { name: "Eko Bytecode", score: 10500, timeSeconds: 420, mistakes: 2, hintsUsed: 1, date: "2026-08-15T13:30:00.000Z" }
    ]
};

async function executeRedisCommand(commandArray) {
    // Otomatis deteksi berbagai prefix env Vercel: KV_REST_API_URL, STORAGE_REST_API_URL, dll.
    const kvUrl = 
        process.env.KV_REST_API_URL || 
        process.env.STORAGE_REST_API_URL || 
        process.env.STORAGE_URL || 
        process.env.REDIS_REST_API_URL ||
        process.env.UPSTASH_REDIS_REST_URL;

    const kvToken = 
        process.env.KV_REST_API_TOKEN || 
        process.env.STORAGE_REST_API_TOKEN || 
        process.env.STORAGE_TOKEN ||
        process.env.REDIS_REST_API_TOKEN ||
        process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!kvUrl || !kvToken) {
        return null; // Signals fallback to in-memory
    }

    const response = await fetch(kvUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${kvToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(commandArray)
    });

    if (!response.ok) {
        throw new Error(`Redis HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const validDifficulties = ["easy", "medium", "hard", "expert"];

    // --------------------------------------------------------------------------
    // GET: Retrieve Top 10 High Scores
    // --------------------------------------------------------------------------
    if (req.method === "GET") {
        const difficulty = (req.query.difficulty || "medium").toLowerCase();
        if (!validDifficulties.includes(difficulty)) {
            return res.status(400).json({ error: "Invalid difficulty parameter" });
        }

        const redisKey = `sudoku_lb:${difficulty}`;

        try {
            // Try fetching from Vercel KV Redis Sorted Set
            // ZREVRANGEBYSCORE or ZREVRANGE: get top 10 highest scores
            const rawResults = await executeRedisCommand(["ZREVRANGE", redisKey, 0, 9]);

            if (rawResults !== null) {
                const leaderboard = rawResults.map(item => {
                    try {
                        return typeof item === "string" ? JSON.parse(item) : item;
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);

                return res.status(200).json({
                    source: "vercel_kv",
                    difficulty,
                    count: leaderboard.length,
                    leaderboard
                });
            }
        } catch (kvError) {
            console.warn("Vercel KV fetch failed, falling back to memory:", kvError.message);
        }

        // Fallback response if KV is not connected yet
        const localList = inMemoryLeaderboard[difficulty] || [];
        return res.status(200).json({
            source: "local_memory",
            difficulty,
            count: localList.length,
            leaderboard: localList
        });
    }

    // --------------------------------------------------------------------------
    // POST: Submit a New Score
    // --------------------------------------------------------------------------
    if (req.method === "POST") {
        try {
            const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
            let { name, difficulty, timeSeconds, mistakes, hintsUsed, score } = body || {};

            // Sanitize and validate
            name = (name || "Anonymous Player").toString().trim().slice(0, 25);
            name = name.replace(/<[^>]*>?/gm, ""); // Basic XSS sanitization
            if (!name) name = "Pemain Sudoku";

            difficulty = (difficulty || "medium").toLowerCase();
            if (!validDifficulties.includes(difficulty)) {
                difficulty = "medium";
            }

            timeSeconds = Math.max(0, parseInt(timeSeconds, 10) || 0);
            mistakes = Math.max(0, parseInt(mistakes, 10) || 0);
            hintsUsed = Math.max(0, parseInt(hintsUsed, 10) || 0);
            score = Math.max(0, parseInt(score, 10) || 0);

            // Anti-Spam / Anti-Cheat: Disqualify submissions with 5+ hints or 0 score
            if (hintsUsed >= 5 || score <= 0) {
                return res.status(400).json({
                    error: "Skor tidak memenuhi syarat masuk leaderboard (terlalu banyak hint / skor 0)."
                });
            }

            const newEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name,
                difficulty,
                score,
                timeSeconds,
                mistakes,
                hintsUsed,
                date: new Date().toISOString()
            };

            const redisKey = `sudoku_lb:${difficulty}`;

            try {
                // Add to Redis Sorted Set with score as score
                const redisResult = await executeRedisCommand([
                    "ZADD",
                    redisKey,
                    score,
                    JSON.stringify(newEntry)
                ]);

                if (redisResult !== null) {
                    return res.status(201).json({
                        success: true,
                        source: "vercel_kv",
                        entry: newEntry
                    });
                }
            } catch (kvError) {
                console.warn("Vercel KV save failed, falling back to memory:", kvError.message);
            }

            // Fallback save to in-memory
            if (!inMemoryLeaderboard[difficulty]) inMemoryLeaderboard[difficulty] = [];
            inMemoryLeaderboard[difficulty].push(newEntry);
            inMemoryLeaderboard[difficulty].sort((a, b) => b.score - a.score);
            inMemoryLeaderboard[difficulty] = inMemoryLeaderboard[difficulty].slice(0, 10);

            return res.status(201).json({
                success: true,
                source: "local_memory",
                entry: newEntry
            });
        } catch (parseError) {
            return res.status(400).json({ error: "Invalid request payload", details: parseError.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
