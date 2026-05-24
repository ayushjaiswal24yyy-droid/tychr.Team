"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

const QUESTION_POPULATE = {
  parts: {
    populate: {
      hints: true,
      attachments: true,
      left_items: true,
      right_items: true,
    },
  },
  attachments: true,
  note: true,
  unit: true,
};

const PAPER_POPULATE = {
  question_banks: {
    populate: QUESTION_POPULATE,
  },
  papers: {
    populate: {
      question_banks: {
        populate: QUESTION_POPULATE,
      },
      grade_subject: true,
      test_papers: true,
      formula_booklet: true,
      instruction_booklet: true,
      resource: true,
      offline_pdf: true,
      solution_pdf: true,
    },
  },
  grade_subject: true,
  parent_test_series: true,
  test_papers: true,
  formula_booklet: true,
  instruction_booklet: true,
  resource: true,
  offline_pdf: true,
  solution_pdf: true,
};

const TEMPLATE_POPULATE = {
  questions: {
    populate: QUESTION_POPULATE,
  },
  sections: {
    populate: {
      questions: {
        populate: QUESTION_POPULATE,
      },
    },
  },
  thumbnail: true,
  created_by_admin: true,
};

const paperTypeMap = {
  "Practice Test": "practice",
  "Test Series": "mock",
};

const pickQuestionIds = (questions = []) => questions.map((question) => question.id);

const sumQuestionMarks = (questions = []) =>
  questions.reduce((total, question) => total + Number(question.marks || 0), 0);

const getPaperQuestionGroups = (paper) => {
  if (paper.question_banks?.length) {
    return [
      {
        paper,
        order: 1,
        questions: paper.question_banks,
      },
    ];
  }

  return (paper.papers || [])
    .map((childPaper, index) => ({
      paper: childPaper,
      order: index + 1,
      questions: childPaper.question_banks || [],
    }))
    .filter((group) => group.questions.length);
};

const getOrderedQuestions = (paper) =>
  getPaperQuestionGroups(paper).flatMap((group) => group.questions);

const normalizeTags = (input) => {
  if (Array.isArray(input)) return input;
  if (typeof input === "string" && input.trim()) {
    return input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

module.exports = createCoreService(
  "api::question-paper-template.question-paper-template",
  ({ strapi }) => ({
    async getPaperWithQuestions(paperId) {
      return strapi.entityService.findOne("api::test-serie.test-serie", paperId, {
        populate: PAPER_POPULATE,
      });
    },

    buildQuestionSnapshot(paper, source = "paper") {
      const questions = getOrderedQuestions(paper);
      const groups = getPaperQuestionGroups(paper);

      return {
        schema_version: 1,
        source,
        captured_at: new Date().toISOString(),
        source_paper_id: String(paper.id),
        source_paper: {
          id: paper.id,
          title: paper.title,
          test_type: paper.test_type,
          test_mode: paper.test_mode,
          test_duration: paper.test_duration,
          total_marks: sumQuestionMarks(questions),
          grade_subject: paper.grade_subject || null,
        },
        source_sections: groups.map((group) => ({
          order: group.order,
          paper_id: group.paper.id,
          title: group.paper.title,
          question_order: pickQuestionIds(group.questions),
        })),
        question_order: pickQuestionIds(questions),
        questions: questions.map((question, index) => ({
          order: index + 1,
          id: question.id,
          question,
        })),
      };
    },

    buildSectionsFromPaper(paper) {
      const groups = getPaperQuestionGroups(paper);

      if (groups.length > 1) {
        return groups.map((group) => ({
          title: group.paper.title || `Paper ${group.order}`,
          instructions: group.paper.instructions || paper.instructions || "",
          section_marks: sumQuestionMarks(group.questions),
          order: group.order,
          questions: pickQuestionIds(group.questions),
        }));
      }

      const questions = groups[0]?.questions || [];

      return [
        {
          title: groups[0]?.paper?.title || "Section A",
          instructions: groups[0]?.paper?.instructions || paper.instructions || "",
          section_marks: sumQuestionMarks(questions),
          order: 1,
          questions: pickQuestionIds(questions),
        },
      ];
    },

    buildTemplateDataFromPaper(paper, adminUser, overrides = {}) {
      const questions = getOrderedQuestions(paper);
      const questionIds = pickQuestionIds(questions);

      return {
        title: overrides.title || `${paper.title || "Question Paper"} Template`,
        description:
          overrides.description ||
          `Template duplicated from paper ${paper.title || paper.id}.`,
        instructions: overrides.instructions ?? paper.instructions ?? "",
        duration: overrides.duration ?? paper.test_duration ?? null,
        total_marks: overrides.total_marks ?? sumQuestionMarks(questions),
        paper_type: overrides.paper_type || paperTypeMap[paper.test_type] || "mock",
        sections: overrides.sections || this.buildSectionsFromPaper(paper),
        questions: questionIds,
        created_by_admin: adminUser?.id,
        tags: normalizeTags(overrides.tags),
        thumbnail: overrides.thumbnail || null,
        source_paper_id: String(paper.id),
        is_template: true,
        template_questions_snapshot: this.buildQuestionSnapshot(paper, "paper"),
        template_metadata: {
          source: "paper_duplication",
          source_entity: "api::test-serie.test-serie",
          source_paper_id: String(paper.id),
          source_question_order: questionIds,
          created_by_admin_id: adminUser?.id || null,
          supports: [
            "ai_generated_templates",
            "versioning",
            "export_import",
            "pdf_generation",
            "institution_templates",
            "template_visibility",
          ],
        },
        visibility: overrides.visibility || "private",
        version: 1,
      };
    },

    async createFromPaper(paperId, adminUser, overrides = {}) {
      const paper = await this.getPaperWithQuestions(paperId);

      if (!paper) {
        const error = new Error("Source paper not found");
        error.status = 404;
        throw error;
      }

      if (!getOrderedQuestions(paper).length) {
        const error = new Error("Source paper does not have any related questions");
        error.status = 400;
        throw error;
      }

      const data = this.buildTemplateDataFromPaper(paper, adminUser, overrides);

      return strapi.entityService.create(
        "api::question-paper-template.question-paper-template",
        {
          data,
          populate: TEMPLATE_POPULATE,
        }
      );
    },

    async duplicateTemplateToPaper(templateId, adminUser, overrides = {}) {
      const template = await strapi.entityService.findOne(
        "api::question-paper-template.question-paper-template",
        templateId,
        { populate: TEMPLATE_POPULATE }
      );

      if (!template) {
        const error = new Error("Template not found");
        error.status = 404;
        throw error;
      }

      const questionIds = pickQuestionIds(template.questions || []);
      const templateSnapshot = template.template_questions_snapshot || {};

      const data = {
        title: overrides.title || `${template.title} Copy`,
        test_duration: overrides.test_duration ?? template.duration ?? null,
        instructions: overrides.instructions ?? template.instructions ?? "",
        test_type: overrides.test_type || "Test Series",
        test_mode: overrides.test_mode || "online",
        year: overrides.year || new Date().getFullYear(),
        pass_mark: overrides.pass_mark ?? null,
        grade_subject: overrides.grade_subject || null,
        question_banks: questionIds,
        entity_type: overrides.entity_type || "paper",
        ai_evaluation_enabled: overrides.ai_evaluation_enabled ?? true,
        allowed_question_types:
          overrides.allowed_question_types ||
          templateSnapshot.questions?.map(({ question }) => question.question_type) ||
          [],
      };

      return strapi.entityService.create("api::test-serie.test-serie", {
        data,
        populate: PAPER_POPULATE,
      });
    },

    constants: {
      QUESTION_POPULATE,
      PAPER_POPULATE,
      TEMPLATE_POPULATE,
    },
  })
);
