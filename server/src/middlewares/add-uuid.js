const { v4: uuidv4 } = require('uuid');

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        if (ctx.request.url === '/api/auth/local/register' || ctx.request.url === '/api/auth/local' && ctx.request.method === 'POST') {
            ctx.request.body.uuid = uuidv4();
            ctx.request.body.otp = Math.floor(100000 + Math.random() * 900000).toString();
            ctx.request.body.confirmed = false;
        }
        await next();
    };
};