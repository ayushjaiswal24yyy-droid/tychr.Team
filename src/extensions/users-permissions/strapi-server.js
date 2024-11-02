const { default: axios } = require("axios");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

module.exports = (plugin) => {
  const sanitizeUser = (user) => {
    const {
      password,
      resetPasswordToken,
      confirmationToken,
      otp,
      ...sanitizedUser
    } = user;
    return sanitizedUser;
  };
  plugin.controllers.auth.register = async (ctx) => {
    const { email, password, username, fullName, role } = ctx.request.body;

    // Check if user already exists
    const userExists = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } });
    if (userExists) {
      return ctx.badRequest("Email is already taken");
    }

    // Validate role
    if (role !== "student" && role !== "tutor") {
      return ctx.badRequest(
        'Invalid role. Must be either "student" or "tutor"'
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    // Find the role ID based on the role name
    const roleEntity = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: role } });

    if (!roleEntity) {
      return ctx.badRequest(`Role "${role}" not found`);
    }

    // Create user
    const user = await strapi.query("plugin::users-permissions.user").create({
      data: {
        fullName,
        email,
        role: roleEntity.id,
        password: hashedPassword,
        username,
        uuid: ctx.request.body.uuid,
        otp,
        confirmed: false,
      },
    });

    await strapi
      .service("api::email.email")
      .sendEmailBasedOnRole(email, otp, role);
    const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });
    return ctx.send({
      message: "User registered. Please verify your email with the OTP sent.",
      uuid: user.uuid,
      jwt,
      user: sanitizeUser(user),
    });
  };

  plugin.controllers.auth.callback = async (ctx) => {
    const provider = ctx.params.provider || "local";
    const params = ctx.request.body;

    if (provider === "local") {
      if (!params.identifier || !params.password) {
        return ctx.badRequest(
          "Please provide your username or email, and your password."
        );
      }

      // Use lowercase for email comparison
      const identifier = params.identifier.toLowerCase();

      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            $or: [{ email: identifier }, { username: identifier }],
          },
          populate: [
            "role",
            "fav_topics",
            "avatar",
            "onBoarded",
            "ib_program",
            "studying",
            "grade",
            "enrolled_in",
            "tutor_plan",
            "student_plan",
          ],
        });

      if (!user) {
        return ctx.badRequest("Identifier or password invalid");
      }

      if (user.blocked) {
        return ctx.forbidden(
          "Your account has been blocked. Please contact administrators for assistance."
        );
      }

      if (!user.password) {
        return ctx.badRequest("Invalid password");
      }

      const validPassword = await bcrypt.compare(
        params.password,
        user.password
      );

      if (!validPassword) {
        return ctx.badRequest("Identifier or password invalid");
      }

      if (!user.confirmed) {
        return ctx.badRequest("Your account email is not confirmed");
      }

      // Generate OTP for login
      // const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

      // Save OTP to user
      // await strapi.query('plugin::users-permissions.user').update({
      //     where: { id: user.id },
      //     data: { otp },
      // });

      // Send OTP email
      // await strapi.service('api::email.email').sendOTPEmail(user.email, otp);

      // return ctx.send({
      //     message: 'OTP sent to your email. Please verify to complete login.',
      //     uuid: user.uuid
      // });
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });
      return ctx.send({
        jwt,
        message: "Login successful!",
        user: sanitizeUser(user),
      });
    }
    if (provider === "google") {
      const { access_token } = ctx.query;

      if (!access_token) {
        return ctx.badRequest("No access token provided");
      }

      try {
        // Verify the token and get user info from Google
        const response = await axios.get(
          `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`
        );
        console.log(response.data);
        const {
          email,
          name,
          given_name,
          family_name,
          sub: googleId,
          picture,
        } = response.data;

        // Check if the user exists
        let user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email } });

        if (user && user.blocked) {
          return ctx.forbidden(
            "Your account has been blocked. Please contact administrators for assistance."
          );
        }

        const uuid = crypto.randomUUID();

        if (!user) {
          // If the user doesn't exist, create a new one
          const role = await strapi
            .query("plugin::users-permissions.role")
            .findOne({ where: { type: "authenticated" } });

          const imageResponse = await axios.get(picture, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(imageResponse.data, "binary");

          const avatarFile = await strapi.plugins.upload.services.upload.upload(
            {
              data: {},
              files: {
                path: buffer,
                name: `${uuid}_avatar.jpg`,
                type: "image/jpeg",
                size: buffer.length,
              },
            }
          );

          user = await strapi.query("plugin::users-permissions.user").create({
            data: {
              username: email,
              email,
              fullName: name || `${given_name} ${family_name}`.trim(),
              provider: "google",
              googleId,
              role: role.id,
              uuid,
              confirmed: true,
              avatar: avatarFile[0].id,
            },
          });
        } else {
          const imageResponse = await axios.get(picture, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(imageResponse.data, "binary");

          const avatarFile = await strapi.plugins.upload.services.upload.upload(
            {
              data: {},
              files: {
                path: buffer,
                name: `${uuid}_avatar.jpg`,
                type: "image/jpeg",
                size: buffer.length,
              },
            }
          );

          user = await strapi.query("plugin::users-permissions.user").update({
            where: { id: user.id },
            data: {
              fullName: name || `${given_name} ${family_name}`.trim(),
              googleId,
              provider: "google",
              avatar: avatarFile[0].id,
            },
          });
        }

        // Generate JWT token
        const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
          id: user.id,
        });

        return ctx.send({
          jwt,
          user: sanitizeUser(user),
        });
      } catch (error) {
        console.error("Google authentication error:", error);
        return ctx.badRequest("Failed to authenticate with Google");
      }
    }

    // Handle other providers here if needed
    return ctx.badRequest("Invalid provider");
  };

  // Verify OTP
  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/auth/verify-otp",
    handler: "auth.verifyOTP",
    config: {
      policies: [],
      prefix: "",
    },
  });

  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const { query } = ctx;
    let populateQuery = ["role"];

    if (query.populate) {
      if (query.populate === "*") {
        populateQuery = [
          "role",
          "fav_topics",
          "avatar",
          "studying",
          "teaching",
          "enrollments",
          "onBoarded",
          "ib_program",
          "grade",
        ]; // Populate all fields
      } else if (Array.isArray(query.populate)) {
        populateQuery = [...populateQuery, ...query.populate];
      } else if (typeof query.populate === "string") {
        populateQuery.push(query.populate);
      }
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      ctx.state.user.id,
      {
        populate: populateQuery,
      }
    );

    if (!user) {
      return ctx.notFound("User not found");
    }

    return ctx.send({
      user: sanitizeUser(user),
    });
  };

  plugin.controllers.auth.verifyOTP = async (ctx) => {
    const { uuid, otp } = ctx.request.body;

    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: { uuid },
      populate: [
        "role",
        "fav_topics",
        "avatar",
        "onBoarded",
        "ib_program",
        "grade",
        "enrolled_in",
        "tutor_plan",
      ],
    });

    if (!user) {
      return ctx.badRequest("User not found");
    }

    if (user.otp !== otp) {
      return ctx.badRequest("Invalid OTP");
    }

    const isTutor = user.role.name === "Tutor";

    if (isTutor) {
      const htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333333;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background-color: #f8f9fa;
                        padding: 20px;
                        text-align: center;
                        border-radius: 5px;
                    }
                    .content {
                        margin-top: 20px;
                    }
                    .details {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 5px;
                        margin-top: 20px;
                    }
                    .action-needed {
                        color: #dc3545;
                        font-weight: bold;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #666666;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>New Tutor Registration - Action Required</h2>
                    </div>
                    <div class="content">
                        <p style="font-weight: bold;text-align: center;">A new tutor has registered on the Tychr platform and requires approval.</p>
                        
                        <div class="details">
                            <h3>Tutor Details:</h3>
                            <ul>
                                <li><strong>Name:</strong> ${user.fullName}</li>
                                <li><strong>Email:</strong> ${user.email}</li>
                                <li><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</li>
                            </ul>
                        </div>
    
                        <p class="action-needed">Action Needed:</p>
                        <ul>
                            <li>Review tutor's credentials and background</li>
                            <li>Initiate the onboarding process</li>
                            <li>Update tutor's status in the admin panel</li>
                        </ul>
    
                        <p>Please begin the onboarding process as soon as possible to ensure a smooth experience for our new tutor.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from the Tychr Registration System. If you have any questions, please contact the it@tychr.com or contact our support team.</p>
                    </div>
                </div>
            </body>
            </html>`;

      // For Tutors: Send email and return waiting message
      await strapi.plugins["email"].services.email.send({
        to: "it@tychr.com",
        cc: "contact@tychr.com",
        subject: "New Tutor Registration",
        text: `A new tutor (${user.fullName}, ${user.email}) has registered and needs approval. Please begin the onboarding process.`,
        html: htmlEmail,
      });

      // Update user to remove OTP but keep confirmed as false
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: {
          otp: null,
        },
      });

      return ctx.send({
        message:
          "Your registration is being processed. Our team will review your application and contact you soon.",
        // user: sanitizeUser(user)
      });
    } else {
      // For Students: Confirm registration and issue JWT
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: {
          confirmed: true,
          otp: null,
        },
      });

      // Generate JWT token
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      return ctx.send({
        message: "Email verified successfully",
        jwt,
        user: sanitizeUser(user),
      });
    }
  };

  plugin.controllers.user.updateMe = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized("You must be logged in to update your profile");
    }

    const { id } = ctx.state.user;
    const updateData = ctx.request.body;

    try {
      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        id,
        {
          data: updateData,
          populate: [
            "role",
            "fav_topics",
            "avatar",
            "onBoarded",
            "ib_program",
            "grade",
            "enrolled_in",
            "tutor_plan",
            "cv",
          ],
        }
      );

      return ctx.send({
        user: sanitizeUser(updatedUser),
      });
    } catch (error) {
      return ctx.badRequest("Failed to update user", { error: error.message });
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "PUT",
    path: "/user/me",
    handler: "user.updateMe",
    config: {
      policies: [],
      prefix: "",
    },
  });

  plugin.controllers.user.updateFiles = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized("You must be logged in to update your profile");
    }

    const { id } = ctx.state.user;
    const { files } = ctx.request;
    if (!files && !files.cv && !files.avatar) {
      return ctx.badRequest("No files found in the request");
    }

    try {
      const updateData = {};

      if (files.cv) {
        const uploadedCV = await strapi.plugins.upload.services.upload.upload({
          data: {},
          files: files.cv,
        });
        updateData.cv = uploadedCV[0].id;
      }

      if (files.avatar) {
        const uploadedAvatar =
          await strapi.plugins.upload.services.upload.upload({
            data: {},
            files: files.avatar,
          });
        updateData.avatar = uploadedAvatar[0].id;
      }

      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        id,
        {
          data: updateData,
          populate: [
            "role",
            "fav_topics",
            "avatar",
            "onBoarded",
            "ib_program",
            "grade",
            "enrolled_in",
            "tutor_plan",
            "cv",
          ],
        }
      );

      return ctx.send({
        message: "Files updated successfully",
        user: sanitizeUser(updatedUser),
      });
    } catch (error) {
      console.log(error);
      return ctx.badRequest("Failed to update files", { error: error.message });
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "PUT",
    path: "/user/me/files",
    handler: "user.updateFiles",
    config: {
      policies: [],
      prefix: "",
    },
  });

  return plugin;
};
