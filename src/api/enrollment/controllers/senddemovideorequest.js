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
       <p>Thank you for your interest in creating a classroom on Tychr! To proceed with the approval of your classroom, <strong>"${classroomname}"</strong>, we kindly ask you to submit a short demo video on the topic <strong>"${topic}"</strong>.</p>

    <h3>Why is this required?</h3>
    <p>This demo video will help us assess the quality and structure of your teaching before approving your classroom.</p>

    <h3>How to Submit Your Demo Video:</h3>
    <ul>
        <li>Ensure the video is clear and well-structured.</li>
        <li>Upload it directly to your classroom on Tychr.</li>
    </ul>

    <p>Once we review your demo, we’ll get back to you regarding the approval of your classroom.</p>

    <p>We appreciate your dedication to education and look forward to seeing your teaching style in action!</p>

    <p><strong>Best regards,</strong></p>
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
