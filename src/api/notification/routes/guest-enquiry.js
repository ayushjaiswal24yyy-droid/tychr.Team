'use strict';


module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/guest-enquiries',
            handler: 'guest-enquiry.createWithOTP',
            config: {
                policies: [],
                middlewares: []
            },
        },
        {
            method: 'POST',
            path: '/guest-enquiries/verify-otp',
            handler: 'guest-enquiry.verifyOTP',
            config: {
                policies: [],
                middlewares: []
            },
        },
    ],
};
