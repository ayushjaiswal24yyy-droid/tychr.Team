'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const sanitizeUser = (user) => {
    const { password, resetPasswordToken, confirmationToken, ...sanitizedUser } = user;
    return sanitizedUser;
};

const generateRandomPassword = () => {
    return crypto.randomBytes(20).toString('hex');
};

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

module.exports = {
    async authenticateByPhone(ctx) {
        const { phone, role } = ctx.request.body;

        if (!phone) {
            return ctx.badRequest('Phone number is required');
        }

        // Check if user exists
        let user = await strapi.query('plugin::users-permissions.user').findOne({ where: { username: phone } });

        if (!user) {
            // If user doesn't exist, create a new one
            const userRole = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });

            const randomPassword = generateRandomPassword();
            const hashedPassword = await hashPassword(randomPassword);

            const uuid = crypto.randomUUID();

            user = await strapi.query('plugin::users-permissions.user').create({
                data: {
                    username: phone,
                    email: `${phone}@example.com`, // You might want to handle this differently
                    phoneNumber: phone,
                    password: hashedPassword,
                    isTutor: role,
                    provider: 'local',
                    confirmed: true,
                    role: userRole.id,
                    uuid,
                }
            });

            console.log('New user created:', user);
        }

        // Generate JWT token
        const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
            id: user.id,
        });

        return ctx.send({
            jwt,
            user: sanitizeUser(user),
        });
    },
};