module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/courses/trending',
            handler: 'course.getTrendingCourses',
            config: {
                policies: [],
                middlewares: []
            }
        },
        {
            method: 'GET',
            path: '/courses/popular',
            handler: 'course.getPopularCourses',
            config: {
                policies: [],
                middlewares: []
            }
        },
        {
            method: 'GET',
            path: '/courses/enrolled/:userId',
            handler: 'course.getEnrolledCourses',
            config: {
                policies: [],
                middlewares: [],
            }
        },
    ]
};