module.exports = {
  async sendStatusEmail(ctx) {
    try {
      const { prevStatus, newStatus, studentFullName, studentEmail } =
        ctx.request.body;

      const studentMessage = `
        Dear ${studentFullName},

       We wanted to inform you that your lead status has been updated from ${prevStatus} to ${newStatus}.

      If you have any questions or need further assistance, feel free to reach out to us.

      Best regards,
      Tychr Team
      `;

      await strapi.plugins["email"].services.email.send({
        to: studentEmail,
        subject: "Update on Your Lead Status",
        text: studentMessage,
        html: `<p>${studentMessage.replace(/\n/g, "<br>")}</p>`,
      });

      ctx.send({
        message: "lead status email sent successfully!",
        status: true,
      });
    } catch (error) {
      console.error("Error sending lead status email:", error);
      ctx.send({ error: "Failed to send lead status email" }, 500);
    }
  },
};
