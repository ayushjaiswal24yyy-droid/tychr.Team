"use strict";

/**
 * lead controller
 */

module.exports = {
  async sendBrochureEmail(ctx) {
    const { leadName, email, classname, brochure } = ctx.request.body;

    if (!leadName || !email || !classname || !brochure) {
      return ctx.send({ error: "Missing required fields" }, 400);
    }
    const emailContent = `
      <h2>Thank You for Your Interest – Here's Your Brochure</h2>
      <p>Dear ${leadName},</p>
      <p>Thank you for reaching out to us regarding ${classname}. We appreciate your interest and are excited to share more information with you.</p>
      <p>Please find attached a brochure that provides an overview of our offerings, including details that align with your enquiry. If you have any additional questions or need further assistance, don’t hesitate to contact us.</p>
      <p>Feel free to reach out to us via email if you would like to schedule a demo session or discuss further.</p>
      <p><a href="${brochure.url}" target="_blank">Click here to download your brochure</a></p>

      <p>Looking forward to hearing from you soon!</p>
      <p>Best regards,</p>
      <p>Tychr Team</p>
    `;

    try {
      await strapi.plugins["email"].services.email.send({
        to: email,
        subject: "Thank You for Your Interest – Here's Your Brochure",
        html: emailContent,
      });

      ctx.send({ message: "Brochure email sent successfully!" });
    } catch (error) {
      console.error("Error sending email:", error);
      ctx.send({ error: "Failed to send email. Please try again later." }, 500);
    }
  },
};
