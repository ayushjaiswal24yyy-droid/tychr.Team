'use strict';

const AWS = require('aws-sdk');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Create an SNS client
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
    region: process.env.AWS_REGION
});

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

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


module.exports = {
    async authenticateByPhone(ctx) {
        const { phoneNumber, role } = ctx.request.body;

        if (!phoneNumber) {
            return ctx.badRequest('Phone number is required');
        }

        // Check if user exists
        let user = await strapi.query('plugin::users-permissions.user').findOne({ where: { username: phoneNumber } });

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

        if (!user) {
            // If user doesn't exist, create a new one
            const roleEntity = await strapi
                .query('plugin::users-permissions.role')
                .findOne({ where: { type: role } });

            if (!roleEntity) {
                return ctx.badRequest(`Role "${role}" not found`);
            }

            const hashedPassword = await hashPassword(phoneNumber);

            const uuid = crypto.randomUUID();


            user = await strapi.query('plugin::users-permissions.user').create({
                data: {
                    fullName: phoneNumber,
                    username: phoneNumber,
                    email: `${phoneNumber}@example.com`, // You might want to handle this differently
                    phoneNumber: phoneNumber,
                    password: hashedPassword,
                    confirmed: false,
                    role: roleEntity.id,
                    uuid,
                    otp,
                }
            });

            console.log('New user created:', user);
        } else {
            // Login flow: Update the user's OTP
            await strapi.query('plugin::users-permissions.user').update({
                where: { id: user.id },
                data: { otp: otp },
            });
        }

        try {
            await sendSMS(phoneNumber, `Hey there! Your TyChr OTP is: ${otp}`);
        } catch (error) {
            return ctx.badRequest('Failed to send OTP');
        }

        return ctx.send({
            message: 'OTP sent successfully',
            uuid: user.uuid,
        });
    },
};