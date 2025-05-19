module.exports = {
  async sendEmailToAddress(ctx) {
    try {
      const emailService = strapi.plugins['email'].services.email;
      const emailData = ctx.request.body;

      // Validate required fields
      if (!emailData.to || !emailData.subject || !emailData.text) {
        ctx.throw(400, 'Missing required fields: to, subject, and text are required.');
      }

      // Pass the entire emailData (including from) to the service
      const result = await emailService.send(emailData);

      ctx.status = 200;
      ctx.body = { message: 'Email sent successfully.', result };
    } catch (err) {
      ctx.throw(500, err.message);
    }
  },
};