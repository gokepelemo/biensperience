/**
 * Email Service using Resend
 * Handles sending transactional emails for password reset, notifications, etc.
 */

const { Resend } = require('resend');
const backendLogger = require('./backend-logger');
const { lang } = require('./lang.constants');
const { version } = require('../package.json');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@biensperience.com';
const APP_NAME = 'Biensperience';
/**
 * Strip HTML tags from text content safely
 * @param {string} html - HTML content to strip
 * @returns {string} Plain text content
 */
function stripHtml(html) {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Remove HTML entities
  text = text.replace(/&[^;]+;/g, '');
  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Replace template variables
 * @param {string} template - Template string
 * @param {Object} vars - Variables to replace
 * @returns {string} Replaced string
 */
function replaceVars(template, vars) {
  let result = template;
  Object.keys(vars).forEach(key => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), vars[key]);
  });
  return result;
}

/**
 * Generic email template function
 * @param {Object} options - Template options
 * @returns {Object} HTML and text versions
 */
function createEmailTemplate(options) {
  const {
    heading,
    greeting,
    body,
    buttonText,
    buttonUrl,
    additionalSections = [],
    signature,
    footer
  } = options;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 14px;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 12px;
          margin: 20px 0;
        }
        .info {
          background: #d1ecf1;
          border-left: 4px solid #0c5460;
          padding: 12px;
          margin: 20px 0;
        }
        .success {
          background: #d4edda;
          border-left: 4px solid #28a745;
          padding: 12px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">${heading}</h1>
      </div>
      <div class="content">
        <p>${greeting}</p>
        <p>${body}</p>
        ${buttonText && buttonUrl ? `
        <div style="text-align: center;">
          <a href="${buttonUrl}" class="button">${buttonText}</a>
        </div>
        ` : ''}
        ${additionalSections.join('\n')}
        <div class="footer">
          <p>${signature}</p>
          <p style="font-size: 12px; color: #999;">${footer}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${heading}

${greeting}

${body}

${buttonText && buttonUrl ? `${buttonText}: ${buttonUrl}\n` : ''}
${additionalSections.map(s => stripHtml(s)).join('\n\n')}

${stripHtml(signature).replace(/\n/g, '\n')}

${footer}
  `.trim();

  return { html, text };
}

/**
 * Send password reset email
 * @param {string} toEmail - Recipient email address
 * @param {string} userName - User's name
 * @param {string} resetUrl - Password reset URL with token
 */
async function sendPasswordResetEmail(toEmail, userName, resetUrl) {
  try {
    const t = lang.current.email.passwordReset;
    const vars = { userName, appName: APP_NAME };

    const { html, text } = createEmailTemplate({
      heading: replaceVars(t.heading, vars),
      greeting: replaceVars(t.greeting, vars),
      body: replaceVars(t.body, vars),
      buttonText: t.buttonText,
      buttonUrl: resetUrl,
      additionalSections: [
        `<div class="warning"><strong>${t.warningTitle}</strong> ${t.warningText}</div>`,
        `<p>${t.ignoreText}</p>`,
        `<p>${t.securityText}</p>`
      ],
      signature: replaceVars(t.signature, vars),
      footer: t.footer
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: replaceVars(t.subject, vars),
      html,
      text
    });

    if (error) {
      throw new Error(error.message || 'Failed to send email');
    }

    backendLogger.info('Password reset email sent successfully', {
      to: toEmail,
      messageId: data?.id
    });

    return data;
  } catch (error) {
    backendLogger.error('Failed to send password reset email', {
      error: error.message,
      to: toEmail
    });
    throw error;
  }
}

/**
 * Send password reset confirmation email
 * @param {string} toEmail - Recipient email address
 * @param {string} userName - User's name
 */
async function sendPasswordResetConfirmation(toEmail, userName) {
  try {
    const t = lang.current.email.passwordResetConfirmation;
    const vars = { userName, appName: APP_NAME };

    const { html, text } = createEmailTemplate({
      heading: t.heading,
      greeting: replaceVars(t.greeting, vars),
      body: replaceVars(t.body, vars),
      buttonText: null,
      buttonUrl: null,
      additionalSections: [
        `<div class="success"><strong>${t.successTitle}</strong> ${t.successText}</div>`,
        `<p>${t.securityText}</p>`
      ],
      signature: replaceVars(t.signature, vars),
      footer: t.footer
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: replaceVars(t.subject, vars),
      html,
      text
    });

    if (error) {
      throw new Error(error.message || 'Failed to send email');
    }

    backendLogger.info('Password reset confirmation email sent successfully', {
      to: toEmail,
      messageId: data?.id
    });

    return data;
  } catch (error) {
    backendLogger.error('Failed to send password reset confirmation email', {
      error: error.message,
      to: toEmail
    });
    throw error;
  }
}

/**
 * Send email confirmation email
 * @param {string} toEmail - Recipient email address
 * @param {string} userName - User's name
 * @param {string} confirmUrl - Email confirmation URL with token
 */
async function sendEmailConfirmation(toEmail, userName, confirmUrl) {
  try {
    const t = lang.current.email.emailConfirmation;
    const vars = { userName, appName: APP_NAME };

    const { html, text } = createEmailTemplate({
      heading: replaceVars(t.heading, vars),
      greeting: replaceVars(t.greeting, vars),
      body: replaceVars(t.body, vars),
      buttonText: t.buttonText,
      buttonUrl: confirmUrl,
      additionalSections: [
        `<div class="info"><strong>${t.infoTitle}</strong> ${t.infoText}</div>`,
        `<p style="font-size: 0.9rem; color: #666;">${t.altLinkText}<br><a href="${confirmUrl}" style="word-break: break-all;">${confirmUrl}</a></p>`,
        `<p>${replaceVars(t.ignoreText, vars)}</p>`
      ],
      signature: replaceVars(t.signature, vars),
      footer: t.footer
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: replaceVars(t.subject, vars),
      html,
      text
    });

    if (error) {
      throw new Error(error.message || 'Failed to send email');
    }

    backendLogger.info('Email confirmation sent successfully', {
      to: toEmail,
      messageId: data?.id
    });

    return data;
  } catch (error) {
    backendLogger.error('Failed to send email confirmation', {
      error: error.message,
      to: toEmail
    });
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendEmailConfirmation,
};
