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

// Validate phone number format
const validatePhoneNumber = (phoneNumber) => {
  // AWS SNS requires E.164 format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

module.exports = createCoreController(
  'api::notification.notification',
  ({ strapi }) => ({
    async createWithOTP(ctx) {
      const data = ctx.request.body?.data;
      
      strapi.log.info("Incoming guest enquiry", data);

      if (!data?.parent_phonenumber) {
        return ctx.badRequest('Parent phone number required');
      }

      // Validate phone number format
      if (!validatePhoneNumber(data.parent_phonenumber)) {
        return ctx.badRequest('Invalid phone number format. Use E.164 format: +[country code][number]');
      }

      // Check for recent unverified enquiries (prevent spam)
      const recentEnquiry = await strapi.db
        .query('api::notification.notification')
        .findOne({
          where: {
            parent_phonenumber: data.parent_phonenumber,
            isVerified: false,
            createdAt: {
              $gt: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
            }
          },
          orderBy: { createdAt: 'desc' }
        });

      if (recentEnquiry) {
        return ctx.badRequest('An OTP was recently sent. Please wait before requesting a new one.');
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000);
      const hashedOtp = await bcrypt.hash(String(otp), 10);
      
      // Set OTP expiration (10 minutes)
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      try {
        // Send SMS first
        await sendSMS(
          data.parent_phonenumber,
          `Your verification OTP is ${otp}. Valid for 10 minutes.`
        );

        // Only create enquiry if SMS sent successfully
        const enquiry = await strapi.db
          .query('api::notification.notification')
          .create({
            data: {
              ...data,
              otp: hashedOtp,
              otpExpiry: otpExpiry,
              isVerified: false,
              otpAttempts: 0,
            },
          });

        return ctx.send({
          data: { enquiryId: enquiry.id },
        });
      } catch (error) {
        strapi.log.error('Failed to send OTP SMS:', error);
        return ctx.internalServerError('Failed to send verification code. Please try again.');
      }
    },

    async verifyOTP(ctx) {
      const { enquiryId, otp } = ctx.request.body;

      if (!enquiryId || !otp) {
        return ctx.badRequest('Invalid request');
      }

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

      // Check attempt limit (prevent brute force)
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
    },
  })
);