"use strict";

module.exports = {
    routes: [
            {
                method: 'GET',
                path: '/lecture-feedbacks/pending-review',
                handler: 'lecture-feedback.pendingReview',
                config: {
                    policies: [],
                    middlewares: [],
                },
            },
        ],
};
