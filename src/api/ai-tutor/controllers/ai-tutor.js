// ─────────────────────────────────────────────────────────────────────────────
// src/api/ai-tutor/controllers/ai-tutor.js
// ─────────────────────────────────────────────────────────────────────────────
// No npm install needed — uses native fetch (Node 18+, which Strapi v4/v5 requires)
//
// Add to your .env:
//   CLOUDFLARE_ACCOUNT_ID=your_account_id
//   CLOUDFLARE_API_KEY=your_workers_ai_api_token
//
// Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
// Best quality/speed tradeoff on CF Workers AI for tutoring use cases.
// 70B Llama 3.3, fp8 quantized — strong instruction following + fast.

"use strict";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CF_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// OpenAI-compatible endpoint exposed by Workers AI
const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`;

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function callCloudflareAI({ messages, maxTokens = 1500, jsonMode = false }) {
  const body = {
    model: CF_MODEL,
    max_tokens: maxTokens,
    messages,
    ...(jsonMode && { response_format: { type: "json_object" } }),
  };

  const res = await fetch(CF_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CF_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── System prompts per mode ──────────────────────────────────────────────────

function buildSystemPrompt(mode, subject, level, topic) {
  const context = [
    `You are an expert IB tutor specialising in ${subject}${level && level !== "None" ? ` (${level})` : ""}.`,
    topic ? `The student is currently studying: ${topic}.` : "",
    `Always tailor your response to the IB curriculum and assessment style.`,
    `Be encouraging, clear, and appropriately challenging.`,
    `Use markdown for formatting — headings, bullet points, bold key terms.`,
    `Keep responses concise but complete. Avoid unnecessary filler.`,
  ]
    .filter(Boolean)
    .join("\n");

  const modeInstructions = {
    socratic: `
${context}

SOCRATIC MODE — Your goal is to guide, not give answers directly.
- NEVER give the final answer outright unless the student is stuck after 3+ exchanges.
- Start by asking what the student already knows about the topic.
- Use probing questions that progressively narrow in on the concept.
- When the student is on the right track, affirm and push them one step further.
- If they're wrong, ask "What makes you think that?" rather than correcting bluntly.
- End each response with exactly ONE question that moves them forward.
`.trim(),

    solver: `
${context}

SOLVER MODE — Provide clear, direct step-by-step solutions.
- Begin with a brief "What you need to know" summary (key formula/concept).
- Break the solution into numbered steps. Each step should be atomic.
- Show working explicitly — do not skip steps that an IB student might miss.
- After the solution, add a "Common mistakes" section with 1-2 bullet points.
- If the question involves a calculation, verify the answer at the end.
- For essay/long answer questions, provide a structured plan + sample paragraph.
`.trim(),

    analytical: `
${context}

ANALYTICAL MODE — Deep analysis of texts, sources, data, and stimuli.
- Identify the type of source (primary/secondary, text type, date, author stance).
- Structure your analysis: Context → Content → Language/Technique → Significance.
- For data/graphs: identify trends, anomalies, limitations of the data.
- For unseen texts: comment on tone, purpose, audience, literary devices if applicable.
- Always connect your analysis back to the IB assessment criteria.
- Suggest what a top-band response would include that a mid-band response misses.
`.trim(),
  };

  return modeInstructions[mode] || modeInstructions.solver;
}

// ─── Chat handler ─────────────────────────────────────────────────────────────

async function chat(ctx) {
  const { message, mode, subject, level, topic, history = [] } = ctx.request.body;

  if (!message) {
    return ctx.badRequest("message is required");
  }

  const validModes = ["socratic", "solver", "analytical"];
  const safeMode = validModes.includes(mode) ? mode : "solver";

  // Cap history at last 20 messages to stay well within context window
  const recentHistory = history.slice(-20);

  const messages = [
    { role: "system", content: buildSystemPrompt(safeMode, subject || "General", level, topic) },
    ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const reply = await callCloudflareAI({ messages, maxTokens: 1500 });
    ctx.body = { reply, mode: safeMode };
  } catch (err) {
    strapi.log.error("AI Tutor chat error:", err.message);
    ctx.internalServerError("AI service unavailable");
  }
}

// ─── Question generator handler ───────────────────────────────────────────────

async function generateQuestions(ctx) {
  const {
    subject,
    level,
    topic,
    paperType = "Paper 2",
    count = 5,
  } = ctx.request.body;

  if (!subject) {
    return ctx.badRequest("subject is required");
  }

  const safeCount = Math.min(Math.max(parseInt(count) || 5, 1), 15);

  const userPrompt = `Generate ${safeCount} IB-style ${paperType} exam questions for:
- Subject: ${subject}${level && level !== "None" ? ` (${level})` : ""}
${topic ? `- Topic: ${topic}` : ""}
- Paper: ${paperType}

Requirements:
- Each question must match real IB command term usage (analyse, evaluate, explain, etc.)
- Vary the marks (2, 4, 6, 8, 10 as appropriate for ${paperType})
- Include a mix of question types appropriate for this paper
- For each question include a short examiner hint (what a top-band answer must include)

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "Full question text here",
      "marks": 6,
      "questionType": "short_answer",
      "hint": "Top band answers should include X, Y, Z"
    }
  ]
}

questionType must be one of: mcq, short_answer, long_answer, data_interpretation`;

  const messages = [
    {
      role: "system",
      content:
        "You are an IB exam question writer. Always respond with valid JSON only. No explanation, no markdown fences, no extra text.",
    },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await callCloudflareAI({ messages, maxTokens: 2500, jsonMode: true });
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    ctx.body = { questions: parsed.questions || [] };
  } catch (err) {
    strapi.log.error("AI question generation error:", err.message);
    ctx.internalServerError("Question generation failed");
  }
}

module.exports = { chat, generateQuestions };