const nodemailer = require('nodemailer');
require('dotenv').config();

// Create the transporter. For Gmail, use "App Passwords".
// For other services, update host/port accordingly.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends a 6-digit OTP to the user's email.
 */
exports.sendOTP = async (email, otp) => {
  const mailOptions = {
    from: `"Travio Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Travio Verification Code',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">Welcome to Travio!</h2>
        <p>Hello,</p>
        <p>Thank you for signing up. Please use the verification code below to complete your registration. This code will expire in 10 minutes.</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          &copy; 2026 Travio AI. All rights reserved.
        </p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};
