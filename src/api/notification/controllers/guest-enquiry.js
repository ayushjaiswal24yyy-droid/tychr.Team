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

  strapi.log.info("Incoming guest enquiry", data);
      if (!data?.parent_phonenumber) {
        return ctx.badRequest('Parent phone number required');
      }

      const otp = Math.floor(100000 + Math.random() * 900000);
      const hashedOtp = await bcrypt.hash(String(otp), 10);

      const enquiry = await strapi.db
        .query('api::notification.notification')
        .create({
          data: {
            ...data,
            otp: hashedOtp,
            isVerified: false,
          },
        });

      await sendSMS(
        data.parent_phonenumber,
        `Your verification OTP is ${otp}`
      );

      return ctx.send({
        data: { enquiryId: enquiry.id },
      });
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

      const isValid = await bcrypt.compare(String(otp), enquiry.otp);

      if (!isValid) {
        return ctx.badRequest('Invalid OTP');
      }

      await strapi.db
        .query('api::notification.notification')
        .update({
          where: { id: enquiryId },
          data: {
            isVerified: true,
            otp: null,
          },
        });

      return ctx.send({ success: true });
    },
  })
);
