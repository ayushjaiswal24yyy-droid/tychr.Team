// ─────────────────────────────────────────────────────────────────────────────
// src/api/ai-tutor/controllers/ai-tutor.js
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CF_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
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

// ─── GDC subject detection ────────────────────────────────────────────────────
// Subjects where GDC tips are relevant (Paper 2 calculator papers)

const GDC_SUBJECTS = [
  "math", "mathematics", "math aa", "math ai",
  "mathematics: analysis and approaches",
  "mathematics: applications and interpretation",
  "physics", "chemistry", "biology",
];

function isGDCSubject(subject = "") {
  return GDC_SUBJECTS.some((s) => subject.toLowerCase().includes(s));
}

// ─── System prompts ───────────────────────────────────────────────────────────

function buildSystemPrompt(mode, subject, level, topic) {
  const isMathSci = isGDCSubject(subject);

  const context = [
    `You are an expert IB tutor specialising in ${subject}${level && level !== "None" ? ` (${level})` : ""}.`,
    topic ? `The student is currently studying: ${topic}.` : "",
    `Always tailor your response to the IB curriculum and assessment style.`,
    `Be encouraging, clear, and appropriately challenging.`,
    `Use markdown for formatting — headings, bullet points, bold key terms.`,
    `Keep responses concise but complete. Avoid unnecessary filler.`,
    // Inject GDC awareness for math/science subjects regardless of mode
    isMathSci
      ? `GDC AWARENESS: This subject has calculator-allowed papers (Paper 2/3). Whenever a step can be done faster on a GDC, note it inline with a 🔢 prefix — e.g. "🔢 GDC: Use the equation solver here instead of solving manually." Do this even in non-Methods mode.`
      : "",
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

    methods: `
${context}

METHODS MODE — Show multiple solution approaches and GDC strategies.

Structure every response like this:

## Method 1: [Name] (e.g. Algebraic / By-hand)
Walk through the full solution step by step.
${isMathSci ? "Note any step where a GDC would save time with 🔢." : ""}

## Method 2: [Name] (e.g. Graphical / Using technology)
Walk through an alternative approach.
${
  isMathSci
    ? `## 🔢 GDC Strategy
- State which calculator function to use (e.g. Solver, Graphing + Intersection, Numerical Derivative, Table of Values, Matrix operations).
- Give the exact keystrokes or menu path if relevant (TI-84 or Casio fx-CG50 style).
- State what the GDC output looks like and how to read the answer.
- Flag whether this approach is acceptable on IB Paper 2/3 or if working must be shown.`
    : ""
}

## Which method to use?
Give a 1-2 sentence recommendation based on exam context (time pressure, paper type, marks available).

Rules:
- Always show at least 2 methods. For rich problems, show 3.
- Never skip the "Which method to use?" summary.
- If the question is purely conceptual (no calculation), show different analytical frameworks instead of calculation methods.
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

  const validModes = ["socratic", "solver", "analytical", "methods"];
  const safeMode = validModes.includes(mode) ? mode : "solver";

  const recentHistory = history.slice(-20);

  const messages = [
    { role: "system", content: buildSystemPrompt(safeMode, subject || "General", level, topic) },
    ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const reply = await callCloudflareAI({ messages, maxTokens: 1800 });
    ctx.body = { reply, mode: safeMode };
  } catch (err) {
    strapi.log.error("AI Tutor chat error:", err.message);
    ctx.internalServerError("AI service unavailable");
  }
}

// ─── Question generator ───────────────────────────────────────────────────────

async function generateQuestions(ctx) {
  const { subject, level, topic, paperType = "Paper 2", count = 5 } = ctx.request.body;

  if (!subject) return ctx.badRequest("subject is required");

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

Return a JSON object:
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
      content: "You are an IB exam question writer. Always respond with valid JSON only. No explanation, no markdown fences.",
    },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await callCloudflareAI({ messages, maxTokens: 2500, jsonMode: true });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    ctx.body = { questions: parsed.questions || [] };
  } catch (err) {
    strapi.log.error("AI question generation error:", err.message);
    ctx.internalServerError("Question generation failed");
  }
}


// ─── Paper question generator ─────────────────────────────────────────────────
// Generates questions in the exact Strapi question-bank parts format.
// Accepts a sections array so teacher can mix types in one generation:
//   sections: [
//     { questionType: "mcq", count: 3, marks: 2 },
//     { questionType: "short_answer", count: 2, marks: 4 },
//     { questionType: "long_answer", count: 1, marks: 8, parts: 3 },
//   ]

async function generatePaperQuestions(ctx) {
  const { subject, level, topic, sections = [] } = ctx.request.body;

  if (!subject) return ctx.badRequest("subject is required");
  if (!sections.length) return ctx.badRequest("sections is required");

  const safeSections = sections.map((s) => ({
    questionType: ["mcq", "mcq_multiple", "short_answer", "long_answer", "fill_in_the_blanks", "match_columns"].includes(s.questionType)
      ? s.questionType : "short_answer",
    count: Math.min(Math.max(parseInt(s.count) || 1, 1), 10),
    marks: Math.min(Math.max(parseInt(s.marks) || 2, 1), 20),
    parts: Math.min(Math.max(parseInt(s.parts) || 1, 1), 6),
  }));

  const totalQuestions = safeSections.reduce((sum, s) => sum + s.count, 0);
  if (totalQuestions > 30) return ctx.badRequest("Maximum 30 questions per generation");

  const sectionDescriptions = safeSections.map((s, i) => {
    if (s.questionType === "mcq" || s.questionType === "mcq_multiple") {
      return `Section ${i + 1}: ${s.count} x MCQ (${s.marks} marks each). Each must have exactly 4 options (A, B, C, D) and one correct answer.`;
    }
    if (s.questionType === "short_answer") {
      return `Section ${i + 1}: ${s.count} x Short Answer (${s.marks} marks each). Single-part, 2-4 sentence answer. Include a model answer.`;
    }
    if (s.questionType === "long_answer") {
      return `Section ${i + 1}: ${s.count} x Long Answer (${s.marks} marks total, split across ${s.parts} parts a, b, c...). Include model answer per part.`;
    }
    if (s.questionType === "fill_in_the_blanks") {
      return `Section ${i + 1}: ${s.count} x Fill in the Blanks (${s.marks} marks each). Each sentence has 1-3 blanks marked as ___. Include correct words.`;
    }
    if (s.questionType === "match_columns") {
      return `Section ${i + 1}: ${s.count} x Match the Column (${s.marks} marks each). 4 items in column A matched to 4 in column B. Include correct pairs.`;
    }
    return "";
  }).join("\n");

  const userPrompt = `You are an IB exam question writer. Generate exam questions for:
Subject: ${subject}${level && level !== "None" ? ` (${level})` : ""}
${topic ? `Topic: ${topic}` : ""}

Generate the following:
${sectionDescriptions}

Return ONLY a JSON object with a single "questions" array. Combine all sections into one array.
Total questions expected: ${totalQuestions}

Use these exact shapes per question type:

MCQ: { "questionType": "mcq", "marks": 2, "question": "...", "options": ["Independence", "Interconnectedness", "Linearity", "Randomness"], "correctAnswer": "Interconnectedness" }

CRITICAL for MCQ: options must contain ONLY the answer text. Do NOT include "A)", "B)", "A.", "B.", or any letter prefix. The frontend adds option labels automatically. correctAnswer must exactly match one of the options strings (no label prefix).

Short Answer: { "questionType": "short_answer", "marks": 4, "question": "...", "modelAnswer": "..." }

Long Answer: { "questionType": "long_answer", "marks": 8, "question": "Parent stem here (shared context for all parts)", "parts": [ { "questionText": "Define globalization and its key characteristics.", "marks": 3, "modelAnswer": "..." } ] }

CRITICAL for Long Answer parts: questionText must contain ONLY the raw question. Do NOT include any part label prefix — no "Part (a)", no "(a)", no "a)", no "Part a". The frontend labels parts automatically. Write the question text only.

Fill in the Blanks: { "questionType": "fill_in_the_blanks", "marks": 2, "question": "The ___ is responsible for ___.", "blanks": { "1": "answer1", "2": "answer2" } }

Match the Column: { "questionType": "match_columns", "marks": 4, "question": "Match the following.", "leftColumn": ["Term1","Term2","Term3","Term4"], "rightColumn": ["Def1","Def2","Def3","Def4"], "correctPairs": { "1": "3", "2": "1", "3": "4", "4": "2" } }`;

  try {
    const raw = await callCloudflareAI({ messages: [
      { role: "system", content: "You are an IB exam question writer. Always respond with valid JSON only. No markdown fences, no extra text." },
      { role: "user", content: userPrompt },
    ], maxTokens: 4000, jsonMode: true });

    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const rawQuestions = parsed.questions || [];

    // Transform AI output into Strapi question-bank parts format
    const strapiQuestions = rawQuestions.map((q) => {
      const base = { question: q.question, question_type: q.questionType, marks: q.marks, content_format: "richtext" };

      if (q.questionType === "mcq" || q.questionType === "mcq_multiple") {
        // Strip any accidental letter prefixes the model adds (e.g. "A) ", "A. ", "A - ")
        const stripOptionLabel = (text = "") => text.replace(/^[A-Da-d][).\-]\s*/,'').trim();
        const cleanOptions = (q.options || []).map(stripOptionLabel);
        const cleanCorrect = stripOptionLabel(q.correctAnswer || "");
        return { ...base, parts: [{ answer_type: "Single Correct", marks: q.marks, options: cleanOptions.join("\n---OPTION---\n"), options_format: "richtext", correct_answer: cleanCorrect, correct_answer_format: "richtext", content_format: "richtext" }] };
      }
      if (q.questionType === "short_answer") {
        return { ...base, parts: [{ answer_type: "Short Text", marks: q.marks, question_text: q.question, question_text_format: "richtext", correct_answer: q.modelAnswer || "", correct_answer_format: "richtext", content_format: "richtext" }] };
      }
      if (q.questionType === "long_answer") {
        // Strip any accidental part label prefixes the model might add (e.g. "Part (a) ", "(a) ", "a) ")
        const stripPartLabel = (text = "") => text.replace(/^(part\s*)?\(?[a-z]\)?[.)\s]+/i, "").trim();
        return { ...base, parts: (q.parts || []).map((p) => ({ answer_type: "Long Text", marks: p.marks, question_text: stripPartLabel(p.questionText), question_text_format: "richtext", correct_answer: p.modelAnswer || "", correct_answer_format: "richtext", content_format: "richtext" })) };
      }
      if (q.questionType === "fill_in_the_blanks") {
        const questionWithBlanks = q.question.replace(/___/g, "{ }");
        return { ...base, question: questionWithBlanks, parts: [{ answer_type: "Fill In The Blanks", marks: q.marks, options: JSON.stringify({ format: "richtext", content: questionWithBlanks, _v: "1.0", blanks: {} }), correct_answer: JSON.stringify(q.blanks || {}), correct_answer_format: "json", content_format: "richtext" }] };
      }
      if (q.questionType === "match_columns") {
        const leftContent = (q.leftColumn || []).map((item, i) => `[${i + 1}] ${item}`).join("\n---OPTION---\n");
        const rightContent = (q.rightColumn || []).map((item, i) => `[${i + 1}] ${item}`).join("\n---OPTION---\n");
        return { ...base, parts: [{ answer_type: "Match Columns", marks: q.marks, options: JSON.stringify({ left: { format: "richtext", content: leftContent, _v: "1.0" }, right: { format: "richtext", content: rightContent, _v: "1.0" } }), correct_answer: JSON.stringify(q.correctPairs || {}), correct_answer_format: "json", content_format: "richtext" }] };
      }
      return { ...base, parts: [{ answer_type: "Short Text", marks: q.marks, question_text: q.question, correct_answer: "", content_format: "richtext" }] };
    });

    ctx.body = { questions: strapiQuestions, raw: rawQuestions };
  } catch (err) {
    strapi.log.error("Paper question generation error:", err.message);
    ctx.internalServerError("Paper question generation failed");
  }
}

module.exports = { chat, generateQuestions, generatePaperQuestions };