"use strict";

/**
 * enrollment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::enrollment.enrollment", () => ({
  async sendPaymentLink(ctx) {
    const { user, classroom, paymentLink } = ctx.request.body;
    // Fetch classroom details
    const classDetails = await strapi.entityService.findOne(
      "api::enrollment.enrollment",
      classroom,
      { populate: ["tutors", "days"] }
    );
    const userDetails = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: user } });

    // const userDetails = await strapi.entityService.findOne(
    //   "plugin::users-permissions.user",
    //   user
    // );
    console.log(classDetails);
   const formatTime = (timeStr) => {
     const [hours, minutes] = timeStr.split(":").map(Number);
     const amPm = hours >= 12 ? "PM" : "AM";
     const formattedHours = hours % 12 || 12; 
     return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${amPm}`;
   };

   const daysList = classDetails.days
     .map((day) => `<li>${day.days} at ${formatTime(day.startTime)}</li>`)
     .join("");
    if (!classDetails) {
      return ctx.send({ error: "Class not found" }, 404);
    }

    const emailContent = `
      <h2>Complete Your Enrollment - Payment Required</h2>
      <p>Dear ${userDetails.fullName},</p>
      <p>Thank you for your interest in enrolling in the following class:</p>
      <ul>
        <li><strong>Class Name:</strong> ${classDetails.classroom_name}</li>
        <li><strong>Tutor name:</strong> ${
          classDetails.tutors[0].fullName || "N/A"
        }</li>
        <li><strong>Duration:</strong> ${classDetails.duration} hours/class</li>
        <li><strong>Start Date:</strong> ${classDetails.startDate}</li>
        <li><strong>End Date:</strong> ${classDetails.endDate}</li>
        <li><strong>Days:</strong></li>
        <ul>${daysList}</ul>      </ul>
      <p>To secure your spot, please complete your payment by clicking the link below:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${paymentLink}" style="
          display: inline-block;
          background-color: #008CBA;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          font-size: 16px;
        ">Pay Now</a>
      </div>      
      <p>If you have any questions, feel free to reach out.</p>
      <p>Best regards,<br/>Tychr Team</p>
    `;

    await strapi.plugins["email"].services.email.send({
      to: userDetails.email,
      subject: `Payment Required for ${classDetails.classroom_name}`,
      html: emailContent,
    });

    ctx.send({ message: "Payment link email sent to the student!" });
  },
}));
