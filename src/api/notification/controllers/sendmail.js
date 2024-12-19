module.exports = {
  async sendEnquiryEmails(ctx) {
    try {
      const inquiry = ctx.request.body;
      const studentEmail = inquiry.student_email;
      const studentFullName = inquiry.student_fullName;
      const tutorEmail = inquiry.tutor_email;
      const tutorFullName = inquiry.tutor_fullName;
      const meetingLink = inquiry.meeting_url;
      const demoTime = inquiry.time;
      const scheduledate = inquiry.schedule;
      const classroomName = inquiry.classroom_name;
      const studentMessage = `
        Dear ${studentFullName},

        Thank you for your inquiry! We have scheduled a demo booking for you.
        Here are the details:

        - Demo Time:${scheduledate} at ${demoTime}
        - Classroom: ${classroomName}
        - Tutor: ${tutorFullName}
        - Meeting Link: ${meetingLink}

        Please reply to this email if you have any questions.

        Regards,
        Tychr Team
      `;

      const tutorMessage = `
        Dear ${tutorFullName},

        A student has made an inquiry and selected the following demo booking time:

        - Student: ${studentFullName}
        - Demo Time:${scheduledate} at ${demoTime}
        - Classroom: ${classroomName}
        - Meeting Link: ${meetingLink}

        Please ensure you are available during this time.

        Regards,
        Tychr Team
      `;

      await strapi.plugins["email"].services.email.send({
        to: studentEmail,
        subject: "Your Demo Booking Details",
        text: studentMessage,
        html: `<p>${studentMessage.replace(/\n/g, "<br>")}</p>`,
      });

      await strapi.plugins["email"].services.email.send({
        to: tutorEmail,
        subject: "New Student Inquiry",
        text: tutorMessage,
        html: `<p>${tutorMessage.replace(/\n/g, "<br>")}</p>`,
      });

      ctx.send({ message: "Inquiry emails sent successfully!", status: true });
    } catch (error) {
      console.error("Error sending inquiry emails:", error);
      ctx.send({ error: "Failed to send inquiry emails" }, 500);
    }
  },
};
