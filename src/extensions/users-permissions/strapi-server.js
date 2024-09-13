const { default: axios } = require('axios');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = (plugin) => {
    const sanitizeUser = (user) => {
        const { password, resetPasswordToken, confirmationToken, otp, ...sanitizedUser } = user;
        return sanitizedUser;
    };
    plugin.controllers.auth.register = async (ctx) => {
        const { email, password, username, fullName, role } = ctx.request.body;

        // Check if user already exists
        const userExists = await strapi.query('plugin::users-permissions.user').findOne({ where: { email } });
        if (userExists) {
            return ctx.badRequest('Email is already taken');
        }

        // Validate role
        if (role !== 'student' && role !== 'tutor') {
            return ctx.badRequest('Invalid role. Must be either "student" or "tutor"');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

        // Find the role ID based on the role name
        const roleEntity = await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: role } });

        if (!roleEntity) {
            return ctx.badRequest(`Role "${role}" not found`);
        }

        // Create user
        const user = await strapi.query('plugin::users-permissions.user').create({
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
                populate: ['role', 'fav_topics', 'avatar', 'onBoarded', 'enrollments.course_plan.ib_programs'],
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
            const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
                id: user.id,
            });
            return ctx.send({
                jwt,
                message: 'Login successful!',
                user: sanitizeUser(user),
            });
        }
        if (provider === 'google') {
            const { access_token } = ctx.query;

            if (!access_token) {
                return ctx.badRequest('No access token provided');
            }

            try {
                // Verify the token and get user info from Google
                const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
                console.log(response.data);
                const { email, name, sub: googleId } = response.data;

                // Check if the user exists
                let user = await strapi.query('plugin::users-permissions.user').findOne({ where: { email } });

                if (!user) {
                    // If the user doesn't exist, create a new one
                    const role = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });

                    const uuid = crypto.randomUUID();

                    user = await strapi.query('plugin::users-permissions.user').create({
                        data: {
                            username: email,
                            email,
                            fullName: email,
                            provider: 'google',
                            googleId,
                            role: role.id,
                            uuid,
                            confirmed: true,
                            avatar: {
                                url: response.data.picture,
                            }
                        },
                    });
                }

                // Generate JWT token
                const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
                    id: user.id,
                });

                return ctx.send({
                    jwt,
                    user: sanitizeUser(user),
                });
            } catch (error) {
                console.error('Google authentication error:', error);
                return ctx.badRequest('Failed to authenticate with Google');
            }
        }

        // Handle other providers here if needed
        return ctx.badRequest('Invalid provider');
    };

    // Verify OTP
    plugin.routes['content-api'].routes.push({
        method: 'POST',
        path: '/auth/verify-otp',
        handler: 'auth.verifyOTP',
        config: {
            policies: [],
            prefix: '',
        },
    });

    plugin.controllers.user.me = async (ctx) => {
        if (!ctx.state.user) {
            return ctx.unauthorized();
        }

        const { query } = ctx;
        let populateQuery = ['role'];

        if (query.populate) {
            if (query.populate === '*') {
                populateQuery = ['role', 'fav_topics', 'avatar', 'studying', 'teaching', 'enrollments']; // Populate all fields
            } else if (Array.isArray(query.populate)) {
                populateQuery = [...populateQuery, ...query.populate];
            } else if (typeof query.populate === 'string') {
                populateQuery.push(query.populate);
            }
        }

        const user = await strapi.entityService.findOne('plugin::users-permissions.user', ctx.state.user.id, {
            populate: populateQuery,
        });

        if (!user) {
            return ctx.notFound('User not found');
        }

        return ctx.send({
            user: sanitizeUser(user)
        });
    };

    plugin.controllers.auth.verifyOTP = async (ctx) => {
        const { uuid, otp } = ctx.request.body;

        const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { uuid }, populate: ['role', 'avatar', 'fav_topics'] });

        if (!user) {
            return ctx.badRequest('User not found');
        }

        if (user.otp !== otp) {
            return ctx.badRequest('Invalid OTP');
        }

        await strapi.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: {
                confirmed: true,
                otp: null,
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