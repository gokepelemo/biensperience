/**
 * Email Service using Resend
 * Handles sending transactional emails for password reset, notifications, etc.
 */

const { Resend } = require('resend');
const backendLogger = require('./backend-logger');
const { lang } = require('./lang.constants');
const { version } = require('../package.json');

// Initialize Resend with API key (mock in test environment)
let resend;
if (process.env.NODE_ENV === 'test') {
  // Mock Resend in test environment to avoid "Headers is not defined" error
  resend = {
    emails: {
      send: async () => ({ data: { id: 'test-email-id' }, error: null })
    }
  };
} else {
  resend = new Resend(process.env.RESEND_API_KEY);
}

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@biensperience.com';
const APP_NAME = 'Biensperience';
/**
 * Strip HTML tags from text content safely
 * @param {string} html - HTML content to strip
 * @returns {string} Plain text content
 */
function stripHtml(html) {
  // Security: Character-by-character parsing to avoid ReDoS vulnerabilities
  // Avoids polynomial regex patterns like /<[^>]*>/g that can cause denial of service
  let text = '';
  let inTag = false;
  let inEntity = false;
  let entity = '';

  for (let i = 0; i < html.length; i++) {
    const char = html[i];

    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (inTag) {
      continue;
    }

    if (char === '&') {
      inEntity = true;
      entity = '';
      continue;
    }
    if (inEntity) {
      if (char === ';') {
        inEntity = false;
        // Convert common HTML entities
        const entities = {
          'lt': '<', 'gt': '>', 'amp': '&', 'quot': '"', 'apos': "'",
          'nbsp': ' ', 'ndash': '–', 'mdash': '—'
        };
        text += entities[entity] || '';
        entity = '';
      } else if (char.match(/[a-zA-Z0-9#]/)) {
        entity += char;
      } else {
        // Invalid entity, output as-is
        text += '&' + entity + char;
        inEntity = false;
        entity = '';
      }
      continue;
    }

    text += char;
  }

  // Handle unclosed entity
  if (inEntity) {
    text += '&' + entity;
  }

  // Remove extra whitespace
  return text.replace(/\s+/g, ' ').trim();
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

/**
 * Send invite email
 * @param {Object} options - Invite options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.inviterName - Name of person sending invite
 * @param {string} options.inviteCode - Invite code
 * @param {string} options.inviteeName - Name of person being invited (optional)
 * @param {string} options.customMessage - Custom message from inviter (optional)
 * @param {number} options.experiencesCount - Number of experiences included
 * @param {number} options.destinationsCount - Number of destinations included
 */
async function sendInviteEmail(options) {
  try {
    const {
      toEmail,
      inviterName,
      inviteCode,
      inviteeName = '',
      customMessage = '',
      experiencesCount = 0,
      destinationsCount = 0
    } = options;

    const t = lang.current.email.invite;
    const vars = {
      userName: inviteeName ? ` ${inviteeName}` : '',
      inviterName,
      appName: APP_NAME
    };

    // Build signup URL with invite code
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupUrl = `${baseUrl}/signup?invite=${inviteCode}`;

    // Build additional sections
    const additionalSections = [];

    // Add custom message if provided
    if (customMessage) {
      additionalSections.push(`
        <div class="info">
          <strong>${replaceVars(t.customMessage, vars)}</strong>
          <p style="margin-top: 10px; font-style: italic;">"${customMessage}"</p>
        </div>
      `);
    }

    // Add invite code display
    additionalSections.push(`
      <div style="background: #f5f5f5; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
        <p style="margin: 0; color: #666; font-size: 14px;"><strong>${t.inviteCodeLabel}</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 24px; font-family: 'Courier New', monospace; font-weight: bold; color: #667eea; letter-spacing: 2px;">${inviteCode}</p>
        <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${t.inviteCodeInstruction}</p>
      </div>
    `);

    // Add included items if any
    if (experiencesCount > 0 || destinationsCount > 0) {
      const includesList = [];
      if (experiencesCount > 0) {
        const plural = experiencesCount === 1 ? '' : 's';
        includesList.push(replaceVars(t.experiencesIncluded, { count: experiencesCount, plural }));
      }
      if (destinationsCount > 0) {
        const plural = destinationsCount === 1 ? '' : 's';
        includesList.push(replaceVars(t.destinationsIncluded, { count: destinationsCount, plural }));
      }

      additionalSections.push(`
        <div class="success">
          <strong>${t.includesHeading}</strong>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            ${includesList.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `);
    }

    // Add alternative link
    additionalSections.push(`
      <p style="font-size: 0.9rem; color: #666;">${t.altLinkText}<br><a href="${signupUrl}" style="word-break: break-all;">${signupUrl}</a></p>
    `);

    // Add about section
    additionalSections.push(`
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p><strong>${replaceVars(t.aboutAppTitle, vars)}</strong></p>
        <p>${replaceVars(t.aboutAppText, vars)}</p>
      </div>
    `);

    const { html, text } = createEmailTemplate({
      heading: t.heading,
      greeting: replaceVars(t.greeting, vars),
      body: replaceVars(t.inviterMessage, vars) + ' ' + t.body,
      buttonText: t.buttonText,
      buttonUrl: signupUrl,
      additionalSections,
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

    backendLogger.info('Invite email sent successfully', {
      to: toEmail,
      inviterName,
      inviteCode,
      messageId: data?.id
    });

    return data;
  } catch (error) {
    backendLogger.error('Failed to send invite email', {
      error: error.message,
      to: options.toEmail,
      inviterName: options.inviterName
    });
    throw error;
  }
}

/**
 * Send collaborator invite email
 * @param {Object} options - Invite options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.inviterName - Name of person sending invite
 * @param {string} options.experienceName - Name of the experience
 * @param {string} options.destinationName - Name and location of destination
 * @param {string} options.signupUrl - Direct signup/login URL with invite token
 * @param {string} options.inviteCode - Optional invite code for display
 */
async function sendCollaboratorInviteEmail(options) {
  try {
    const {
      toEmail,
      inviterName,
      experienceName,
      destinationName,
      signupUrl,
      inviteCode = ''
    } = options;

    const t = lang.current.email.collaboratorInvite;
    const vars = {
      userName: '', // Will be filled if we know their name
      inviterName,
      experienceName,
      destinationName,
      appName: APP_NAME
    };

    // Build additional sections
    const additionalSections = [];

    // Add experience details
    additionalSections.push(`
      <div class="info">
        <p style="margin: 0;">${replaceVars(t.experienceDetails, vars)}</p>
        <p style="margin: 5px 0 0 0;">${replaceVars(t.destinationDetails, vars)}</p>
      </div>
    `);

    // Add what collaborators can do
    additionalSections.push(`
      <div style="margin: 20px 0;">
        <p><strong>${t.whatYouCanDo}</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${t.collaboratorPerks.map(perk => `<li>${perk}</li>`).join('')}
        </ul>
      </div>
    `);

    // Add invite code if provided
    if (inviteCode) {
      additionalSections.push(`
        <div style="background: #f5f5f5; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 14px;"><strong>${t.inviteCodeLabel}</strong></p>
          <p style="margin: 10px 0 0 0; font-size: 24px; font-family: 'Courier New', monospace; font-weight: bold; color: #667eea; letter-spacing: 2px;">${inviteCode}</p>
          <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${t.inviteCodeInstruction}</p>
        </div>
      `);
    }

    // Add notes for existing vs new users
    additionalSections.push(`
      <div class="success">
        <p style="margin: 0;"><strong>Existing User?</strong> ${t.existingUserNote}</p>
      </div>
    `);

    additionalSections.push(`
      <div class="info">
        <p style="margin: 0;"><strong>New to ${APP_NAME}?</strong> ${t.newUserNote}</p>
      </div>
    `);

    // Add alternative link
    additionalSections.push(`
      <p style="font-size: 0.9rem; color: #666;">${t.altLinkText}<br><a href="${signupUrl}" style="word-break: break-all;">${signupUrl}</a></p>
    `);

    // Add about section
    additionalSections.push(`
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p><strong>${replaceVars(t.aboutAppTitle, vars)}</strong></p>
        <p>${replaceVars(t.aboutAppText, vars)}</p>
      </div>
    `);

    const { html, text } = createEmailTemplate({
      heading: t.heading,
      greeting: replaceVars(t.greeting, vars),
      body: replaceVars(t.inviterMessage, vars) + ' ' + t.body,
      buttonText: t.buttonText,
      buttonUrl: signupUrl,
      additionalSections,
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

    backendLogger.info('Collaborator invite email sent successfully', {
      to: toEmail,
      inviterName,
      experienceName,
      destinationName,
      messageId: data?.id
    });

    return data;
  } catch (error) {
    backendLogger.error('Failed to send collaborator invite email', {
      error: error.message,
      to: options.toEmail,
      inviterName: options.inviterName
    });
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendEmailConfirmation,
  sendInviteEmail,
  // sendCollaboratorInviteEmail - Future enhancement for dedicated collaborator invites
};
