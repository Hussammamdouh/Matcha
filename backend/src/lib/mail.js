const nodemailer = require('nodemailer');
const { config } = require('../config');
const { createLogger } = require('./logger');

const logger = createLogger();

/**
 * Render a minimal HTML template based on template key and data
 * @param {string} template
 * @param {Object} data
 * @returns {{subject?: string, html?: string, text?: string}}
 */
function renderTemplate(template, data) {
  switch (template) {
    case 'email-verification': {
      const { nickname = 'there', verificationLink } = data || {};
      const subject = 'Verify your email';
      const text = `Hi ${nickname},\n\nPlease verify your email by clicking the link below:\n${verificationLink}\n\nIf you did not sign up, please ignore this email.`;
      const html = `
        <p>Hi ${nickname},</p>
        <p>Please verify your email by clicking the link below:</p>
        <p><a href="${verificationLink}">Verify Email</a></p>
        <p>If you did not sign up, please ignore this email.</p>
      `;
      return { subject, text, html };
    }
    case 'password-reset': {
      const { resetLink, expiresAt } = data || {};
      const subject = 'Reset your password';
      const text = `Reset your password using the link below (expires at ${expiresAt || 'soon'}):\n${resetLink}`;
      const html = `
        <p>Reset your password using the link below (expires at ${expiresAt || 'soon'}):</p>
        <p><a href="${resetLink}">Reset Password</a></p>
      `;
      return { subject, text, html };
    }
    default:
      return {};
  }
}

/**
 * Send email using configured provider (SMTP via Nodemailer)
 * @param {Object} emailData
 * @param {string} emailData.to
 * @param {string} [emailData.subject]
 * @param {string} [emailData.html]
 * @param {string} [emailData.text]
 * @param {string} [emailData.template]
 * @param {Object} [emailData.data]
 * @returns {Promise<void>}
 */
async function sendEmail(emailData) {
  const provider = config.email.provider;

  if (provider !== 'smtp' && provider !== 'sendgrid') {
    // For now we implement smtp. If provider is not smtp, log and return.
    logger.warn('Email provider not supported yet, falling back to log only', { provider });
    logger.info('Email (not sent)', emailData);
    return;
  }

  if (provider === 'sendgrid') {
    // Placeholder: not implemented yet
    logger.warn('SendGrid provider not implemented yet. Consider switching MAIL_PROVIDER=smtp');
    logger.info('Email (not sent)', emailData);
    return;
  }

  // SMTP provider
  const { host, port, secure, user, pass, fromEmail } = config.email.smtp;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const { template, data, to } = emailData;
  const defaults = template ? renderTemplate(template, data) : {};

  const mail = {
    from: fromEmail,
    to,
    subject: emailData.subject || defaults.subject || 'Notification',
    text: emailData.text || defaults.text,
    html: emailData.html || defaults.html,
  };

  const info = await transport.sendMail(mail);
  logger.info('Email sent', {
    to,
    messageId: info.messageId,
    provider: 'smtp',
  });
}

module.exports = {
  sendEmail,
};
