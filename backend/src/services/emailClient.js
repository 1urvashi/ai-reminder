import dns from 'dns';
import nodemailer from 'nodemailer';

// Some hosts (e.g. Render) resolve smtp.gmail.com to an IPv6 address but have
// no working IPv6 egress route, failing with ENETUNREACH. Passing `family: 4`
// to nodemailer's transport isn't reliably honored by the underlying
// connection — force IPv4 first at the Node DNS-resolution level instead,
// which every socket connection in the process respects.
dns.setDefaultResultOrder('ipv4first');

// Two ways to send email, chosen automatically:
//  - Brevo's HTTP API (BREVO_API_KEY set): plain HTTPS on port 443, so it
//    can't be blocked the way outbound SMTP ports (25/465/587) commonly are
//    on free-tier hosts like Render. Preferred when configured.
//  - Raw SMTP via nodemailer (SMTP_* set): works anywhere SMTP ports aren't
//    blocked, e.g. running locally.

let transporter = null;

export function isConfigured() {
  return isBrevoConfigured() || isSmtpConfigured();
}

function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}

function isSmtpConfigured() {
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
    family: 4,
  });
  return transporter;
}

// "Name <email@example.com>" -> { name, email }. Brevo's API wants them split;
// EMAIL_FROM is kept in the single nodemailer-style string for SMTP's sake.
function parseFrom(fromHeader) {
  const match = String(fromHeader).match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2].trim() };
  }
  return { email: String(fromHeader).trim() };
}

async function sendViaBrevo(to, subject, text) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseFrom(process.env.EMAIL_FROM),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo send failed (${res.status}): ${detail}`);
  }
}

export async function sendEmail(to, subject, text) {
  if (typeof to !== 'string' || to.trim() === '') {
    throw new TypeError('sendEmail requires a recipient');
  }
  if (isBrevoConfigured()) {
    return sendViaBrevo(to, subject, text);
  }
  if (isSmtpConfigured()) {
    return getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
  }
  throw new Error('Email is not configured (set BREVO_API_KEY or SMTP_*)');
}
