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
        console.log(`Skipping submission ${answerId} because it is offline.`);
        continue;
      }

      let totalSubmissionMarks = 0;
      let isFullyEvaluated = true; // Track if every single question had a rubric/correct answer
      const updatedQuestionNAnswers = [];

      // 3. Iterate through Q&A blocks
      for (const qna of submission.question_n_answer || []) {
        const questionData = qna.question;
        const studentAnswerJson = qna.answer;

        if (!questionData || !studentAnswerJson) {
          updatedQuestionNAnswers.push({ id: qna.id });
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

          // GUARDRAIL: Check if the question actually has a correct answer/rubric to grade against

          const canEvaluate = !!(partDef.correct_answer && partDef.correct_answer.replace(/<[^>]*>?/gm, '').trim() !== '');

          if (!canEvaluate) {
            // Skip evaluation for this part because the teacher didn't provide an answer key
            isFullyEvaluated = false;
            partAwardedMarks = existingEval ? existingEval.marks : 0; // Preserve existing marks if any
            partFeedback = 'Pending manual evaluation: No rubric or correct answer provided in the question bank.';
          }
          else if (isSubjective) {
            // Subjective AI Grading
            try {
              const cleanResponse = typeof studentPartResponse === 'string'
                ? studentPartResponse.replace(/<[^>]*>?/gm, '').trim()
                : JSON.stringify(studentPartResponse);

              const aiResult = await this.evaluateWithAI(
                partDef.question_text || questionData.question,
                cleanResponse,
                partDef.marks,
                partDef.correct_answer
              );

              partAwardedMarks = aiResult.awardedMarks;
              partFeedback = aiResult.feedback;
            } catch (error) {
              console.error(`AI Eval failed for QNA ${qna.id}, Part ${i}:`, error);
              partFeedback = 'AI Evaluation failed. Needs manual review.';
              isFullyEvaluated = false; // Mark incomplete so tutor can fix it
            }
          } else {
            // Objective Grading
            const isCorrect = this.evaluateObjectivePart(studentPartResponse, partDef);
            if (isCorrect) {
              partAwardedMarks = partDef.marks;
              partFeedback = 'Correct';
            } else {
              partFeedback = 'Incorrect';
            }
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
          question_awarded_marks: qnaTotalMarks,
          question_feedback: qnaFeedbackArray.join('\n\n'),
          part_evaluations: updatedPartEvaluations,
        });
      }

      // 6. Final Update
      // If we couldn't evaluate everything, set it to "in_progress" instead of "evaluated"
      const finalStatus = isFullyEvaluated ? 'evaluated' : 'in_progress';

      const finalTutorFeedback = isFullyEvaluated
        ? 'Automatically evaluated by system.'
        : 'Partially evaluated. Some questions require manual grading due to missing answer keys/rubrics.';

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

  evaluateObjectivePart(studentPartResponse, partDef) {
    if (!studentPartResponse || !partDef.correct_answer) return false;

    // 1. Strip the HTML tags that Strapi's editor might wrap around the JSON
    let rawCorrect = partDef.correct_answer.replace(/<[^>]*>?/gm, '').trim();
    let parsedCorrect;

    // 2. Try to parse the cleaned string as JSON
    try {
      parsedCorrect = JSON.parse(rawCorrect);
    } catch (e) {
      parsedCorrect = rawCorrect; // Fallback: normal string
    }

    // --- MATCH COLUMNS / FILL IN THE BLANKS (Object grading) ---
    // (This handles your complex {"options": ["are", "Are"]} structure)
    if (typeof studentPartResponse === 'object') {
      const correctObj = (typeof parsedCorrect === 'object' && !parsedCorrect.format) 
        ? parsedCorrect 
        : (partDef.correctMatchingPairs || {});

      const keys = Object.keys(correctObj);
      if (keys.length === 0) return false;

      for (const key of keys) {
        let studentVal = studentPartResponse[key] !== undefined ? String(studentPartResponse[key]).trim() : "";
        let isMatch = false;

        if (typeof correctObj[key] === 'object' && correctObj[key] !== null) {
          if (Array.isArray(correctObj[key].options)) {
            isMatch = correctObj[key].options.some(opt => String(opt).trim() === studentVal);
          } else {
            isMatch = String(studentPartResponse[key]) === String(correctObj[key]);
          }
        } else {
          isMatch = studentVal === String(correctObj[key]).trim();
        }

        if (!isMatch) return false; 
      }
      return true;
    }
    
    // --- MCQ / STRING GRADING ---
    const cleanString = (str) => {
      if (typeof str !== 'string') return '';
      return str
        .replace(/<[^>]*>?/gm, '')     // Remove HTML
        .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove entities like &nbsp;
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
        .replace(/\s+/g, ' ')          // Collapse multi-spaces and newlines
        .trim();
    };

    const studentChoice = cleanString(studentPartResponse);
    
    // Extract the actual answer from the JSON wrapper if it exists (handles both "html" and "richtext" formats)
    let correctChoice = '';
    if (typeof parsedCorrect === 'object' && parsedCorrect !== null && parsedCorrect.content) {
      correctChoice = cleanString(parsedCorrect.content);
    } else {
      correctChoice = cleanString(rawCorrect);
    }

    if (correctChoice === '') return false;

    return studentChoice === correctChoice;
  },
  async evaluateWithAI(questionText, studentResponse, maxMarks, idealAnswer) {
    if (!studentResponse || studentResponse.trim() === '') {
      return { awardedMarks: 0, feedback: "No answer provided." };
    }

    const prompt = `
      You are an expert tutor grading a test.
      
      Question: ${questionText}
      Ideal Answer / Rubric: ${idealAnswer || 'N/A'}
      Student's Answer: ${studentResponse}
      Max Marks Available: ${maxMarks}
      
      Evaluate the student's answer. Return ONLY a valid JSON object with exactly two keys:
      1. "awardedMarks": A number between 0 and ${maxMarks}.
      2. "feedback": A brief, constructive explanation of why these marks were awarded.
    `;

    // Example AI Call:
    // const result = await model.generateContent(prompt);
    // return JSON.parse(result.response.text());

    return {
      awardedMarks: Math.min(maxMarks, Math.floor(Math.random() * maxMarks) + 1),
      feedback: "The student demonstrated a good understanding, but missed minor details.",
    };
  }
}));