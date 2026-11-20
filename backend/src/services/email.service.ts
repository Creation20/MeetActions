import nodemailer from 'nodemailer';

/**
 * Email delivery for recap distribution (#4).
 *
 * Configured via SMTP env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If SMTP is not configured, sendEmail returns { sent: false, preview } so the
 * client can still show the fully-rendered recap (and the feature degrades
 * gracefully instead of erroring).
 */

export const isEmailConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
const getTransporter = (): nodemailer.Transporter | null => {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

interface RecapData {
  title: string;
  date: Date;
  summary?: string;
  decisions?: string[];
  tasks?: { title: string; owner?: string; priority?: string }[];
  senderName?: string;
}

export const buildRecapHtml = (data: RecapData): string => {
  const decisions = (data.decisions || []).map(d => `<li>${escapeHtml(d)}</li>`).join('');

  // Group tasks by owner for a per-person action list.
  const byOwner: Record<string, string[]> = {};
  for (const t of data.tasks || []) {
    const owner = t.owner?.trim() || 'Unassigned';
    (byOwner[owner] ||= []).push(escapeHtml(t.title));
  }
  const taskBlocks = Object.entries(byOwner).map(([owner, items]) =>
    `<div style="margin:8px 0"><strong>${escapeHtml(owner)}</strong><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`
  ).join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 28px;border-radius:16px 16px 0 0">
      <div style="color:#e0e7ff;font-size:13px;letter-spacing:1px;text-transform:uppercase">MeetActions Recap</div>
      <h1 style="color:#fff;margin:6px 0 0;font-size:22px">${escapeHtml(data.title)}</h1>
      <div style="color:#c7d2fe;font-size:13px;margin-top:4px">${new Date(data.date).toDateString()}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 28px">
      ${data.summary ? `<h2 style="font-size:15px;color:#6366f1">Summary</h2><p style="line-height:1.6;font-size:14px">${escapeHtml(data.summary)}</p>` : ''}
      ${decisions ? `<h2 style="font-size:15px;color:#6366f1">Key Decisions</h2><ul style="line-height:1.6;font-size:14px">${decisions}</ul>` : ''}
      ${taskBlocks ? `<h2 style="font-size:15px;color:#6366f1">Action Items</h2>${taskBlocks}` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <div style="font-size:12px;color:#9ca3af">Sent${data.senderName ? ` by ${escapeHtml(data.senderName)}` : ''} via MeetActions</div>
    </div>
  </div>`;
};

const escapeHtml = (s: string): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const sendRecapEmail = async (
  recipients: string[],
  data: RecapData
): Promise<{ sent: boolean; preview: string; recipients: string[] }> => {
  const html = buildRecapHtml(data);
  const t = getTransporter();
  if (!t || recipients.length === 0) {
    return { sent: false, preview: html, recipients };
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients.join(','),
    subject: `Recap: ${data.title}`,
    html,
  });
  return { sent: true, preview: html, recipients };
};
