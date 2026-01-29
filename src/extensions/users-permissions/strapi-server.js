const { default: axios } = require("axios");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION
});


const sns = new AWS.SNS();
const sendSMS = async (phoneNumber, message) => {
  const params = {
    Message: message,
    PhoneNumber: phoneNumber,
  };

  try {
    await sns.publish(params).promise();
    console.log("SMS sent successfully");
  } catch (err) {
    console.error("Error sending SMS:", err);
    throw err;
  }
};

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
  const createNotificationForUser = async (user, ctx) => {
    try {
      // Extract notification data from request body
      const {
        parent_name,
        parent_phonenumber,
        preferred_classroom_time,
        comment,
        student_plan,
        grade_subject,
        enquiry_type,
        classroom_limit,
        classroom_type,
        parent_location,
      } = ctx.request.body;

      // Create notification entry
      const notification = await strapi.entityService.create(
        "api::notification.notification",
        {
          data: {
            user: user.id,
            status: "Pending",
            tracking_status: "New Lead",
            parent_name: parent_name || "",
            parent_phonenumber: parent_phonenumber || "",
            preferred_classroom_time: preferred_classroom_time || "Evening",
            comment: comment || "",
            student_plan: student_plan || null,
            // grade_subject: grade_subject || null,
            // enquiry_type: enquiry_type || "Classroom",
            classroom_limit: classroom_limit || "online",
            classroom_type: classroom_type || "Online",
            parent_location: parent_location || "",
            publishedAt: new Date(),
          },
          populate: ["user", "student_plan", "grade_subject"],
        }
      );

      // Send notification email to user
      await strapi.plugins["email"].services.email.send({
        to: user.email,
        from: "tychr@saralgroups.com",
        subject: " Registration - TyChr",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .footer { padding: 20px; text-align: center; color: #777; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to TyChr!</h1>
              </div>
              <div class="content">
                <p>Hello ${user.fullName || "there"},</p>
                <p>Thank you for registering as a lead with TyChr. Your enquiry has been received and our team will contact you shortly.</p>
                <p><strong>Enquiry Details:</strong></p>
                <ul>
                  <li>Email: ${user.email}</li>
                  <li>Password: ${user.password}</li>
                  ${parent_name ? `<li>Parent Name: ${parent_name}</li>` : ""}
                  ${parent_phonenumber
            ? `<li>Phone: ${parent_phonenumber}</li>`
            : ""
          }
                  ${enquiry_type ? `<li>Enquiry Type: ${enquiry_type}</li>` : ""
          }
                </ul>
                <p>We'll be in touch within 24 hours to discuss your requirements.</p>
              </div>
              <div class="footer">
                <p>Best regards,<br>TyChr Team</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      // Send admin notification
      await strapi.plugins["email"].services.email.send({
        to: "it@tychr.com", // Admin email
        from: "tychr@saralgroups.com",
        subject: `New Lead Registration: ${user.email}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .footer { padding: 20px; text-align: center; color: #777; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Lead Alert!</h1>
              </div>
              <div class="content">
                <p><strong>New lead registration received:</strong></p>
                <ul>
                  <li>Name: ${user.fullName || "N/A"}</li>
                  <li>Email: ${user.email}</li>
                  <li>Role: ${user.role?.type || "Lead"}</li>
                  ${parent_name ? `<li>Parent Name: ${parent_name}</li>` : ""}
                  ${parent_phonenumber
            ? `<li>Phone: ${parent_phonenumber}</li>`
            : ""
          }
                  ${enquiry_type ? `<li>Enquiry Type: ${enquiry_type}</li>` : ""
          }
                  <li>Registration Time: ${new Date().toLocaleString()}</li>
                </ul>
                <p><strong>Action Required:</strong> Please follow up with this lead within 24 hours.</p>
              </div>
              <div class="footer">
                <p>This is an automated notification from TyChr System</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      // Don't throw error here to avoid breaking the registration flow
    }
  };

  plugin.controllers.auth.register = async (ctx) => {
    const {
      email,
      password,
      username,
      fullName,
      role,
      phoneNumber,
      tutor_role,
      countryCode
    } = ctx.request.body;

    // Check if user already exists
    const userExists = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } });
    if (userExists) {
      return ctx.badRequest("Email is already taken");
    }

    // Check if phoneNumber already exists (if provided)
    if (phoneNumber) {
      const phoneExists = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { phoneNumber } });
      if (phoneExists) {
        return ctx.badRequest("Phone number is already taken");
      }
    }

    // Validate role
    const allowedRoles = ["student", "tutor", "assistant", "third_party_user"];
    if (!allowedRoles.includes(role)) {
      return ctx.badRequest(
        'Invalid role. Must be either "student", "tutor", "assistant", or "third_party_user"'
      );
    }

    // Additional validation for tutor role
    if (role === "tutor") {
      if (!tutor_role || !["tutor", "buddy", "mentor"].includes(tutor_role)) {
        return ctx.badRequest(
          'Tutor must have a valid tutor_role: "tutor", "buddy", or "mentor"'
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Find the role ID based on the role name
    const roleEntity = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: role } });

    if (!roleEntity) {
      return ctx.badRequest(`Role "${role}" not found`);
    }

    const uuid = crypto.randomUUID();

    // Prepare user data based on schema
    const userData = {
      fullName,
      email,
      role: roleEntity.id,
      password: hashedPassword,
      username: username || email.toLowerCase(),
      uuid,
      otp,
      countryCode,
      confirmed: false,
      phoneNumber: phoneNumber || null,
    };
const formattedPhoneNumber = `${countryCode}${phoneNumber}`;

    // Add role-specific fields
    if (role === "tutor") {
      userData.tutor_role = tutor_role;
      userData.tutor_status = "Pending"; // Default status
    }

    // Create user
    const user = await strapi.query("plugin::users-permissions.user").create({
      data: userData,
    });

    // Send email based on role
    // if (role === "assistant" || role === "coach") {
    //   await strapi
    //     .plugin("email")
    //     .service("email")
    //     .send({
    //       to: email,
    //       from: "tychr@saralgroups.com",
    //       subject: "Your Assistant Account Information",
    //       text: `Your account has been created. Here are your login details:\n\nEmail: ${email}\nPassword: ${password}\n\nPlease make sure to change your password after logging in.`,
    //     });
    // } else {
    //   try {
    //     await strapi
    //       .service("api::email.email")
    //       .sendEmailBasedOnRole(email, otp);
    //   } catch (emailError) {
    //     console.error("Email sending failed:", emailError);
    //     // Don't fail registration if email fails
    //   }
    // }
    try {
      await sendSMS(
        formattedPhoneNumber,
        `Your Tychr OTP is ${otp}. It is valid for 10 minutes.`
      );
    } catch (error) {
      console.error("SMS sending failed:", error);
    }

    // Check if type=leads query parameter is present
    const isLeadRegistration = ctx.query.type === "leads";

    if (isLeadRegistration) {
      // Create notification and send emails for lead registration
      await createNotificationForUser(user, ctx);
    }

    const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });

    return ctx.send({
      message: isLeadRegistration
        ? "Lead registered successfully. Our team will contact you shortly."
        : "User registered. Please verify your phone with the OTP sent.",
      uuid: user.uuid,
      jwt,
      user: sanitizeUser(user),
      isLead: isLeadRegistration,
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

      const identifier = params.identifier.toLowerCase();

      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            $or: [{ email: identifier }, { username: identifier }],
          },
          populate: {
            role: true,
            fav_topics: true,
            avatar: true,
            ib_program: true,
            studying: true,
            grade: {
              populate: {
                ib_programs: true,
              },
            },
            enrolled_in: true,
            tutor_plan: true,
            student_plan: true,
          },
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
  // Verify OTP
1
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
      populate: {
        role: true,
        fav_topics: true,
        avatar: true,
        ib_program: true,
        studying: true,
        grade: {
          populate: {
            ib_programs: true,
          },
        },
        enrolled_in: true,
        tutor_plan: true,
        student_plan: true,
      },
    });

    if (!user) {
      return ctx.badRequest("User not found");
    }

    if (user.otp !== otp) {
      return ctx.badRequest("Invalid OTP");
    }

    await strapi.query("plugin::users-permissions.user").update({
      where: { id: user.id },
      data: {
        confirmed: true,
        otp: null,
      },
    });

    const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });

    return ctx.send({
      message: "Email verified successfully",
      jwt,
      user: sanitizeUser(user),
    });
  };
  plugin.controllers.auth.verifyOTP_v2 = async (ctx) => {
    const { uuid, otp, type } = ctx.request.body;

    if (!uuid || !otp || !type) {
      return ctx.badRequest("uuid, otp and type are required");
    }

    if (!["phone", "email"].includes(type)) {
      return ctx.badRequest("Invalid verification type");
    }

    const user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({
        where: { uuid },
        populate: {
          role: true,
          fav_topics: true,
          avatar: true,
          ib_program: true,
          studying: true,
          grade: {
            populate: {
              ib_programs: true,
            },
          },
          enrolled_in: true,
          tutor_plan: true,
          student_plan: true,
        },
      });

    if (!user) {
      return ctx.badRequest("User not found");
    }

    if (!user.otp || user.otp !== otp) {
      return ctx.badRequest("Invalid OTP");
    }

    // 🔥 Build update payload safely
    const updateData = {
      otp: null,
    };

    if (type === "phone") {
      updateData.isPhoneVerified = true;
    }

    if (type === "email") {
      updateData.isEmailVerified = true;
    }

    // confirmed = true if ANY verification succeeds
    updateData.confirmed = true;

    await strapi
      .query("plugin::users-permissions.user")
      .update({
        where: { id: user.id },
        data: updateData,
      });

    const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });

    return ctx.send({
      message:
        type === "phone"
          ? "Phone number verified successfully"
          : "Email verified successfully",
      jwt,
      user: sanitizeUser(user),
    });
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
    if (!files && !files.cv && !files.avatar && !files.tutor_video) {
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
      if (files.tutor_video) {
        const uploadedtutor_video =
          await strapi.plugins.upload.services.upload.upload({
            data: {},
            files: files.tutor_video,
          });
        updateData.tutor_video = uploadedtutor_video[0].id;
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
            "tutor_video",
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

  plugin.controllers.user.updateFilesAdmin = async (ctx) => {
    const { id } = ctx.params;

    if (!ctx.state.user) {
      return ctx.unauthorized("You must be logged in to update the profile");
    }

    const { files } = ctx.request;
    if (!files || (!files.cv && !files.avatar && !files.tutor_video)) {
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
      if (files.tutor_video) {
        const uploadedTutorVideo =
          await strapi.plugins.upload.services.upload.upload({
            data: {},
            files: files.tutor_video,
          });
        updateData.tutor_video = uploadedTutorVideo[0].id;
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
            "tutor_video",
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

  plugin.controllers.user.sendTutorEmail = async (ctx) => {
    const { email } = ctx.request.body;
    try {
      const tutorHtmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Tutor Application Notification from TyChr</title>
                        <style>
                            body {
                                font-family: 'Arial', sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                            }
                            .container {
                                background-color: #f9f9f9;
                                border-radius: 5px;
                                padding: 30px;
                                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                            }
                            h1 {
                                color: #2c3e50;
                                font-size: 24px;
                                margin-bottom: 20px;
                            }
                            p {
                                margin-bottom: 15px;
                            }
                            .footer {
                                margin-top: 30px;
                                font-size: 12px;
                                color: #7f8c8d;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Application Received!</h1>
                            <p>Hello,</p>
                            <p>Thank you for applying to be a tutor with TyChr. We are currently reviewing your application and will notify you once it has been approved.</p>
                            <p>If you have any questions, please feel free to reach out to us.</p>
                            <div class="footer">
                                <p>This is an automated message, please do not reply to this email.</p>
                                <p>&copy; 2024 TyChr. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

      await strapi.plugins["email"].services.email.send({
        to: email,
        from: "tychr@saralgroups.com",
        subject: "Tutor Application Status from TyChr",
        html: tutorHtmlContent,
      });

      const adminHtmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>New Tutor Application Notification</title>
                        <style>
                            body {
                                font-family: 'Arial', sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                            }
                            .container {
                                background-color: #f9f9f9;
                                border-radius: 5px;
                                padding: 30px;
                                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                            }
                            h1 {
                                color: #2c3e50;
                                font-size: 24px;
                                margin-bottom: 20px;
                            }
                            p {
                                margin-bottom: 15px;
                            }
                            .footer {
                                margin-top: 30px;
                                font-size: 12px;
                                color: #7f8c8d;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>New Tutor Application Received!</h1>
                            <p>Hello Admin,</p>
                            <p>A new tutor has applied to join TyChr. Please review their application at your earliest convenience.</p>
                            <ul>
                                <li><strong>Email:</strong> ${email}</li>
                                <li><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</li>
                            </ul>        
                             <p class="action-needed">Action Needed:</p>
                        <ul>
                            <li>Review tutor's credentials and background</li>
                            <li>Update tutor's status in the admin panel</li>
                        </ul>                   
                             <div class="footer">
                                <p>This is an automated message, please do not reply to this email.</p>
                                <p>&copy; 2024 TyChr. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

      await strapi.plugins["email"].services.email.send({
        to: "it@tychr.com",
        from: "tychr@saralgroups.com",
        subject: "New Tutor Application Notification",
        html: adminHtmlContent,
      });
      return ctx.send({
        message: "email sent successfully",
      });
    } catch (error) {
      console.log(error);
      return ctx.badRequest("Failed to send email", { error: error.message });
    }
  };
plugin.controllers.auth.getOtpTarget = async (ctx) => {
  const { uuid } = ctx.query;

  if (!uuid) {
    return ctx.badRequest("UUID is required");
  }

  const user = await strapi
    .query("plugin::users-permissions.user")
    .findOne({
      where: { uuid },
      select: ["email", "phoneNumber", "countryCode"],
    });

  if (!user) {
    return ctx.notFound("User not found");
  }

  return ctx.send({
    email: user.email,
    phoneNumber: user.phoneNumber,
    countryCode: user.countryCode,
  });
};

plugin.controllers.auth.sendEmailOtp = async (ctx) => {
  const { uuid } = ctx.request.body;

  if (!uuid) {
    return ctx.badRequest("UUID is required");
  }

  const user = await strapi
    .query("plugin::users-permissions.user")
    .findOne({
      where: { uuid },
    });

  if (!user) {
    return ctx.badRequest("User not found");
  }

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP
  await strapi
    .query("plugin::users-permissions.user")
    .update({
      where: { id: user.id },
      data: { otp },
    });

  // ✅ Reuse existing email service
  try {
    await strapi
      .service("api::email.email")
      .sendEmailBasedOnRole(user.email, otp);
  } catch (emailError) {
    console.error("Email sending failed:", emailError);
    return ctx.internalServerError("Failed to send email OTP");
  }

  return ctx.send({
    message: "OTP sent to your registered email address",
  });
};


plugin.routes["content-api"].routes.push({
  method: "POST",
  path: "/auth/send-email-otp",
  handler: "auth.sendEmailOtp",
  config: {
    auth: false,
    policies: [],
    prefix: "",
  },
});

  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/user/me/sendmail",
    handler: "user.sendTutorEmail",
    config: {
      policies: [],
      prefix: "",
    },
  });

  plugin.routes["content-api"].routes.push({
    method: "PUT",
    path: "/user/me/files",
    handler: "user.updateFiles",
    config: {
      policies: [],
      prefix: "",
    },
  });
  plugin.routes["content-api"].routes.push({
    method: "PUT",
    path: "/user/:id/files",
    handler: "user.updateFilesAdmin",
    config: {
      policies: [],
      prefix: "",
    },
  });
plugin.routes["content-api"].routes.push({
  method: "GET",
  path: "/auth/otp-target",
  handler: "auth.getOtpTarget",
  config: {
    auth: false,
    policies: [],
    prefix: "",
  },
});

  return plugin;
};
