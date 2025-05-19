
module.exports = {
    async sendEmail(options) {
      const nodemailer = require('nodemailer');
  
      const transporter = nodemailer.createTransport({
        // @ts-ignore
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, 
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
      });
  
      const mailOptions = {
        from: '"Your Name" <your-email@example.com>',
        to: 'miranhamid2002@gmail.com', 
        subject: 'New Enquiry', 
        text: 'This is a test email.', 
        html: '<p>This is a test email.</p>', 
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
  