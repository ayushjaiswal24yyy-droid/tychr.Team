"use strict";

/**
 * enrollment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::enrollment.enrollment", () => ({
  async index(ctx, next) {
    const { user, classroom } = ctx.request.body;
    const classDetails = await strapi.entityService.findOne(
      "api::enrollment.enrollment",
      classroom
    );
    if (!classDetails) {
      return ctx.send({ error: "Class not found" }, 404);
    }
    const adminLink = `https://backend.tychr.com/admin/content-manager/collection-types/api::enrollment.enrollment/${classroom}`; // Adjust the URL accordingly

    const emailContent = `
        <h2>New Student Enrollment Inquiry</h2>
        <p><strong>Student Name:</strong> ${user.fullName}</p>
        <p><strong>Student Email:</strong> ${user.email}</p>
        <p><strong>Class Interested:</strong> ${classDetails.classroom_name}</p>
        <p>This student has inquired to enroll in the above class.</p>
        <p>Please review and respond accordingly.</p>
        <p><a href="${adminLink}">Click here to review the enrollment</a></p>

      `;
    await strapi.plugins["email"].services.email.send({
      to: "echendu0803@gmail.com",
      subject: `New Enrollment Inquiry for ${classDetails.classroom_name}`,
      html: emailContent,
    });
    ctx.send({ message: "Enrollment inquiry email sent to admin!" });
  },
}));
