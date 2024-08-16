const nodemailer = require('nodemailer');

module.exports = {
    sendOTPEmail: async (email, otp) => {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your OTP from TyChr</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .container {
                        background-color: #f9f9f9;
                        border-radius: 5px;
                        padding: 30px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #2c3e50;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    p {
                        margin-bottom: 15px;
                    }
                    .otp {
                        font-size: 32px;
                        font-weight: bold;
                        color: #e74c3c;
                        letter-spacing: 5px;
                        margin: 20px 0;
                    }
                    .footer {
                        margin-top: 30px;
                        font-size: 12px;
                        color: #7f8c8d;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Welcome to TyChr!</h1>
                    <p>Greetings from TyChr! We're glad to have you here.</p>
                    <p>Here's the OTP you requested:</p>
                    <div class="otp">${otp}</div>
                    <p>Please use this OTP to complete your verification process.</p>
                    <p>If you didn't request this OTP, please ignore this email.</p>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p>&copy; 2024 TyChr. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: '"TyChr" <noreply@tychr.com>',
            to: email,
            subject: 'Your OTP for TyChr Verification',
            text: `Greetings from TyChr! We're glad to have you here. Here's the OTP you requested: ${otp}`,
            html: htmlContent,
        };

        await transporter.sendMail(mailOptions);
    },
};