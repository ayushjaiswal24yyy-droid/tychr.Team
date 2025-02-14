"use strict";

/**
 * enrollment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::enrollment.enrollment", () => ({
  async index(ctx) {
    const { user, classroomname, topic } = ctx.request.body;

    if (!user) {
      return ctx.send({ error: "User not found" }, 404);
    }

    const emailContent = `
        <h2>Classroom Approval Process</h2>
        <p>Dear ${user?.fullName},</p>
        <p>Thank you for your interest in creating a classroom on Tychr. To proceed with the approval of your classroom "<strong>${classroomname}</strong>", we require a demo video.</p>
        <p>Please submit a short demo video on the topic "<strong>${topic}</strong>". This will help us assess the quality and structure of your teaching.</p>
        <p><strong>How to Submit:</strong></p>
        <ul>
          <li>Ensure the video is clear and properly structured.</li>
          <li>Upload the demo video to Google Drive, YouTube, or any cloud storage.</li>
          <li>Send the video link to our team at <a href="mailto:support@tychr.com">support@tychr.com</a>.</li>
        </ul>
        <p>Once we review your demo, we will get back to you regarding the approval of your classroom.</p>
        <p>Thank you for your commitment to education!</p>
        <p>Best regards,</p>
        <p>The Tychr Team</p>
      `;

    await strapi.plugins["email"].services.email.send({
      to: user.email,
      subject: "Action Required: Submit a Demo Video for Classroom Approval",
      html: emailContent,
    });

    ctx.send({ message: "Demo video request email sent!" });
  },
}));
