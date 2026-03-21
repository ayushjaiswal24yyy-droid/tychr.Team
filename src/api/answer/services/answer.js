"use strict"

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::answer.answer", () => ({

  async processBulkEvaluation(answerIds) {
    let evaluatedCount = 0;
    const evaluationResults = [];

    for (const answerId of answerIds) {
      // 1. Fetch submission with test_series and nested question components
      const submission = await strapi.entityService.findOne('api::answer.answer', answerId, {
        populate: {
          test_series: true,
          question_n_answer: {
            populate: {
              question: {
                populate: ['parts']
              },
              part_evaluations: true
            }
          }
        }
      });

      // 2. Offline & Status Guardrails
      if (!submission || submission.evaluation_status === 'evaluated') continue;

      if (
        submission.test_series?.test_mode === 'offline' ||
        submission.submission_type === 'offline'
      ) {
        console.log(`Skipping submission ${answerId}: offline.`);
        continue;
      }

      if (submission.test_series?.ai_evaluation_enabled === false) {
        // Teacher explicitly disabled AI grading for this paper (e.g. TOK essay, History IA)
        console.log(`Skipping submission ${answerId}: AI evaluation disabled for this test series.`);
        await strapi.entityService.update('api::answer.answer', answerId, {
          data: {
            evaluation_status: 'pending',
            tutor_feedback: 'This paper requires manual evaluation by a teacher.',
          },
        });
        continue;
      }


      let totalSubmissionMarks = 0;
      let isFullyEvaluated = true; // Track if every single question had a rubric/correct answer
      let hasAIEvaluation = false; // NEW: Track if AI was used for any part of this test
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
        const qnaFeedbackArray = [];
        const updatedPartEvaluations = [];

        const parts = questionData.parts || [];

        // 4. MULTI-PART LOOP
        for (let i = 0; i < parts.length; i++) {
          const partDef = parts[i];
          const studentPartResponse = studentAnswerJson[`part_${i}`];
          const existingEval = qna.part_evaluations?.[i];

          let partAwardedMarks = 0;
          let partFeedback = '';

          const isSubjective = ['short_answer', 'long_answer'].includes(questionData.question_type);

          // --- NEW: Unpack the correct answer carefully ---
          let extractedCorrectAnswer = "";
          let hasValidObjectRubric = false;

          if (partDef.correct_answer) {
            // Strip any outer HTML tags first
            let rawCorrect = partDef.correct_answer.replace(/<[^>]*>?/gm, '').trim();
            try {
              const parsed = JSON.parse(rawCorrect);
              if (parsed && typeof parsed === 'object') {
                if (parsed.content !== undefined) {
                  // It's the {"format":"richtext","content":""} wrapper. Extract the content.
                  extractedCorrectAnswer = parsed.content.replace(/<[^>]*>?/gm, '').trim();
                } else {
                  // It's a valid JSON object map like {"1":"are"}
                  hasValidObjectRubric = Object.keys(parsed).length > 0;
                  extractedCorrectAnswer = rawCorrect;
                }
              }
            } catch (e) {
              // It's just a normal string
              extractedCorrectAnswer = rawCorrect;
            }
          }

          // GUARDRAIL: Now check if the extracted answer is actually empty
          let canEvaluate = false;
          if (typeof studentPartResponse === 'object' && !isSubjective) {
            canEvaluate = hasValidObjectRubric || !!partDef.correctMatchingPairs;
          } else {
            canEvaluate = extractedCorrectAnswer !== '';
          }

          if (!canEvaluate) {
            // Skip evaluation because the teacher left the rubric/answer completely blank
            isFullyEvaluated = false;
            partAwardedMarks = existingEval ? existingEval.marks : 0;
            partFeedback = 'Pending manual evaluation: No rubric or correct answer provided in the question bank.';
          }
          else if (isSubjective) {
            // Subjective AI Grading
            hasAIEvaluation = true;
            try {
              const cleanResponse = typeof studentPartResponse === 'string'
                ? studentPartResponse.replace(/<[^>]*>?/gm, '').trim()
                : JSON.stringify(studentPartResponse);

              const aiResult = await this.evaluateWithAI(
                partDef.question_text || questionData.question,
                cleanResponse,
                partDef.marks,
                extractedCorrectAnswer // Pass the CLEAN, extracted text to the AI!
              );

              partAwardedMarks = aiResult.awardedMarks;
              partFeedback = aiResult.feedback;
            } catch (error) {
              console.error(`AI Eval failed for QNA ${qna.id}, Part ${i}:`, error);
              partFeedback = 'AI Evaluation failed. Needs manual review.';
              isFullyEvaluated = false;
            }
          } else {
            // Objective Grading (evaluateObjectivePart already parses it properly)
            const { isCorrect, feedback } = this.evaluateObjectivePart(
              studentPartResponse,
              partDef,
              questionData.question_type  // ← pass this so fill_in_the_blanks routes correctly
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

        // 5. Prepare the updated QnA block
        updatedQuestionNAnswers.push({
          id: qna.id,
          question: qna.question ? qna.question.id : null,
          answer: qna.answer,
          question_n_answer: qna.question_n_answer,
          question_awarded_marks: qnaTotalMarks,
          question_feedback: qnaFeedbackArray.join('\n\n'),
          part_evaluations: updatedPartEvaluations,
        });
      }

      // 6. Final Update Logic
      let finalStatus = 'evaluated';
      let finalTutorFeedback = 'Automatically evaluated by system.';

      if (!isFullyEvaluated) {
        finalStatus = 'in_progress';
        finalTutorFeedback = 'Partially evaluated. Some questions require manual grading due to missing answer keys/rubrics.';
      } else if (hasAIEvaluation) {
        // NEW: Force to in_progress if AI was used, even if everything was technically evaluated
        finalStatus = 'in_progress';
        finalTutorFeedback = 'Evaluated by AI. Please review and finalize the subjective scores.';
      }

      const updatedSubmission = await strapi.entityService.update('api::answer.answer', answerId, {
        data: {
          marks: totalSubmissionMarks,
          evaluation_status: finalStatus,
          tutor_feedback: finalTutorFeedback,
          question_n_answer: updatedQuestionNAnswers,
        },
      });

      evaluationResults.push({ id: updatedSubmission.id, marks: totalSubmissionMarks, status: finalStatus });
      evaluatedCount++;
    }

    return { evaluatedCount, results: evaluationResults };
  },

  evaluateObjectivePart(studentPartResponse, partDef, questionType) {
    if (!studentPartResponse || !partDef.correct_answer) {
      return { isCorrect: false, feedback: "No answer provided." };
    }

    // Strip HTML and try to parse as JSON
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

    // ─── MATCH COLUMNS ──────────────────────────────────────────────────────────
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
            isMatch = correctObj[key].options.some(
              (opt) => cleanString(String(opt)) === studentVal
            );
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
          wrongPairs.push(`✗ ${key}: you answered "${studentVal}", correct answer is "${expectedVal}"`);
        }
      }

      const isCorrect = wrongPairs.length === 0;
      const feedbackParts = [];

      if (correctPairs.length > 0) feedbackParts.push(`Correct: ${correctPairs.join(", ")}.`);
      if (wrongPairs.length > 0) feedbackParts.push(wrongPairs.join(". ") + ".");

      return {
        isCorrect,
        feedback: feedbackParts.join(" "),
      };
    }

    // ─── FILL IN THE BLANKS ─────────────────────────────────────────────────────
    if (questionType === "fill_in_the_blanks") {
      // Same object structure as match columns but surfaced differently in feedback
      const correctObj =
        typeof parsedCorrect === "object" && !parsedCorrect.format ? parsedCorrect : {};

      const keys = Object.keys(correctObj);
      if (keys.length === 0) {
        // Single blank — fall through to MCQ/string grading below
      } else {
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
            expectedVal = correctObj[key].options[0]; // show the primary accepted answer
          } else {
            expectedVal = cleanString(String(correctObj[key]));
            isMatch = studentVal.toLowerCase() === expectedVal.toLowerCase();
          }

          if (isMatch) {
            correctBlanks.push(`Blank ${key}`);
          } else {
            wrongBlanks.push(`Blank ${key}: you wrote "${studentVal}", correct answer is "${expectedVal}"`);
          }
        }

        const isCorrect = wrongBlanks.length === 0;
        const parts = [];
        if (correctBlanks.length > 0) parts.push(`${correctBlanks.join(", ")} correct.`);
        if (wrongBlanks.length > 0) parts.push(wrongBlanks.join(". ") + ".");

        return { isCorrect, feedback: parts.join(" ") };
      }
    }

    // ─── MCQ / single string ────────────────────────────────────────────────────
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
      : `Incorrect. You selected "${studentChoice}" but the correct answer is "${correctChoice}".${partDef.explanation
        ? ` Explanation: ${cleanString(partDef.explanation)}`
        : ""
      }`;

    return { isCorrect, feedback };
  },
  async evaluateWithAI(questionText, studentResponse, maxMarks, idealAnswer) {
    if (!studentResponse || studentResponse.trim() === '') {
      return { awardedMarks: 0, feedback: "No answer provided." };
    }

    const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`;

    const systemPrompt = `You are a strict but fair IB examiner. You grade student responses against mark scheme criteria.
Always return valid JSON only — no explanation, no markdown.`;

    const userPrompt = `Grade this IB student response.
 
Question: ${questionText}
Mark Scheme / Ideal Answer: ${idealAnswer || 'Use your knowledge of IB marking criteria.'}
Student Response: ${studentResponse}
Maximum Marks: ${maxMarks}
 
IB marking rules to follow:
- Award marks based on understanding demonstrated, not perfect wording.
- For "state" questions: 1 mark per correct point, no elaboration needed.
- For "explain/describe": credit the reasoning chain, not just the conclusion.
- For "analyse/evaluate": look for evidence, counter-argument, and judgement.
- Do NOT penalise for minor spelling or grammar errors.
- Never award more than ${maxMarks} marks.
 
Return ONLY this JSON object:
{
  "awardedMarks": <number 0 to ${maxMarks}>,
  "feedback": "<2-3 sentences: what was correct, what was missing, how to improve>"
}`;

    const res = await fetch(CF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
      },
      body: JSON.stringify({
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        max_tokens: 300, // grading response is short — keep latency low
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudflare AI error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (e) {
      throw new Error(`AI returned invalid JSON: ${raw}`);
    }

    // Clamp marks defensively — model should respect the max but don't trust it blindly
    const awardedMarks = Math.min(
      Math.max(0, Number(parsed.awardedMarks) || 0),
      maxMarks
    );

    return {
      awardedMarks,
      feedback: parsed.feedback || 'No feedback provided.',
    };
  },
}));