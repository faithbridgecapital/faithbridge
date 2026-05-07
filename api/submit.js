// FaithBridge Capital — form submission handler
// Receives the "Join the Community" form payload and fans out two emails via Resend:
//   1) A new-lead notification to the founder
//   2) A branded welcome email to the prospective investor
//
// Environment variables (set in Vercel/Netlify/Cloudflare dashboard):
//   RESEND_API_KEY  — from https://resend.com/api-keys
//   FOUNDER_EMAIL   — where new-lead notifications are routed (e.g. ntiense@faithbridge.capital)
//   FROM_EMAIL      — must be on a domain you've verified in Resend (e.g. invest@faithbridge.capital)
//   CC_EMAIL        — optional, additional recipient on lead notifications

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'ntiense@faithbridge.capital';
const FROM_EMAIL    = process.env.FROM_EMAIL    || 'invest@faithbridge.capital';
const CC_EMAIL      = process.env.CC_EMAIL      || '';
const FROM_NAME     = 'FaithBridge Capital';

export default async function handler(req, res) {
  // CORS — same-origin in production, but useful when testing from file://
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Vercel parses JSON automatically when Content-Type is application/json,
  // but other runtimes may not — handle both.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { firstName = '', lastName = '', email = '', phone = '', status = '', message = '' } = body || {};

  // Validation
  if (!firstName.trim() || !lastName.trim() || !email.trim()) {
    return res.status(400).json({ error: 'firstName, lastName, and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  // Light bot trap — if these fields exist in the payload, drop the request.
  if (body.website || body._honey) {
    return res.status(200).json({ ok: true }); // pretend to succeed
  }

  const fullName = `${firstName} ${lastName}`.trim();

  try {
    // 1) Notify the founder. Reply-To is set to the lead so a Reply goes
    //    straight to them, not back into the FaithBridge inbox.
    const leadEmail = await resend.emails.send({
      from: `${FROM_NAME} Leads <${FROM_EMAIL}>`,
      to:   [FOUNDER_EMAIL],
      cc:   CC_EMAIL ? [CC_EMAIL] : undefined,
      replyTo: email,
      subject: `New Lead — ${fullName} · ${status || 'Status not provided'}`,
      html: leadEmailHtml({ firstName, lastName, email, phone, status, message }),
      text: leadEmailText({ firstName, lastName, email, phone, status, message }),
    });

    // 2) Welcome the lead.
    const welcomeEmail = await resend.emails.send({
      from: `Dr. Ntiense Robin · FaithBridge Capital <${FROM_EMAIL}>`,
      to:   [email],
      replyTo: FOUNDER_EMAIL,
      subject: 'Welcome to FaithBridge — we will be in touch shortly',
      html: welcomeEmailHtml({ firstName }),
      text: welcomeEmailText({ firstName }),
    });

    return res.status(200).json({
      ok: true,
      leadId:    leadEmail?.data?.id    || null,
      welcomeId: welcomeEmail?.data?.id || null
    });
  } catch (err) {
    console.error('Resend send error:', err);
    return res.status(500).json({ error: 'Email send failed. Please try again or write to invest@faithbridge.capital directly.' });
  }
}

/* ---------- Email templates ---------- */

function leadEmailHtml({ firstName, lastName, email, phone, status, message }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F2820;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid rgba(15,40,32,0.08);">
        <tr><td style="padding:36px 36px 18px;border-bottom:1px solid rgba(212,168,74,0.35);">
          <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#B68A2E;font-weight:600;">FaithBridge Capital · New Lead</div>
        </td></tr>
        <tr><td style="padding:30px 36px 8px;">
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;margin:0 0 8px;color:#0F2820;line-height:1.25;">A new partner just reached out.</h1>
          <p style="margin:0 0 22px;font-size:14px;color:rgba(11,26,20,0.65);line-height:1.6;">Hit Reply on this email and your message goes straight to ${esc(firstName)}.</p>
        </td></tr>
        <tr><td style="padding:0 36px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
            ${row('Name', `${esc(firstName)} ${esc(lastName)}`)}
            ${row('Email', `<a href="mailto:${esc(email)}" style="color:#0F2820;text-decoration:underline;">${esc(email)}</a>`)}
            ${row('Phone', phone ? `<a href="tel:${esc(phone)}" style="color:#0F2820;text-decoration:underline;">${esc(phone)}</a>` : '—')}
            ${row('Investor Status', esc(status) || '—', true)}
          </table>
        </td></tr>
        ${message ? `<tr><td style="padding:8px 36px 28px;">
          <div style="background:#F4EFE6;border-left:2px solid #D4A84A;padding:18px 20px;font-size:14px;line-height:1.7;color:#0F2820;">
            <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#B68A2E;font-weight:600;margin-bottom:8px;">Their Note</div>
            ${esc(message).replace(/\n/g,'<br>')}
          </div>
        </td></tr>` : '<tr><td style="padding:8px 36px 28px;"></td></tr>'}
        <tr><td style="padding:24px 36px 32px;border-top:1px solid rgba(15,40,32,0.06);font-size:11px;line-height:1.6;color:rgba(11,26,20,0.5);">
          Submitted via faithbridge.capital · ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label, value, isLast = false) {
  const border = isLast ? '' : 'border-bottom:1px solid rgba(15,40,32,0.07);';
  return `<tr>
    <td style="padding:12px 0;${border}width:140px;color:rgba(11,26,20,0.55);font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:500;">${label}</td>
    <td style="padding:12px 0;${border}color:#0F2820;font-weight:500;">${value}</td>
  </tr>`;
}

function leadEmailText({ firstName, lastName, email, phone, status, message }) {
  return [
    'FaithBridge Capital — New Lead',
    '',
    `Name:            ${firstName} ${lastName}`,
    `Email:           ${email}`,
    `Phone:           ${phone || '—'}`,
    `Investor Status: ${status || '—'}`,
    '',
    'Note:',
    message || '—',
    '',
    'Reply directly to this email to reach the lead.'
  ].join('\n');
}

function welcomeEmailHtml({ firstName }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F2820;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid rgba(15,40,32,0.08);">
        <tr><td align="center" style="padding:40px 40px 28px;border-bottom:1px solid rgba(212,168,74,0.4);">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:0.34em;color:#0F2820;font-weight:500;">FAITHBRIDGE</div>
          <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#B68A2E;margin-top:10px;font-weight:500;">A Private Multifamily Partnership</div>
        </td></tr>
        <tr><td style="padding:40px 44px 8px;">
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:300;margin:0 0 26px;color:#0F2820;line-height:1.2;">Welcome, ${esc(firstName)}.</h1>
          <p style="font-size:16px;line-height:1.75;color:#0F2820;margin:0 0 18px;">
            Thank you for reaching out to FaithBridge Capital. Your details are in front of me, and I will be in touch personally within two business days — no automation, no list, no pressure.
          </p>
          <p style="font-size:16px;line-height:1.75;color:#0F2820;margin:0 0 14px;">In the meantime, three things to expect:</p>
          <ul style="font-size:15.5px;line-height:1.85;color:#0F2820;padding-left:20px;margin:0 0 26px;">
            <li>A short conversation to understand what you are building, and whether what we offer fits.</li>
            <li>If it does, full materials on our current Harmony Grove offering — underwriting, market thesis, sponsor track record.</li>
            <li>If it does not, an honest "not yet" and a referral if we can help you find one.</li>
          </ul>
          <p style="font-size:16px;line-height:1.75;color:#0F2820;margin:0 0 36px;">
            Wealth that endures beyond your lifetime is not built on hype. It is built on the right partners, on the right terms, on the right day. I am glad you are here.
          </p>
        </td></tr>
        <tr><td style="padding:0 44px 36px;">
          <div style="border-top:1px solid rgba(212,168,74,0.4);padding-top:22px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;color:#B68A2E;font-size:20px;">— Dr. Ntiense Robin, DNAP, CRNA</div>
            <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(11,26,20,0.55);margin-top:6px;font-weight:500;">Founder &amp; Chief Executive Officer</div>
          </div>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin-top:20px;">
        <tr><td style="padding:0 16px;font-size:11px;line-height:1.7;color:rgba(11,26,20,0.45);text-align:center;">
          FaithBridge Capital is a private partnership. Offerings are extended only to accredited investors under Reg D, Rule 501(a). This email is informational and does not constitute an offer to sell securities. Past performance is not indicative of future results.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function welcomeEmailText({ firstName }) {
  return [
    `Welcome, ${firstName}.`,
    '',
    'Thank you for reaching out to FaithBridge Capital. Your details are in front of me, and I will be in touch personally within two business days — no automation, no list, no pressure.',
    '',
    'In the meantime, three things to expect:',
    ' - A short conversation to understand what you are building, and whether what we offer fits.',
    ' - If it does, full materials on our current Harmony Grove offering — underwriting, market thesis, sponsor track record.',
    ' - If it does not, an honest "not yet" and a referral if we can help you find one.',
    '',
    'Wealth that endures beyond your lifetime is not built on hype. It is built on the right partners, on the right terms, on the right day. I am glad you are here.',
    '',
    '— Dr. Ntiense Robin, DNAP, CRNA',
    'Founder & Chief Executive Officer, FaithBridge Capital',
    '',
    '---',
    'FaithBridge Capital is a private partnership. Offerings are extended only to accredited investors under Reg D, Rule 501(a). This email is informational and does not constitute an offer to sell securities.'
  ].join('\n');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
