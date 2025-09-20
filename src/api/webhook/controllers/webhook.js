"use strict";

module.exports = {
  async createFromWebhook(ctx) {
    try {
      // Check for API key in headers for security
      const apiKey = ctx.request.headers["x-api-key"];
      if (apiKey !== process.env.WEBHOOK_API_KEY) {
        return ctx.unauthorized("Invalid API key");
      }

      const { data } = ctx.request.body;

      // Validate required fields
      if (!data.email || !data.fullName) {
        return ctx.badRequest("Email and full name are required");
      }

      // Check if user already exists
      const existingUser = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email: data.email },
        });

      if (existingUser) {
        return ctx.conflict("User with this email already exists");
      }

      // Generate a random password for the user
      const generatedPassword =
        data.fullName + Math.random().toString(36).slice(-10);

      // Create the user with the extended schema
      const userData = {
        username: data.email.split("@")[0], // Use email prefix as username
        email: data.email,
        password: generatedPassword,
        confirmed: true, // Auto-confirm since created via admin
        blocked: false,
        fullName: data.fullName,
        phoneNumber: data.phone || "",
        schoolname: data.school || "",
        nationality: data.nationality || "",
        isCreateByAdmin: true, // Flag indicating created by admin
        role: 1, // Assuming 1 is the role ID for students
        // Add other fields from your schema as needed
        ...data,
      };

      // Create the user
      const user = await strapi.plugins["users-permissions"].services.user.add({
        ...userData,
      });

      // Send welcome email with login credentials
      try {
        await strapi.plugins["email"].services.email.send({
          to: data.email,
          subject: "Welcome to Our Platform!",
          html: `
            <h1>Welcome, ${data.fullName}!</h1>
            <p>Your student account has been successfully created.</p>
            <p>You can now access our platform using these credentials:</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Password:</strong> ${generatedPassword}</p>
            <p>We recommend changing your password after first login.</p>
            <p>Thank you for joining us!</p>
          `,
        });
      } catch (emailError) {
        strapi.log.error("Failed to send email:", emailError);
        // Continue even if email fails
      }

      // Return success response
      ctx.send({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
        },
        message: "User account created successfully",
      });
    } catch (error) {
      strapi.log.error("Webhook error:", error);
      return ctx.internalServerError("Failed to process webhook");
    }
  },
};
