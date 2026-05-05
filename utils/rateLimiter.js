// Lightweight in-memory per-key rate limiter. Resets on cold start (acceptable
// for a Vercel-hosted FYP — a real production system would use Redis).
const buckets = new Map();

// Removes timestamps older than the window
const trim = (arr, cutoff) => {
    while (arr.length && arr[0] < cutoff) arr.shift();
};

// Returns { allowed, retryAfterMs, remaining }
const checkRate = (key, { limit, windowMs }) => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const arr = buckets.get(key) || [];
    trim(arr, cutoff);
    if (arr.length >= limit) {
        const retryAfterMs = (arr[0] + windowMs) - now;
        return { allowed: false, retryAfterMs, remaining: 0 };
    }
    arr.push(now);
    buckets.set(key, arr);
    return { allowed: true, retryAfterMs: 0, remaining: limit - arr.length };
};

module.exports = { checkRate };
