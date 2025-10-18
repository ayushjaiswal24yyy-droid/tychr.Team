"use strict";

/**
 * enrollment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::enrollment.enrollment", () => ({
  async index(ctx) {
    const { user, status } = ctx.request.body;

    if (!user) {
      return ctx.send({ error: "email not found" }, 404);
    }

    const emailContent = `
        <h2>Tutor Application Update</h2>
    <p>Dear ${user?.fullName},</p>
    <p>We hope this message finds you well. We are writing to inform you that your request to join Tychr as a tutor has been <strong>${status}</strong>.</p>
    ${
      status === "accepted"
        ? `<p>Congratulations! We are excited to welcome you to the Tychr family. You can now start setting up your profile and explore opportunities.</p>`
        : `<p>Unfortunately, we are unable to approve your request at this time. Please feel free to apply again in the future.</p>`
    }
    <p>Thank you for your interest in Tychr.</p>
    <p>Best regards,</p>
    <p>The Tychr Team</p>
      `;
    // await strapi.plugins["email"].services.email.send({
    //   to: user.email,
    //   subject:
    //     status === "accepted"
    //       ? "Congratulations! Your Tutor Application Has Been Approved"
    //       : "Update on Your Tutor Application with Tychr",
    //   html: emailContent,
    // });
    ctx.send({ message: "Approval email sent!" });
  },
}));
