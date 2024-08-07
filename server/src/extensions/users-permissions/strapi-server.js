const bcrypt = require('bcryptjs');

module.exports = (plugin) => {
    const sanitizeUser = (user) => {
        const { password, resetPasswordToken, confirmationToken, ...sanitizedUser } = user;
        return sanitizedUser;
    };
    plugin.controllers.auth.register = async (ctx) => {
        const { email, password, username, fullName, isTutor } = ctx.request.body;

        // Check if user already exists
        const userExists = await strapi.query('plugin::users-permissions.user').findOne({ where: { email } });
        if (userExists) {
            return ctx.badRequest('Email is already taken');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

        // Create user
        const user = await strapi.query('plugin::users-permissions.user').create({
            data: {
                fullName,
                email,
                isTutor,
                password: hashedPassword,
                username,
                uuid: ctx.request.body.uuid,
                otp,
                confirmed: false,
            },
        });

        // Send OTP email
        await strapi.service('api::email.email').sendOTPEmail(email, otp);

        return ctx.send({ message: 'User registered. Please verify your email with the OTP sent.', uuid: user.uuid, user: sanitizeUser(user) });
    };

    plugin.controllers.auth.callback = async (ctx) => {
        const provider = ctx.params.provider || 'local';
        const params = ctx.request.body;

        if (provider === 'local') {
            if (!params.identifier || !params.password) {
                return ctx.badRequest('Please provide your username or email, and your password.');
            }

            // Use lowercase for email comparison
            const identifier = params.identifier.toLowerCase();

            const user = await strapi.query('plugin::users-permissions.user').findOne({
                where: {
                    $or: [
                        { email: identifier },
                        { username: identifier }
                    ],
                },
            });

            if (!user) {
                return ctx.badRequest('Identifier or password invalid');
            }

            if (!user.password) {
                return ctx.badRequest('Invalid password');
            }

            const validPassword = await bcrypt.compare(params.password, user.password);

            if (!validPassword) {
                return ctx.badRequest('Identifier or password invalid');
            }

            if (!user.confirmed) {
                return ctx.badRequest('Your account email is not confirmed');
            }

            // Generate OTP for login
            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

            // Save OTP to user
            await strapi.query('plugin::users-permissions.user').update({
                where: { id: user.id },
                data: { otp },
            });

            // Send OTP email
            await strapi.service('api::email.email').sendOTPEmail(user.email, otp);

            return ctx.send({
                message: 'OTP sent to your email. Please verify to complete login.',
                uuid: user.uuid
            });
        }

        // Handle other providers here if needed
        return ctx.badRequest('Invalid provider');
    };

    plugin.routes['content-api'].routes.push({
        method: 'POST',
        path: '/auth/verify-otp',
        handler: 'auth.verifyOTP',
        config: {
            policies: [],
            prefix: '',
        },
    });

    plugin.controllers.auth.verifyOTP = async (ctx) => {
        const { uuid, otp } = ctx.request.body;

        const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { uuid } });

        if (!user) {
            return ctx.badRequest('User not found');
        }

        if (user.otp !== otp) {
            return ctx.badRequest('Invalid OTP');
        }

        const authenticatedRole = await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: 'authenticated' } });

        if (!authenticatedRole) {
            return ctx.serverError('Authenticated role not found');
        }

        await strapi.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: {
                confirmed: true,
                otp: null,
                role: authenticatedRole.id
            },
        });

        // Generate JWT token
        const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
            id: user.id,
        });

        return ctx.send({
            message: 'Email verified successfully',
            jwt,
            user: sanitizeUser(user)
        });
    };

    return plugin;
};