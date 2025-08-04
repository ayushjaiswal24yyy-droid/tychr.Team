const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

module.exports = {
  generateInvoice: async (userPlan) => {
    const doc = new PDFDocument({ margin: 40 });

    // Set up paths
    const invoicesDir = path.join(process.cwd(), "public", "invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const fileName = `invoice-${userPlan.id}.pdf`;
    const filePath = path.join(invoicesDir, fileName);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Add content to PDF
    doc.fontSize(18).text("Invoice", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Invoice #: ${userPlan.invoice_number || `INV-${userPlan.id}`}`);
    doc.text(
      `Date: ${new Date(userPlan.purchased_at).toLocaleDateString("en-IN")}`
    );
    doc.text(`Student: ${userPlan.student.email || userPlan.student.username}`);
    doc.text(`Plan: ${userPlan.premium_plan.name}`);
    doc.moveDown();
    doc.text(`Price: ₹${parseFloat(userPlan.price_at_purchase).toFixed(2)}`);
    doc.text(
      `Commission (${userPlan.commission_percentage_applied}%): ₹${parseFloat(
        userPlan.commission_amount
      ).toFixed(2)}`
    );
    doc.text(`Total Paid: ₹${parseFloat(userPlan.total_paid).toFixed(2)}`, {
      underline: true,
    });
    doc.moveDown();
    doc.text(
      `Payment ref: Order ${userPlan.razorpay_order_id}, Payment ${userPlan.razorpay_payment_id}`
    );
    doc.text("Status: Paid");

    doc.end();

    // Wait for the file to be written
    await new Promise((resolve) => writeStream.on("finish", () => resolve()));
    return `/invoices/${fileName}`;
  },
};
