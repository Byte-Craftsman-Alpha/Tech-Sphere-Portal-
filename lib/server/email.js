import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: String(port) === '465',
    auth: { user, pass }
  });
}

function baseTemplate({ title, subtitle, bodyHtml, footer }) {
  return `
  <div style="margin:0;padding:24px;background:#f5f7fb;font-family:'Public Sans',Arial,sans-serif;color:#1a2230;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf3;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 28px;border-bottom:1px solid #eef2f7;">
        <div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#8a9ab0;text-transform:uppercase;">TechSphere</div>
        <div style="font-size:22px;font-weight:800;color:#1a2230;margin-top:6px;">${title}</div>
        ${subtitle ? `<div style="margin-top:6px;font-size:14px;color:#667589;">${subtitle}</div>` : ''}
      </div>
      <div style="padding:24px 28px;font-size:14px;line-height:1.6;color:#353e4c;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 28px;background:#f9fafc;border-top:1px solid #eef2f7;font-size:12px;color:#8a9ab0;">
        ${footer || 'This is an automated message from TechSphere.'}
      </div>
    </div>
  </div>
  `;
}

export async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) return { skipped: true, reason: 'SMTP not configured' };
  const from = process.env.SMTP_FROM || `TechSphere <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`;
  await transporter.sendMail({ from, to, subject, html, text });
  return { sent: true };
}

export async function sendOtpEmail({ to, otp }) {
  const html = baseTemplate({
    title: 'Verify Your Email',
    subtitle: 'Use the code below to complete your registration.',
    bodyHtml: `
      <div style="font-size:14px;margin-bottom:12px;">Your verification code:</div>
      <div style="display:inline-block;padding:12px 18px;border-radius:10px;background:#eef2ff;color:#4338ca;font-weight:800;letter-spacing:4px;font-size:18px;">
        ${otp}
      </div>
      <div style="margin-top:16px;font-size:12px;color:#8a9ab0;">This code expires in 10 minutes.</div>
    `
  });
  const text = `Your verification code is ${otp}. It expires in 10 minutes.`;
  return sendEmail({ to, subject: 'TechSphere Verification Code', html, text });
}

export async function sendAdminRegistrationEmail({ adminEmail, user }) {
  if (!adminEmail) return { skipped: true, reason: 'ADMIN_EMAIL missing' };
  const html = baseTemplate({
    title: 'New Registration Pending',
    subtitle: 'A new user signed up and needs approval.',
    bodyHtml: `
      <div style="margin-bottom:12px;">User details:</div>
      <ul style="padding-left:18px;margin:0;color:#1a2230;">
        <li><strong>Name:</strong> ${user.full_name || 'N/A'}</li>
        <li><strong>Email:</strong> ${user.email || 'N/A'}</li>
        <li><strong>Branch:</strong> ${user.branch || 'N/A'}</li>
        <li><strong>Semester:</strong> ${user.semester || 'N/A'}</li>
        <li><strong>Roll No:</strong> ${user.roll_no || 'N/A'}</li>
      </ul>
    `
  });
  const text = [
    'A new user registered and is pending approval.',
    `Name: ${user.full_name || 'N/A'}`,
    `Email: ${user.email || 'N/A'}`
  ].join('\n');
  return sendEmail({ to: adminEmail, subject: `New Registration: ${user.full_name || user.email || 'New User'}`, html, text });
}

export async function sendUserApprovalEmail({ to, fullName, approved }) {
  const title = approved ? 'Account Approved' : 'Account Pending';
  const subtitle = approved
    ? 'You can now access the TechSphere portal.'
    : 'Your registration is pending admin approval.';
  const html = baseTemplate({
    title,
    subtitle,
    bodyHtml: `
      <div style="margin-bottom:12px;">Hi ${fullName || 'there'},</div>
      <div style="margin-bottom:12px;">
        ${approved
          ? 'Your account has been approved. You can sign in and start exploring events, challenges, and the community dashboard.'
          : 'Your account is still awaiting approval. We will notify you as soon as it is approved.'}
      </div>
      <div style="font-size:12px;color:#8a9ab0;">If you have questions, reply to this email.</div>
    `
  });
  const text = approved
    ? 'Your TechSphere account has been approved. You can now sign in.'
    : 'Your TechSphere account is still pending approval.';
  return sendEmail({ to, subject: `TechSphere - ${title}`, html, text });
}
