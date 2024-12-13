"use strict";

/**
 * enrollment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("plugin::users-permissions.user", () => ({
  async index(ctx) {
    const { id, gradeId } = ctx.request.body;
    const results = await strapi.db
      .query("plugin::users-permissions.user")
      .findMany({
        where: {
          id,
          role: {
            name: "Tutor",
          },
        },
        populate: {
          teaching: {
            populate: {
              students: {
                populate: {
                  answers: {
                    where: {
                      test_series: {
                        grade_subject: {
                          id: gradeId,
                        },
                      },
                    },
                    populate: {
                      student: true,
                      question_n_answer: true,
                      test_series: {
                        populate: {
                          grade_subject: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    let allAnswers = [];

    results.forEach((user) => {
      user.teaching.forEach((teaching) => {
        teaching.students.forEach((student) => {
          student.answers.forEach((answer) => {
            if (
              !allAnswers.some(
                (existingAnswer) => existingAnswer.id === answer.id
              )
            ) {
              allAnswers.push(answer);
            }
          });
        });
      });
    });

    ctx.body = { allAnswers };
    ctx.send({ allAnswers });
  },
}));
