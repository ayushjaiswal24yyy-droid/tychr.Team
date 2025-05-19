module.exports = {
  async sendEmail(options) {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      // Explicitly specify the transport type as SMTP
      // and ensure types match nodemailer typings
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Use the `from` field from options, fallback to a default if not provided
    const mailOptions = {
      from: options.from || `"Transverse Default" <${process.env.SMTP_USERNAME}>`, // Fallback to SMTP_USERNAME
      to: options.to || 'miranhamid2002@gmail.com', // Fallback to your email
      subject: options.subject || 'New Enquiry',
      text: options.text || 'This is a test email.',
      html: options.html || '<p>This is a test email.</p>',
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error);
        } else {
          resolve(info);
        }
      });
    });
  },
};