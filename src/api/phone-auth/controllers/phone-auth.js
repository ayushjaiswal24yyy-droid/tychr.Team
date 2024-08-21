'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');

const sanitizeUser = (user) => {
    const { password, resetPasswordToken, confirmationToken, ...sanitizedUser } = user;
    return sanitizedUser;
};

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
    region: process.env.AWS_REGION
});

const sns = new AWS.SNS();

// const generateRandomPassword = () => {
//     return crypto.randomBytes(20).toString('hex');
// };

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const sendSMS = async (phoneNumber, message) => {
    const params = {
        Message: message,
        PhoneNumber: phoneNumber
    };

    try {
        await sns.publish(params).promise();
        console.log(`SMS sent to ${phoneNumber}`);
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw error;
    }
};

module.exports = {
    async authenticateByPhone(ctx) {
        const { phone, role } = ctx.request.body;

        if (!phone) {
            return ctx.badRequest('Phone number is required');
        }

        // Check if user exists
        let user = await strapi.query('plugin::users-permissions.user').findOne({ where: { username: phone } });

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

        if (!user) {
            // If user doesn't exist, create a new one
            const roleEntity = await strapi
                .query('plugin::users-permissions.role')
                .findOne({ where: { type: role } });

            if (!roleEntity) {
                return ctx.badRequest(`Role "${role}" not found`);
            }

            // const randomPassword = phone;
            const hashedPassword = await hashPassword(phone);

            const uuid = crypto.randomUUID();


            user = await strapi.query('plugin::users-permissions.user').create({
                data: {
                    fullName: phone,
                    username: phone,
                    email: `${phone}@example.com`, // You might want to handle this differently
                    phoneNumber: phone,
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
            await sendSMS(phone, `Your OTP is: ${otp}`);
        } catch (error) {
            return ctx.badRequest('Failed to send OTP');
        }

        return ctx.send({
            message: 'OTP sent successfully',
            uuid: user.uuid,
        });
    },
};