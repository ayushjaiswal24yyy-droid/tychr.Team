module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/phone-auth/authenticate',
            handler: 'phone-auth.authenticateByPhone',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};