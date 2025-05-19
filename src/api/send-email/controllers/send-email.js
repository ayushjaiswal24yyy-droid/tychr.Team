

module.exports = {
  async sendEmailToAddress(ctx) {
    try {
      const emailService = strapi.plugins['email'].services.email;
      const emailData = ctx.request.body;
      await emailService.send(emailData);

      ctx.status = 200;
      ctx.body = { message: 'Email sent successfully.' };
    } catch (err) {
      ctx.throw(500, err.message);
    }
  },
};
