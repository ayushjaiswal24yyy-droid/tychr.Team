"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const assertAdmin = (ctx) => {
  const user = ctx.state.user;
  const roleType = user?.role?.type;
  const roleName = user?.role?.name;

  if (!user) {
    ctx.unauthorized("Authentication required");
    return false;
  }

  if (!(roleType === "admin" || roleName === "Admin" || roleName === "admin")) {
    ctx.forbidden("Only admin users can manage question paper templates");
    return false;
  }

  return true;
};

module.exports = createCoreController(
  "api::question-paper-template.question-paper-template",
  ({ strapi }) => ({
    async find(ctx) {
      ctx.query = {
        ...ctx.query,
        populate: ctx.query.populate || {
          questions: {
            populate: {
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
            },
          },
          sections: {
            populate: {
              questions: {
                populate: {
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
                },
              },
            },
          },
          thumbnail: true,
          created_by_admin: true,
        },
      };

      return super.find(ctx);
    },

    async findOne(ctx) {
      ctx.query = {
        ...ctx.query,
        populate: ctx.query.populate || {
          questions: {
            populate: {
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
            },
          },
          sections: {
            populate: {
              questions: {
                populate: {
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
                },
              },
            },
          },
          thumbnail: true,
          created_by_admin: true,
        },
      };

      return super.findOne(ctx);
    },

    async create(ctx) {
      if (!assertAdmin(ctx)) return;
      return super.create(ctx);
    },

    async update(ctx) {
      if (!assertAdmin(ctx)) return;
      return super.update(ctx);
    },

    async delete(ctx) {
      if (!assertAdmin(ctx)) return;
      return super.delete(ctx);
    },

    async createFromPaper(ctx) {
      if (!assertAdmin(ctx)) return;

      const { paperId } = ctx.params;
      const overrides = ctx.request.body?.data || ctx.request.body || {};

      if (!paperId) {
        return ctx.badRequest("paperId is required");
      }

      try {
        const template = await strapi
          .service("api::question-paper-template.question-paper-template")
          .createFromPaper(paperId, ctx.state.user, overrides);

        return { data: template };
      } catch (error) {
        strapi.log.error("Failed to create question paper template", error);

        if (error.status === 404) {
          return ctx.notFound(error.message);
        }

        if (error.status === 400) {
          return ctx.badRequest(error.message);
        }

        return ctx.internalServerError(error.message);
      }
    },

    async duplicateTemplateToPaper(ctx) {
      if (!assertAdmin(ctx)) return;

      const { id } = ctx.params;
      const overrides = ctx.request.body?.data || ctx.request.body || {};

      if (!id) {
        return ctx.badRequest("Template id is required");
      }

      try {
        const paper = await strapi
          .service("api::question-paper-template.question-paper-template")
          .duplicateTemplateToPaper(id, ctx.state.user, overrides);

        return { data: paper };
      } catch (error) {
        strapi.log.error("Failed to duplicate template to paper", error);

        if (error.status === 404) {
          return ctx.notFound(error.message);
        }

        if (error.status === 400) {
          return ctx.badRequest(error.message);
        }

        return ctx.internalServerError(error.message);
      }
    },
  })
);
