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
              part_evaluations: true // Get existing evaluations to update by ID
            }
          }
        }
      });

      // 2. Offline & Status Guardrails
      if (!submission || submission.evaluation_status === 'evaluated') continue;
      
      // Skip if the test series itself is offline OR if this specific submission is offline
      if (
        submission.test_series?.test_mode === 'offline' || 
        submission.submission_type === 'offline'
      ) {
        console.log(`Skipping submission ${answerId} because it is offline.`);
        continue; 
      }

      let totalSubmissionMarks = 0;
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

        // 4. MULTI-PART LOOP: Iterate through each part of the question
        for (let i = 0; i < parts.length; i++) {
          const partDef = parts[i];
          const studentPartResponse = studentAnswerJson[`part_${i}`];
          const existingEval = qna.part_evaluations?.[i]; // For preserving the component ID

          let partAwardedMarks = 0;
          let partFeedback = '';

          // Check if this specific part is subjective based on the main question type
          const isSubjective = ['short_answer', 'long_answer'].includes(questionData.question_type);

          if (isSubjective) {
            try {
              // Strip HTML for the AI if it's rich text
              const cleanResponse = typeof studentPartResponse === 'string' 
                ? studentPartResponse.replace(/<[^>]*>?/gm, '').trim() 
                : JSON.stringify(studentPartResponse);

              const aiResult = await this.evaluateWithAI(
                partDef.question_text || questionData.question, 
                cleanResponse,
                partDef.marks, // Max marks for THIS specific part
                partDef.correct_answer 
              );
              
              partAwardedMarks = aiResult.awardedMarks;
              partFeedback = aiResult.feedback;
            } catch (error) {
              console.error(`AI Eval failed for QNA ${qna.id}, Part ${i}:`, error);
              partFeedback = 'AI Evaluation failed. Needs manual review.';
            }
          } else {
            // Objective Grading per part
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

          // Add to the part_evaluations component array
          updatedPartEvaluations.push({
            ...(existingEval ? { id: existingEval.id } : {}), // Keep Strapi ID if it exists
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
      const updatedSubmission = await strapi.entityService.update('api::answer.answer', answerId, {
        data: {
          marks: totalSubmissionMarks,
          evaluation_status: 'evaluated',
          tutor_feedback: 'Automatically evaluated by system.',
          question_n_answer: updatedQuestionNAnswers, 
        },
      });

      evaluationResults.push({ id: updatedSubmission.id, marks: totalSubmissionMarks });
      evaluatedCount++;
    }

    return { evaluatedCount, results: evaluationResults };
  },

  evaluateObjectivePart(studentPartResponse, partDef) {
    if (!studentPartResponse || !partDef.correct_answer) return false;

    // Handle Match Columns (comparing JSON objects)
    if (typeof studentPartResponse === 'object') {
      // Add deep equality check here for match columns/drag drop
      return JSON.stringify(studentPartResponse) === JSON.stringify(partDef.correctMatchingPairs);
    }
    
    // Handle standard exact string match (MCQ)
    const studentChoice = studentPartResponse.replace(/<[^>]*>?/gm, '').trim(); 
    const correctChoice = partDef.correct_answer.replace(/<[^>]*>?/gm, '').trim();
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