'use strict';


module.exports = {
    routes: [
        {
            method: "POST",
            path: "/premium-plans/create-order",
            handler: "premium-plan.createOrder",
            config: {

                policies: [],
                middlewares: [],
            },
        },
        {
            method: "POST",
            path: "/premium-plans/verify-payment",
            handler: "premium-plan.verifyPayment",
            config: {

                policies: [],
                middlewares: [],
            },
        },
    ],
}

