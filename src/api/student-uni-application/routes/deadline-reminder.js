module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/deadline-reminders/send',
      handler: 'deadline-reminder.send',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};