/**
 * Test Email Sending Script
 *
 * Tests the email service by sending a test email using the Resend API.
 * Validates that email configuration is correct and templates render properly.
 *
 * Usage: node utilities/test-email.js <recipient-email>
 * Example: node utilities/test-email.js test@example.com
 *
 * Environment variables required:
 * - RESEND_API_KEY: Your Resend API key
 * - FROM_EMAIL: Sender email address (optional, defaults to noreply@biensperience.com)
 */

require('dotenv').config();
const { sendEmailConfirmation, sendPasswordResetEmail, sendPasswordResetConfirmation } = require('./email-service');
const backendLogger = require('./backend-logger');
const { version } = require('../package.json');

const USER_AGENT = `Biensperience/${version}`;

async function sendTestEmail(recipientEmail) {
  if (!recipientEmail) {
    console.error('❌ Error: Recipient email is required');
    console.log('Usage: node utilities/test-email.js <recipient-email>');
    process.exit(1);
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ Error: RESEND_API_KEY environment variable is not set');
    console.log('Please add RESEND_API_KEY to your .env file');
    process.exit(1);
  }

  console.log(`\n🚀 Biensperience Email Test`);
  console.log(`User-Agent: ${USER_AGENT}\n`);
  console.log(`📧 Sending test emails to: ${recipientEmail}\n`);

  try {
    // Test 1: Email Confirmation
    console.log('1️⃣  Sending email confirmation test...');
    const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/confirm-email/test-token-12345`;
    const confirmResult = await sendEmailConfirmation(recipientEmail, 'Test User', confirmUrl);
    console.log('   ✅ Email confirmation sent successfully');
    console.log(`   Message ID: ${confirmResult?.id || 'N/A'}\n`);

    // Test 2: Password Reset
    console.log('2️⃣  Sending password reset test...');
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/test-token-67890`;
    const resetResult = await sendPasswordResetEmail(recipientEmail, 'Test User', resetUrl);
    console.log('   ✅ Password reset email sent successfully');
    console.log(`   Message ID: ${resetResult?.id || 'N/A'}\n`);

    // Test 3: Password Reset Confirmation
    console.log('3️⃣  Sending password reset confirmation test...');
    const confirmationResult = await sendPasswordResetConfirmation(recipientEmail, 'Test User');
    console.log('   ✅ Password reset confirmation sent successfully');
    console.log(`   Message ID: ${confirmationResult?.id || 'N/A'}\n`);

    console.log('✨ All test emails sent successfully!');
    console.log(`\n📬 Check ${recipientEmail} for 3 test emails:`);
    console.log('   1. Email Confirmation');
    console.log('   2. Password Reset');
    console.log('   3. Password Reset Confirmation');
    console.log(`\n🎯 User-Agent Header: ${USER_AGENT}`);
    console.log('\n✅ Email service is working correctly!\n');

    backendLogger.info('Test emails sent successfully', {
      recipient: recipientEmail,
      userAgent: USER_AGENT,
      emailTypes: ['confirmation', 'passwordReset', 'passwordResetConfirmation']
    });

  } catch (error) {
    console.error('\n❌ Error sending test emails:', error.message);
    console.error('\nDetails:', error);

    if (error.message.includes('API key')) {
      console.log('\n💡 Tip: Make sure your RESEND_API_KEY is valid and has send permissions');
    }

    if (error.message.includes('domain')) {
      console.log('\n💡 Tip: Verify your FROM_EMAIL domain is verified in Resend dashboard');
    }

    backendLogger.error('Test email failed', {
      error: error.message,
      recipient: recipientEmail
    });

    process.exit(1);
  }
}

// Get recipient email from command line argument
const recipientEmail = process.argv[2];
sendTestEmail(recipientEmail);
