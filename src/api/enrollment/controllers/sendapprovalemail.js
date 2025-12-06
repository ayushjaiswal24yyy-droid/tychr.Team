"use strict";

/**
 * enrollment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::enrollment.enrollment", () => ({
  async index(ctx) {
    const { user, status, classroomname } = ctx.request.body;
    console.log(user, status, classroomname);
    if (!user) {
      return ctx.send({ error: "user not found" }, 404);
    }

    const emailContent = `
        <h2>Classroom Update</h2>
    <p>Dear ${user?.fullName},</p>
    <p>We hope this message finds you well. We are writing to inform you that your request to create classroom ${classroomname} has been <strong>${status}</strong>.</p>
    ${
      status === "accepted"
        ? `<p>Congratulations! Your request to create the classroom has been approved. Please proceed to set up the classroom details and prepare to inspire students with your teaching.</p>
       <p>If you need any assistance, feel free to reach out to our support team. We're here to help!</p>`
        : `<p>We regret to inform you that your request to create the classroom has not been approved at this time. This decision was made after careful consideration of our current requirements and guidelines.</p>`
    }
<p>Thank you for your commitment to education and for considering Tychr as a platform to share your knowledge.</p>
<p>Best regards,</p>
<p>The Tychr Team</p>
      `;
    // await strapi.plugins["email"].services.email.send({
    //   to: user.email,
    //   subject:
    //     status === "accepted"
    //       ? "Congratulations! Your Classroom Creation Request Has Been Approved"
    //       : "Update on Your Classroom Creation Request",
    //   html: emailContent,
    // });

    ctx.send({ message: "Approval email sent!" });
  },
}));
