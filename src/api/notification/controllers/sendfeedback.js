module.exports = {
  async sendFeedbackEmail(ctx) {
    try {
      const inquiry = ctx.request.body;
      const studentEmail = inquiry.student_email;
      const studentFullName = inquiry.student_fullName;
      const tutorFullName = inquiry.tutor_fullName;

      const classroomName = inquiry.classroom_name;

      const studentMessage = `
        Dear ${studentFullName},

        We hope you found the demo session with ${tutorFullName} regarding the classroom "${classroomName}" insightful and valuable.

        At Tychr, we are dedicated to providing exceptional learning opportunities tailored to your needs.
        If you have any questions about the session, the classroom, or the next steps, feel free to reach out to us.

        Thank you for choosing Tychr. We look forward to supporting your academic journey!
        Regards,
        Tychr Team
      `;

      await strapi.plugins["email"].services.email.send({
        to: studentEmail,
        subject: "Feedback of Demo Session",
        text: studentMessage,
        html: `<p>${studentMessage.replace(/\n/g, "<br>")}</p>`,
      });

      ctx.send({ message: "feedback email sent successfully!", status: true });
    } catch (error) {
      console.error("Error sending feedback email:", error);
      ctx.send({ error: "Failed to send feedback emails" }, 500);
    }
  },
};
