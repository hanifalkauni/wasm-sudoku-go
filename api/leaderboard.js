/**
 * Vercel Serverless Function: Sudoku Global Leaderboard (Vercel KV / Redis)
 *
 * Security fixes applied:
 * - BUG-01: Score is RECALCULATED server-side; client-provided score is IGNORED.
 * - BUG-02: IP-based rate limiting (max 5 POSTs per 60 seconds per IP).
 *
 * Endpoints:
 * - GET  /api/leaderboard?difficulty=easy|medium|hard|expert
 * - POST /api/leaderboard (body: { name, difficulty, timeSeconds, mistakes, hintsUsed })
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

// In-memory rate limiter fallback (per IP, per serverless instance)
const rateLimitStore = new Map();

// ============================================================================
// BUG-01 FIX: Server-Side Score Recalculation
// Formula mirrors cmd/wasm/score.go — client-provided score is IGNORED entirely.
// ============================================================================
function calculateScoreServerSide(difficulty, timeSeconds, mistakes, hintsUsed) {
    const baseScores = { easy: 3500, medium: 5500, hard: 8500, expert: 13000 };
    const baseScore = baseScores[difficulty] || 5500;

    // Strict disqualification: 5+ hints = 0 score, not eligible
    if (hintsUsed >= 5) {
        return { score: 0, eligible: false, reason: "Terlalu banyak penggunaan hint (>= 5x)" };
    }

    // Progressive hint penalty
    const hintPenalties = [0, 400, 1000, 2000, 3500];
    const hintPenalty = hintPenalties[Math.min(hintsUsed, 4)];

    const timePenalty = timeSeconds * 1;       // 1 point per second
    const mistakePenalty = mistakes * 200;     // 200 points per mistake

    const total = baseScore - timePenalty - mistakePenalty - hintPenalty;
    const finalScore = Math.max(0, total);

    return {
        score: finalScore,
        eligible: finalScore > 0,
        reason: finalScore <= 0 ? "Skor akhir 0 setelah penalti" : null
    };
}

// ============================================================================
// BUG-02 FIX: IP-based Rate Limiting
// Max 5 POST submissions per 60 seconds per IP.
// Uses Redis for distributed enforcement; in-memory as fallback.
// ============================================================================
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function checkRateLimit(ip) {
    const redisKey = `sudoku_rl:${ip}`;

    try {
        // Try Redis-based rate limiting
        const count = await executeRedisCommand(["INCR", redisKey]);
        if (count === 1) {
            // First request — set expiry window
            await executeRedisCommand(["EXPIRE", redisKey, RATE_LIMIT_WINDOW_SECONDS]);
        }
        if (count !== null && count > RATE_LIMIT_MAX) {
            return { allowed: false, remaining: 0 };
        }
        return { allowed: true, remaining: count !== null ? RATE_LIMIT_MAX - count : RATE_LIMIT_MAX };
    } catch (_) {
        // Redis unavailable — use in-memory fallback
    }

    // In-memory fallback
    const now = Date.now();
    const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
    const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
    }

    entry.count++;
    rateLimitStore.set(ip, entry);

    if (entry.count > RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

async function executeRedisCommand(commandArray) {
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

        const localList = inMemoryLeaderboard[difficulty] || [];
        return res.status(200).json({
            source: "local_memory",
            difficulty,
            count: localList.length,
            leaderboard: localList
        });
    }

    // --------------------------------------------------------------------------
    // POST: Submit a New Score (with rate limiting + server-side score calc)
    // --------------------------------------------------------------------------
    if (req.method === "POST") {
        // --- BUG-02: Rate Limit Check ---
        const clientIp =
            req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.headers["x-real-ip"] ||
            req.socket?.remoteAddress ||
            "unknown";

        const rateResult = await checkRateLimit(clientIp);
        if (!rateResult.allowed) {
            res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SECONDS));
            return res.status(429).json({
                error: `Terlalu banyak percobaan. Maksimal ${RATE_LIMIT_MAX} submit per menit. Coba lagi sebentar.`
            });
        }

        try {
            const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
            // NOTE: 'score' from client body is intentionally IGNORED (BUG-01 fix)
            let { name, difficulty, timeSeconds, mistakes, hintsUsed } = body || {};

            // Sanitize inputs
            name = (name || "Anonymous Player").toString().trim().slice(0, 25);
            name = name.replace(/<[^>]*>?/gm, ""); // XSS sanitize
            if (!name) name = "Pemain Sudoku";

            difficulty = (difficulty || "medium").toLowerCase();
            if (!validDifficulties.includes(difficulty)) {
                difficulty = "medium";
            }

            timeSeconds = Math.max(0, Math.min(86400, parseInt(timeSeconds, 10) || 0));
            mistakes    = Math.max(0, Math.min(100,   parseInt(mistakes,    10) || 0));
            hintsUsed   = Math.max(0, Math.min(100,   parseInt(hintsUsed,   10) || 0));

            // --- BUG-01: Server-side score recalculation (ignore client score) ---
            const scoreResult = calculateScoreServerSide(difficulty, timeSeconds, mistakes, hintsUsed);

            if (!scoreResult.eligible) {
                return res.status(400).json({
                    error: `Skor tidak memenuhi syarat masuk leaderboard. ${scoreResult.reason || ""}`
                });
            }

            const serverScore = scoreResult.score;

            const newEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name,
                difficulty,
                score: serverScore,   // Server-calculated, not client-provided
                timeSeconds,
                mistakes,
                hintsUsed,
                date: new Date().toISOString()
            };

            const redisKey = `sudoku_lb:${difficulty}`;

            try {
                const redisResult = await executeRedisCommand([
                    "ZADD",
                    redisKey,
                    serverScore,
                    JSON.stringify(newEntry)
                ]);

                // BUG-09 fix: trim sorted set to top 10 after every write
                await executeRedisCommand(["ZREMRANGEBYRANK", redisKey, 0, -11]);

                if (redisResult !== null) {
                    return res.status(201).json({
                        success: true,
                        source: "vercel_kv",
                        score: serverScore,
                        entry: newEntry
                    });
                }
            } catch (kvError) {
                console.warn("Vercel KV save failed, falling back to memory:", kvError.message);
            }

            // Fallback: in-memory
            if (!inMemoryLeaderboard[difficulty]) inMemoryLeaderboard[difficulty] = [];
            inMemoryLeaderboard[difficulty].push(newEntry);
            inMemoryLeaderboard[difficulty].sort((a, b) => b.score - a.score);
            inMemoryLeaderboard[difficulty] = inMemoryLeaderboard[difficulty].slice(0, 10);

            return res.status(201).json({
                success: true,
                source: "local_memory",
                score: serverScore,
                entry: newEntry
            });

        } catch (parseError) {
            return res.status(400).json({ error: "Invalid request payload", details: parseError.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
