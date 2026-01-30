'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION,
});

const sns = new AWS.SNS();

const sendSMS = async (phoneNumber, message) => {
  await sns.publish({
    Message: message,
    PhoneNumber: phoneNumber,
  }).promise();
};

module.exports = createCoreController(
  'api::notification.notification',
  ({ strapi }) => ({
    async createWithOTP(ctx) {
      const data = ctx.request.body?.data;
      
      strapi.log.info("=== Incoming guest enquiry ===");
      strapi.log.info("Data received:", JSON.stringify(data, null, 2));

      if (!data?.parent_phonenumber) {
        return ctx.badRequest('Parent phone number required');
      }

      const otp = Math.floor(100000 + Math.random() * 900000);
      const hashedOtp = await bcrypt.hash(String(otp), 10);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      try {
        // Send SMS first
        strapi.log.info(`Sending OTP to: ${data.parent_phonenumber}`);
        await sendSMS(
          data.parent_phonenumber,
          `Your verification OTP is ${otp}. Valid for 10 minutes.`
        );
        strapi.log.info('SMS sent successfully');

        // Prepare data for database
        const dbData = {
          ...data,
          otp: hashedOtp,
          otpExpiry: otpExpiry,
          isVerified: false,
          otpAttempts: 0,
        };

        strapi.log.info("=== Creating enquiry in DB ===");
        strapi.log.info("DB Data:", JSON.stringify(dbData, null, 2));

        // Create enquiry
        const enquiry = await strapi.db
          .query('api::notification.notification')
          .create({
            data: dbData,
          });

        strapi.log.info("Enquiry created successfully:", enquiry.id);

        return ctx.send({
          data: { enquiryId: enquiry.id },
        });
      } catch (error) {
        strapi.log.error('=== ERROR in createWithOTP ===');
        strapi.log.error('Error name:', error.name);
        strapi.log.error('Error message:', error.message);
        strapi.log.error('Error stack:', error.stack);
        strapi.log.error('Full error:', JSON.stringify(error, null, 2));
        
        return ctx.internalServerError('Failed to send verification code. Please try again.');
      }
    },

    async verifyOTP(ctx) {
      const { enquiryId, otp } = ctx.request.body;

      strapi.log.info("=== Verifying OTP ===");
      strapi.log.info("Enquiry ID:", enquiryId);
      strapi.log.info("OTP:", otp);

      if (!enquiryId || !otp) {
        return ctx.badRequest('Invalid request');
      }

      try {
        const enquiry = await strapi.db
          .query('api::notification.notification')
          .findOne({ where: { id: enquiryId } });

        if (!enquiry) {
          return ctx.notFound('Enquiry not found');
        }

        if (enquiry.isVerified) {
          return ctx.send({ success: true });
        }

        // Check if OTP expired
        if (enquiry.otpExpiry && new Date() > new Date(enquiry.otpExpiry)) {
          return ctx.badRequest('OTP has expired. Please request a new one.');
        }

        // Check attempt limit
        if (enquiry.otpAttempts >= 5) {
          return ctx.badRequest('Too many failed attempts. Please request a new OTP.');
        }

        const isValid = await bcrypt.compare(String(otp), enquiry.otp);

        if (!isValid) {
          // Increment failed attempts
          await strapi.db
            .query('api::notification.notification')
            .update({
              where: { id: enquiryId },
              data: {
                otpAttempts: enquiry.otpAttempts + 1,
              },
            });

          return ctx.badRequest('Invalid OTP');
        }

        // OTP is valid - verify and clear sensitive data
        await strapi.db
          .query('api::notification.notification')
          .update({
            where: { id: enquiryId },
            data: {
              isVerified: true,
              otp: null,
              otpExpiry: null,
              otpAttempts: 0,
            },
          });

        return ctx.send({ success: true });
      } catch (error) {
        strapi.log.error('=== ERROR in verifyOTP ===');
        strapi.log.error('Error:', error);
        return ctx.internalServerError('Failed to verify OTP');
      }
    },
  })
);