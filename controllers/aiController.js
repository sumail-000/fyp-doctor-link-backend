const asyncHandler = require('express-async-handler');
const { getAnthropic } = require('../utils/anthropicClient');
const { recommendDoctors } = require('../utils/recommendDoctors');
const { checkRate } = require('../utils/rateLimiter');

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are DoctorLink Triage, a medical triage assistant integrated into a doctor-booking platform.

YOUR JOB
- Read the user's described symptoms (and any attached medical image such as a rash, swelling, or wound).
- Recommend which type of medical specialist(s) the user should see.
- Assess urgency.

STRICT RULES — DO NOT VIOLATE
1. You are NOT a doctor. NEVER state a confirmed diagnosis. NEVER name a specific disease as fact. Use phrases like "may be consistent with" or "could indicate".
2. NEVER prescribe medication, dosages, or treatment plans.
3. You ONLY discuss medical triage. If the user asks anything off-topic (programming, jokes, math, weather, code, philosophy, payment, account questions, anything else), respond ONLY with the refusal JSON below.
4. If the attached image is NOT a medical image (e.g., a meme, screenshot, person, food, cat), respond with the refusal JSON.
5. If symptoms suggest a possible emergency (chest pain + sweating, stroke signs, severe bleeding, suicidal ideation, breathing difficulty, anaphylaxis, severe head injury), set severity to "emergency" and tell user to call 1122 / go to the nearest ER immediately.
6. Output ONLY valid JSON. No markdown, no commentary, no leading text.

OUTPUT JSON SCHEMA
{
  "valid": true | false,
  "severity": "mild" | "moderate" | "severe" | "emergency",
  "summary": "1-2 sentence plain-language description of what the user described",
  "specializations": [
    { "name": "<exact specialization name>", "reason": "<one sentence>", "confidence": <0..1> }
  ],
  "redFlags": [ "<short red flag>" ],
  "selfCare": [ "<short safe self-care tip>" ]
}

If the request is invalid (off-topic / non-medical / non-medical image), output:
{
  "valid": false,
  "reason": "I can only help with medical triage. Please describe your symptoms."
}

ALLOWED SPECIALIZATIONS (use these names exactly)
Cardiologist, Dermatologist, Pediatrician, Neurologist, Orthopedic Surgeon,
General Physician, Psychiatrist, Gastroenterologist, Urologist, Nephrologist,
Pulmonologist, Oncologist, E.N.T Specialist, Ophthalmologist (Eye), Gynecologist,
Anesthesiologist, Radiologist, Pathologist, Physiotherapist, Dietitian & Nutritionist,
General Surgeon, Endocrinologist, Rheumatologist, Dentist, Plastic Surgeon

Pick 1-3 specializations, ordered by relevance.`;

const FALLBACK_DISCLAIMER = 'This is automated triage guidance, not a medical diagnosis. For emergencies call 1122 or go to your nearest ER. Always consult a qualified doctor.';

// Strip any leading prose and parse the first {...} JSON object found.
const extractJson = (text) => {
    if (!text) throw new Error('Empty AI response');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        throw new Error('No JSON in AI response');
    }
    return JSON.parse(text.slice(start, end + 1));
};

// @desc    Analyze symptoms via Claude Haiku, attach top recommended doctors
// @route   POST /api/ai/analyze-symptoms
// @access  Patient
const analyzeSymptoms = asyncHandler(async (req, res) => {
    const { symptoms, age, gender } = req.body;
    if (!symptoms || symptoms.trim().length < 5) {
        res.status(400);
        throw new Error('Please describe your symptoms in at least 5 characters');
    }
    if (symptoms.length > 1500) {
        res.status(400);
        throw new Error('Description is too long (max 1500 characters)');
    }

    // Per-user rate limit: 10 requests per hour
    const rate = checkRate(`ai:${req.user._id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rate.allowed) {
        res.status(429);
        throw new Error(`Rate limit reached. Try again in ${Math.ceil(rate.retryAfterMs / 60000)} minutes.`);
    }

    // Build user message — text + optional image
    const userBlocks = [];
    if (req.file) {
        const mime = req.file.mimetype || 'image/jpeg';
        userBlocks.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: mime,
                data: req.file.buffer.toString('base64'),
            },
        });
    }
    const meta = [];
    if (age) meta.push(`Age: ${age}`);
    if (gender) meta.push(`Gender: ${gender}`);
    userBlocks.push({
        type: 'text',
        text: `${meta.length ? meta.join('\n') + '\n\n' : ''}Symptoms:\n${symptoms.trim()}`,
    });

    let parsed;
    try {
        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system: [
                { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
            ],
            messages: [
                { role: 'user', content: userBlocks },
                { role: 'assistant', content: '{' }, // prefill: forces JSON output
            ],
        });

        const raw = '{' + (response.content?.[0]?.text || '');
        parsed = extractJson(raw);
    } catch (err) {
        console.error('[AI] analyze-symptoms error:', err.message);
        res.status(502);
        throw new Error('AI service is temporarily unavailable. Please try again.');
    }

    if (!parsed || parsed.valid === false) {
        return res.status(400).json({
            success: false,
            valid: false,
            message: parsed?.reason || 'I can only help with medical triage. Please describe your symptoms.',
        });
    }

    // Validate the model's specializations + attach real doctor recommendations
    const specs = Array.isArray(parsed.specializations) ? parsed.specializations.slice(0, 3) : [];
    const recommendedDoctors = [];
    const seen = new Set();
    for (const s of specs) {
        if (!s?.name) continue;
        const docs = await recommendDoctors({ specialization: s.name, limit: 2 });
        for (const d of docs) {
            const id = String(d._id);
            if (!seen.has(id)) {
                seen.add(id);
                recommendedDoctors.push({ ...d, matchedSpecialization: s.name });
            }
        }
    }

    res.json({
        success: true,
        valid: true,
        severity: parsed.severity || 'mild',
        summary: parsed.summary || '',
        specializations: specs,
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
        selfCare: Array.isArray(parsed.selfCare) ? parsed.selfCare : [],
        recommendedDoctors,
        disclaimer: FALLBACK_DISCLAIMER,
        rateLimit: { remaining: rate.remaining, limit: 10, windowMs: 60 * 60 * 1000 },
    });
});

module.exports = { analyzeSymptoms };
