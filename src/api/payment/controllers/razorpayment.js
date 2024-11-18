const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_ID,
});

module.exports = {
  async createOrder(ctx) {
    try {
      const { amount } = ctx.request.body;

      if (!amount) {
        return ctx.badRequest("Amount is required");
      }
      console.log(amount);
      const order = await razorpay.orders.create({
        amount,
        currency: "INR",
      });

      return ctx.send({
        order,
      });
    } catch (error) {
      console.error("Razorpay Error:", error);
      return ctx.internalServerError("Failed to create order");
    }
  },
};
