import nodemailer from 'nodemailer';

// SMTP email sender. Configured entirely from environment variables; when any
// required setting is missing it reports not-configured and callers skip email.
// The transporter is created once and reused (Power-of-10 R3: no per-call setup).

let transporter = null;

export function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.EMAIL_FROM);
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }
  const port = Number(process.env.SMTP_PORT);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Some hosts (e.g. Render) resolve smtp.gmail.com to an IPv6 address but
    // have no working IPv6 route out, failing with ENETUNREACH. Force IPv4.
    family: 4,
  });
  return transporter;
}

export async function sendEmail(to, subject, text) {
  if (typeof to !== 'string' || to.trim() === '') {
    throw new TypeError('sendEmail requires a recipient');
  }
  if (!isConfigured()) {
    throw new Error('SMTP is not configured');
  }
  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}
