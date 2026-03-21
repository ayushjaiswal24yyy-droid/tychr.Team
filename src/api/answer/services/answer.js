"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

// ─── IB essay subjects and their specific criteria ────────────────────────────
// Used to route long_answer questions to the essay-aware prompt

const IB_ESSAY_CRITERIA = {
  history: {
    criteria: ["A: Knowledge and Understanding", "B: Application and Analysis", "C: Synthesis and Evaluation", "D: Use and Application of Historical Skills"],
    maxPerCriterion: 5,
  },
  economics: {
    criteria: ["A: Diagrams", "B: Terminology", "C: Application", "D: Analysis and Evaluation"],
    maxPerCriterion: 4,
  },
  english: {
    criteria: ["A: Content", "B: Organisation", "C: Language", "D: Register, Style and Terminology"],
    maxPerCriterion: 5,
  },
  biology: null, // Uses standard mark scheme, not criterion-based
  chemistry: null,
  physics: null,
  default: null,
};

function getEssayCriteria(subjectName = "") {
  const lower = subjectName.toLowerCase();
  for (const [key, val] of Object.entries(IB_ESSAY_CRITERIA)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ─── Cloudflare AI helper ─────────────────────────────────────────────────────

const CF_URL = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`;

async function callCF({ messages, maxTokens = 400 }) {
  const res = await fetch(CF_URL(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";

  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${raw}`);
  }
}

// ─── Confidence threshold for escalation ─────────────────────────────────────
// Below this value → evaluation_status becomes 'needs_review' instead of 'in_progress'

const CONFIDENCE_ESCALATION_THRESHOLD = 0.6;

module.exports = createCoreService("api::answer.answer", () => ({

  async processBulkEvaluation(answerIds) {
    let evaluatedCount = 0;
    const evaluationResults = [];

    for (const answerId of answerIds) {
      // 1. Fetch submission with test_series and nested question components
      const submission = await strapi.entityService.findOne("api::answer.answer", answerId, {
        populate: {
          test_series: {
            populate: ["grade_subject", "grade_subject.subject"],
          },
          question_n_answer: {
            populate: {
              question: { populate: ["parts"] },
              part_evaluations: true,
            },
          },
        },
      });

      // 2. Guardrails
      if (!submission || submission.evaluation_status === "evaluated") continue;

      if (
        submission.test_series?.test_mode === "offline" ||
        submission.submission_type === "offline"
      ) {
        strapi.log.info(`Skipping submission ${answerId}: offline.`);
        continue;
      }

      if (submission.test_series?.ai_evaluation_enabled === false) {
        strapi.log.info(`Skipping submission ${answerId}: AI evaluation disabled for this test series.`);
        await strapi.entityService.update("api::answer.answer", answerId, {
          data: {
            evaluation_status: "pending",
            tutor_feedback: "This paper requires manual evaluation by a teacher.",
          },
        });
        continue;
      }

      // Resolve subject name for essay criteria routing
      const subjectName =
        submission.test_series?.grade_subject?.subject?.name ||
        submission.test_series?.grade_subject?.name ||
        "";

      let totalSubmissionMarks = 0;
      let isFullyEvaluated = true;
      let hasAIEvaluation = false;
      let lowestConfidence = 1; // Track lowest confidence across all AI evaluations
      const updatedQuestionNAnswers = [];

      // 3. Iterate through Q&A blocks
      for (const qna of submission.question_n_answer || []) {
        const questionData = qna.question;
        const studentAnswerJson = qna.answer;

        if (!questionData || !studentAnswerJson) {
          updatedQuestionNAnswers.push({
            id: qna.id,
            question: qna.question ? qna.question.id : null,
            answer: qna.answer,
            question_n_answer: qna.question_n_answer,
          });
          continue;
        }

        let qnaTotalMarks = 0;
   const qnaAnnotationsByPart = [];
const qnaImprovedAnswersByPart = [];
        const qnaFeedbackArray = [];
        const updatedPartEvaluations = [];
        const parts = questionData.parts || [];

        // 4. Multi-part loop
        for (let i = 0; i < parts.length; i++) {
          const partDef = parts[i];
          const studentPartResponse = studentAnswerJson[`part_${i}`];
          const existingEval = qna.part_evaluations?.[i];

          let partAwardedMarks = 0;
          let partFeedback = "";

          const isSubjective = ["short_answer", "long_answer"].includes(
            questionData.question_type
          );
          const isEssay = questionData.question_type === "long_answer";

          // Unpack correct answer
          let extractedCorrectAnswer = "";
          let hasValidObjectRubric = false;

          if (partDef.correct_answer) {
            let rawCorrect = partDef.correct_answer.replace(/<[^>]*>?/gm, "").trim();
            try {
              const parsed = JSON.parse(rawCorrect);
              if (parsed && typeof parsed === "object") {
                if (parsed.content !== undefined) {
                  extractedCorrectAnswer = parsed.content.replace(/<[^>]*>?/gm, "").trim();
                } else {
                  hasValidObjectRubric = Object.keys(parsed).length > 0;
                  extractedCorrectAnswer = rawCorrect;
                }
              }
            } catch (e) {
              extractedCorrectAnswer = rawCorrect;
            }
          }

          let canEvaluate = false;
          if (typeof studentPartResponse === "object" && !isSubjective) {
            canEvaluate = hasValidObjectRubric || !!partDef.correctMatchingPairs;
          } else {
            canEvaluate = isSubjective
              ? !!(studentPartResponse?.trim?.())  // essays can be graded even without ideal answer
              : extractedCorrectAnswer !== "";
          }

          if (!canEvaluate) {
            isFullyEvaluated = false;
            partAwardedMarks = existingEval ? existingEval.marks : 0;
            partFeedback = "Pending manual evaluation: No rubric or correct answer provided.";
          } else if (isSubjective) {
            hasAIEvaluation = true;
            try {
              const cleanResponse =
                typeof studentPartResponse === "string"
                  ? studentPartResponse.replace(/<[^>]*>?/gm, "").trim()
                  : JSON.stringify(studentPartResponse);

              let aiResult;

              if (isEssay) {
                // Route long_answer to essay-aware evaluator
                aiResult = await this.evaluateEssayWithAI(
                  partDef.question_text || questionData.question,
                  cleanResponse,
                  partDef.marks,
                  extractedCorrectAnswer,
                  subjectName
                );
              } else {
                // Short answer — standard evaluator
                aiResult = await this.evaluateWithAI(
                  partDef.question_text || questionData.question,
                  cleanResponse,
                  partDef.marks,
                  extractedCorrectAnswer
                );
              }

              partAwardedMarks = aiResult.awardedMarks;
              partFeedback = aiResult.feedback;
           qnaAnnotationsByPart.push({
  part: i,
  annotations: aiResult.annotations ?? [],
});
qnaImprovedAnswersByPart.push({
  part: i,
  improvedAnswer: aiResult.improvedAnswer ?? null,
});
              // Track lowest confidence for escalation decision
              if (typeof aiResult.confidence === "number") {
                lowestConfidence = Math.min(lowestConfidence, aiResult.confidence);
              }
            } catch (error) {
              strapi.log.error(`AI Eval failed for QNA ${qna.id}, Part ${i}:`, error);
              partFeedback = "AI Evaluation failed. Needs manual review.";
              isFullyEvaluated = false;
            }
          } else {
            // Objective grading
            const { isCorrect, feedback } = this.evaluateObjectivePart(
              studentPartResponse,
              partDef,
              questionData.question_type
            );
            if (isCorrect) partAwardedMarks = partDef.marks;
            partFeedback = feedback;
          }

          qnaTotalMarks += Number(partAwardedMarks);
          qnaFeedbackArray.push(`Part ${i + 1}: ${partFeedback}`);

          updatedPartEvaluations.push({
            ...(existingEval ? { id: existingEval.id } : {}),
            marks: partAwardedMarks,
            feedback: partFeedback,
          });
        }

        totalSubmissionMarks += qnaTotalMarks;

        updatedQuestionNAnswers.push({
          id: qna.id,
          question: qna.question ? qna.question.id : null,
          answer: qna.answer,
          question_n_answer: qna.question_n_answer,
          question_awarded_marks: qnaTotalMarks,
          question_feedback: qnaFeedbackArray.join('\n\n'),
          part_evaluations: updatedPartEvaluations,
         annotations: qnaAnnotationsByPart.length > 0 ? qnaAnnotationsByPart : null,
improved_answer: qnaImprovedAnswersByPart.length > 0 ? qnaImprovedAnswersByPart : null,
        });
      }

      // 5. Final status logic
      let finalStatus = "evaluated";
      let finalTutorFeedback = "Automatically evaluated by system.";

      if (!isFullyEvaluated) {
        finalStatus = "in_progress";
        finalTutorFeedback =
          "Partially evaluated. Some questions require manual grading due to missing answer keys/rubrics.";
      } else if (hasAIEvaluation) {
        if (lowestConfidence < CONFIDENCE_ESCALATION_THRESHOLD) {
          // Low confidence — escalate to human reviewer before releasing
          finalStatus = "needs_review";
          finalTutorFeedback = `AI evaluation confidence is low (${Math.round(lowestConfidence * 100)}%). A teacher should review before releasing results to the student.`;
        } else {
          finalStatus = "in_progress";
          finalTutorFeedback = `Evaluated by AI (confidence: ${Math.round(lowestConfidence * 100)}%). Please review and finalise subjective scores.`;
        }
      }

      const updatedSubmission = await strapi.entityService.update(
        "api::answer.answer",
        answerId,
        {
          data: {
            marks: totalSubmissionMarks,
            evaluation_status: finalStatus,
            tutor_feedback: finalTutorFeedback,
            question_n_answer: updatedQuestionNAnswers,
          },
        }
      );

      evaluationResults.push({
        id: updatedSubmission.id,
        marks: totalSubmissionMarks,
        status: finalStatus,
        confidence: lowestConfidence,
      });
      evaluatedCount++;
    }

    return { evaluatedCount, results: evaluationResults };
  },

  // ─── Short answer grader ──────────────────────────────────────────────────

  async evaluateWithAI(questionText, studentResponse, maxMarks, idealAnswer) {
    if (!studentResponse || studentResponse.trim() === "") {
      return { awardedMarks: 0, feedback: "No answer provided.", confidence: 1, annotations: null, improvedAnswer: null };
    }

    const parsed = await callCF({
      maxTokens: 700, // increased — now also generating annotations + improved answer
      messages: [
        {
          role: "system",
          content:
            "You are a strict but fair IB examiner. Grade student responses and provide actionable feedback. Return valid JSON only — no markdown, no explanation.",
        },
        {
          role: "user",
          content: `Grade this IB student response and provide detailed feedback.
 
Question: ${questionText}
Mark Scheme / Ideal Answer: ${idealAnswer || "Use your knowledge of IB marking criteria."}
Student Response: ${studentResponse}
Maximum Marks: ${maxMarks}
 
IB marking rules:
- Award marks based on understanding demonstrated, not perfect wording.
- For "state": 1 mark per correct point, no elaboration needed.
- For "explain/describe": credit the reasoning chain, not just the conclusion.
- For "analyse/evaluate": look for evidence, counter-argument, and judgement.
- Do NOT penalise minor spelling or grammar errors.
- Never award more than ${maxMarks} marks.
 
Return ONLY this JSON:
{
  "awardedMarks": <number 0–${maxMarks}>,
  "feedback": "<2-3 sentences: what was correct, what was missing, how to improve>",
  "confidence": <number 0–1, how confident you are in this grade>,
  "annotations": [
    {
      "quote": "<exact phrase copied verbatim from the student response — must exist word-for-word in the text>",
      "comment": "<specific issue or praise for this phrase, max 15 words>"
    }
  ],
  "improvedAnswer": "<rewritten version of the student response that would score full marks — same length and style as the original, not a model essay>"
}
 
Annotation rules:
- Only annotate short_answer or long_answer responses. Return [] for everything else.
- 2–4 annotations maximum. Focus on the most impactful points.
- Every quote MUST be copied verbatim from the student response — no paraphrasing.
- Mix positive annotations (what they did well) and corrective ones (what to fix).
- Keep comments under 15 words — they appear as inline tooltips.
 
Improved answer rules:
- Rewrite the student's actual response to score full marks.
- Match the student's approximate length and writing style — don't make it longer than needed.
- Do NOT write a model essay. Improve what they wrote, don't replace it entirely.
- If the student wrote nothing useful, write a minimal correct answer.
 
Confidence guide: 1.0 = clear-cut. 0.7 = reasonable judgement call. 0.5 = borderline. 0.3 = very unclear.`,
        },
      ],
    });

    return {
      awardedMarks: Math.min(Math.max(0, Number(parsed.awardedMarks) || 0), maxMarks),
      feedback: parsed.feedback || "No feedback provided.",
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) ?? 0.7)),
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : null,
      improvedAnswer: parsed.improvedAnswer || null,
    };
  },
  // ─── Essay / long answer grader ───────────────────────────────────────────


  async evaluateEssayWithAI(questionText, studentResponse, maxMarks, idealAnswer, subjectName) {
    if (!studentResponse || studentResponse.trim() === "") {
      return { awardedMarks: 0, feedback: "No answer provided.", confidence: 1, annotations: null, improvedAnswer: null };
    }

    const essayCriteria = getEssayCriteria(subjectName);

    const criteriaBlock = essayCriteria
      ? `Evaluate against these IB ${subjectName} criteria (${essayCriteria.maxPerCriterion} marks each):
${essayCriteria.criteria.map((c) => `- ${c}`).join("\n")}
For each criterion, award marks out of ${essayCriteria.maxPerCriterion} and give 1 sentence of feedback.
Total marks must not exceed ${maxMarks}.`
      : `Evaluate holistically for:
- Thesis clarity and direct answer to the question
- Quality and relevance of evidence/examples
- Depth of analysis and counter-argument
- Structural coherence (intro → body → conclusion)
- IB command term compliance
Total marks must not exceed ${maxMarks}.`;

    const parsed = await callCF({
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are a senior IB examiner specialising in essay assessment. Be specific — name the exact evidence or argument the student used or missed. Return valid JSON only.",
        },
        {
          role: "user",
          content: `Grade this IB essay response.
 
Question: ${questionText}
${idealAnswer ? `Mark Scheme Notes: ${idealAnswer}` : ""}
Student Essay: ${studentResponse}
Maximum Marks: ${maxMarks}
 
${criteriaBlock}
 
Return ONLY this JSON:
{
  "awardedMarks": <number 0–${maxMarks}>,
  "feedback": "<3-4 sentences: strongest part, weakest part, one specific improvement, overall impression>",
  ${essayCriteria
              ? `"criterionBreakdown": {
    ${essayCriteria.criteria.map((c) => `"${c}": { "marks": <0–${essayCriteria.maxPerCriterion}>, "comment": "<1 sentence>" }`).join(",\n    ")}
  },`
              : ""}
  "structureScore": <number 0–3, where 0=no structure 1=basic 2=clear 3=sophisticated>,
  "confidence": <number 0–1>,
  "annotations": [
    {
      "quote": "<exact phrase copied verbatim from the student essay>",
      "comment": "<specific issue or praise, max 15 words>"
    }
  ],
  "improvedAnswer": "<the student's essay rewritten to score one full band higher — preserve their argument, improve the execution>"
}
 
Annotation rules:
- 3–5 annotations for essays. More than short answers because essays are longer.
- Every quote MUST be verbatim from the student essay.
- Cover at least one structural comment, one argument/analysis comment, one evidence comment.
- Keep comments under 15 words.
 
Improved answer rules:
- Don't rewrite the whole essay from scratch — improve the student's actual argument.
- Add the specific things missing (counter-argument, named examples, command term compliance).
- Keep roughly the same length. A student who wrote 200 words should get ~220 words back, not 500.
 
Confidence guide: 1.0 = clearly strong/weak. 0.7 = solid judgement. 0.5 = borderline band. 0.3 = needs human review.`,
        },
      ],
    });

    // Build feedback string with criterion breakdown
    let feedbackStr = parsed.feedback || "No feedback provided.";

    if (parsed.criterionBreakdown) {
      const breakdownLines = Object.entries(parsed.criterionBreakdown)
        .map(([criterion, val]) => `**${criterion}** (${val.marks}/${essayCriteria.maxPerCriterion}): ${val.comment}`)
        .join("\n");
      feedbackStr = `${feedbackStr}\n\n**Criterion Breakdown:**\n${breakdownLines}`;
    }

    if (typeof parsed.structureScore === "number") {
      const structureLabel = ["No clear structure", "Basic structure", "Clear structure", "Sophisticated structure"][
        Math.min(3, parsed.structureScore)
      ];
      feedbackStr += `\n\n**Essay Structure:** ${structureLabel}`;
    }

    return {
      awardedMarks: Math.min(Math.max(0, Number(parsed.awardedMarks) || 0), maxMarks),
      feedback: feedbackStr,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) ?? 0.6)),
      criterionBreakdown: parsed.criterionBreakdown || null,
      structureScore: parsed.structureScore ?? null,
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : null,
      improvedAnswer: parsed.improvedAnswer || null,
    };
  },

  // ─── Objective grading ────────────────────────────────────────────────────

  evaluateObjectivePart(studentPartResponse, partDef, questionType) {
    if (!studentPartResponse || !partDef.correct_answer) {
      return { isCorrect: false, feedback: "No answer provided." };
    }

    let rawCorrect = partDef.correct_answer.replace(/<[^>]*>?/gm, "").trim();
    let parsedCorrect;
    try {
      parsedCorrect = JSON.parse(rawCorrect);
    } catch (e) {
      parsedCorrect = rawCorrect;
    }

    const cleanString = (str) => {
      if (typeof str !== "string") return "";
      return str
        .replace(/<[^>]*>?/gm, "")
        .replace(/&[a-zA-Z0-9#]+;/g, " ")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Match columns
    if (questionType === "match_columns" || typeof studentPartResponse === "object") {
      const correctObj =
        typeof parsedCorrect === "object" && !parsedCorrect.format
          ? parsedCorrect
          : partDef.correctMatchingPairs || {};

      const keys = Object.keys(correctObj);
      if (keys.length === 0) return { isCorrect: false, feedback: "No answer key provided." };

      const wrongPairs = [];
      const correctPairs = [];

      for (const key of keys) {
        const studentVal =
          studentPartResponse[key] !== undefined
            ? cleanString(String(studentPartResponse[key]))
            : "(no answer)";

        let expectedVal = "";
        let isMatch = false;

        if (typeof correctObj[key] === "object" && correctObj[key] !== null) {
          if (Array.isArray(correctObj[key].options)) {
            isMatch = correctObj[key].options.some((opt) => cleanString(String(opt)) === studentVal);
            expectedVal = correctObj[key].options.join(" / ");
          } else {
            expectedVal = cleanString(String(correctObj[key]));
            isMatch = studentVal === expectedVal;
          }
        } else {
          expectedVal = cleanString(String(correctObj[key]));
          isMatch = studentVal === expectedVal;
        }

        if (isMatch) {
          correctPairs.push(`✓ ${key} → ${studentVal}`);
        } else {
          wrongPairs.push(`✗ ${key}: you answered "${studentVal}", correct is "${expectedVal}"`);
        }
      }

      const isCorrect = wrongPairs.length === 0;
      const parts = [];
      if (correctPairs.length > 0) parts.push(`Correct: ${correctPairs.join(", ")}.`);
      if (wrongPairs.length > 0) parts.push(wrongPairs.join(". ") + ".");
      return { isCorrect, feedback: parts.join(" ") };
    }

    // Fill in the blanks
    if (questionType === "fill_in_the_blanks") {
      const correctObj =
        typeof parsedCorrect === "object" && !parsedCorrect.format ? parsedCorrect : {};
      const keys = Object.keys(correctObj);

      if (keys.length > 0) {
        const wrongBlanks = [];
        const correctBlanks = [];

        for (const key of keys) {
          const studentVal =
            studentPartResponse[key] !== undefined
              ? cleanString(String(studentPartResponse[key]))
              : "(left blank)";

          let expectedVal = "";
          let isMatch = false;

          if (Array.isArray(correctObj[key]?.options)) {
            isMatch = correctObj[key].options.some(
              (opt) => cleanString(String(opt)).toLowerCase() === studentVal.toLowerCase()
            );
            expectedVal = correctObj[key].options[0];
          } else {
            expectedVal = cleanString(String(correctObj[key]));
            isMatch = studentVal.toLowerCase() === expectedVal.toLowerCase();
          }

          if (isMatch) {
            correctBlanks.push(`Blank ${key}`);
          } else {
            wrongBlanks.push(`Blank ${key}: you wrote "${studentVal}", correct is "${expectedVal}"`);
          }
        }

        const isCorrect = wrongBlanks.length === 0;
        const parts = [];
        if (correctBlanks.length > 0) parts.push(`${correctBlanks.join(", ")} correct.`);
        if (wrongBlanks.length > 0) parts.push(wrongBlanks.join(". ") + ".");
        return { isCorrect, feedback: parts.join(" ") };
      }
    }

    // MCQ / single string
    const studentChoice = cleanString(
      typeof studentPartResponse === "string"
        ? studentPartResponse
        : JSON.stringify(studentPartResponse)
    );

    let correctChoice = "";
    if (typeof parsedCorrect === "object" && parsedCorrect !== null && parsedCorrect.content) {
      correctChoice = cleanString(parsedCorrect.content);
    } else {
      correctChoice = cleanString(rawCorrect);
    }

    if (correctChoice === "") {
      return { isCorrect: false, feedback: "No answer key provided for this question." };
    }

    const isCorrect = studentChoice === correctChoice;
    const feedback = isCorrect
      ? `Correct. The answer is "${correctChoice}".`
      : `Incorrect. You selected "${studentChoice}" but the correct answer is "${correctChoice}".${partDef.explanation ? ` Explanation: ${cleanString(partDef.explanation)}` : ""
      }`;

    return { isCorrect, feedback };
  },
}));