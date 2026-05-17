/**
 * FaithBridge Capital — form handler (Google Apps Script)
 *
 * Receives a POST from the website's "Join the Investor Group" form,
 * sends a new-lead notification to the founder, sends a welcome email
 * to the lead, and (optionally) logs the submission to a Google Sheet.
 *
 * Deploy: Deploy → New deployment → Web app
 *   Execute as: Me (your Google account)
 *   Who has access: Anyone
 * Copy the deployed URL — that goes into the site's submit handler.
 */

// ===== CONFIGURATION =====
// Edit these three before deploying.
const FOUNDER_EMAIL = 'ntiense@faithbridge.capital';   // where new-lead notifications go
const FOUNDER_NAME  = 'Dr. Ntiense Robin';
const FROM_BRAND    = 'FaithBridge Capital';

// Optional: log every submission to a Google Sheet.
// Create a sheet in Drive, copy its ID from the URL (the long string between /d/ and /edit),
// paste it below. Leave SHEET_ID empty to skip logging.
const SHEET_ID  = '';
const SHEET_TAB = 'Leads';
// =========================

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'Invalid JSON' });
  }

  const firstName = (payload.firstName || '').toString().trim();
  const lastName  = (payload.lastName  || '').toString().trim();
  const email     = (payload.email     || '').toString().trim();
  const phone     = (payload.phone     || '').toString().trim();
  const status    = (payload.status    || '').toString().trim();
  const message   = (payload.message   || '').toString().trim();
  const honeypot  = (payload.website   || payload._honey || '').toString().trim();

  // Silent bot trap
  if (honeypot) return json({ ok: true });

  // Required fields
  if (!firstName || !lastName || !email) {
    return json({ ok: false, error: 'firstName, lastName and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'Invalid email address.' });
  }

  const fullName = (firstName + ' ' + lastName).trim();

  try {
    // 1) Notify the founder
    GmailApp.sendEmail(
      FOUNDER_EMAIL,
      'New Lead — ' + fullName + ' · ' + (status || 'Status not provided'),
      leadEmailText({ firstName, lastName, email, phone, status, message }),
      {
        htmlBody: leadEmailHtml({ firstName, lastName, email, phone, status, message }),
        replyTo:  email,
        name:     FROM_BRAND + ' Leads'
      }
    );

    // 2) Welcome the lead
    GmailApp.sendEmail(
      email,
      'Welcome to FaithBridge — we will be in touch shortly',
      welcomeEmailText({ firstName }),
      {
        htmlBody: welcomeEmailHtml({ firstName }),
        replyTo:  FOUNDER_EMAIL,
        name:     FOUNDER_NAME + ' · ' + FROM_BRAND
      }
    );

    // 3) Optional Google Sheet log
    if (SHEET_ID) {
      try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        let sheet = ss.getSheetByName(SHEET_TAB);
        if (!sheet) {
          sheet = ss.insertSheet(SHEET_TAB);
          sheet.appendRow(['Timestamp', 'First Name', 'Last Name', 'Email', 'Phone', 'Investor Status', 'Note']);
        }
        sheet.appendRow([new Date(), firstName, lastName, email, phone, status, message]);
      } catch (sheetErr) {
        // Don't fail the request if logging fails — the emails already sent.
        console.warn('Sheet logging failed:', sheetErr);
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Send failed:', err);
    return json({ ok: false, error: 'Email send failed. Please email invest@faithbridge.capital directly.' });
  }
}

// Health check — visit the deployment URL in a browser to confirm it's live.
function doGet() {
  return json({ ok: true, message: 'FaithBridge form endpoint is live.' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Email templates ---------- */

function leadEmailHtml(p) {
  const row = function(label, value, isLast) {
    var border = isLast ? '' : 'border-bottom:1px solid rgba(14,42,46,0.07);';
    return '<tr>' +
      '<td style="padding:12px 0;' + border + 'width:140px;color:rgba(11,26,20,0.55);font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:500;">' + label + '</td>' +
      '<td style="padding:12px 0;' + border + 'color:#0E2A2E;font-weight:500;">' + value + '</td>' +
    '</tr>';
  };
  var noteBlock = p.message
    ? '<tr><td style="padding:8px 36px 28px;">' +
        '<div style="background:#F4EFE6;border-left:2px solid #D4A84A;padding:18px 20px;font-size:14px;line-height:1.7;color:#0E2A2E;">' +
          '<div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#B68A2E;font-weight:600;margin-bottom:8px;">Their Note</div>' +
          esc(p.message).replace(/\n/g, '<br>') +
        '</div>' +
      '</td></tr>'
    : '<tr><td style="padding:8px 36px 28px;"></td></tr>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#F4EFE6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0E2A2E;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;padding:40px 16px;">' +
        '<tr><td align="center">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid rgba(14,42,46,0.08);">' +
            '<tr><td style="padding:36px 36px 18px;border-bottom:1px solid rgba(212,168,74,0.35);">' +
              '<div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#B68A2E;font-weight:600;">FaithBridge Capital · New Lead</div>' +
            '</td></tr>' +
            '<tr><td style="padding:30px 36px 8px;">' +
              '<h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;margin:0 0 8px;color:#0E2A2E;line-height:1.25;">A new partner just reached out.</h1>' +
              '<p style="margin:0 0 22px;font-size:14px;color:rgba(11,26,20,0.65);line-height:1.6;">Hit Reply on this email and your message goes straight to ' + esc(p.firstName) + '.</p>' +
            '</td></tr>' +
            '<tr><td style="padding:0 36px 8px;">' +
              '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">' +
                row('Name', esc(p.firstName) + ' ' + esc(p.lastName)) +
                row('Email', '<a href="mailto:' + esc(p.email) + '" style="color:#0E2A2E;">' + esc(p.email) + '</a>') +
                row('Phone', p.phone ? '<a href="tel:' + esc(p.phone) + '" style="color:#0E2A2E;">' + esc(p.phone) + '</a>' : '—') +
                row('Investor Status', esc(p.status) || '—', true) +
              '</table>' +
            '</td></tr>' +
            noteBlock +
            '<tr><td style="padding:24px 36px 32px;border-top:1px solid rgba(14,42,46,0.06);font-size:11px;line-height:1.6;color:rgba(11,26,20,0.5);">' +
              'Submitted via faithbridge.capital · ' + new Date().toLocaleString('en-US') +
            '</td></tr>' +
          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</body></html>';
}

function leadEmailText(p) {
  return [
    'FaithBridge Capital — New Lead',
    '',
    'Name:            ' + p.firstName + ' ' + p.lastName,
    'Email:           ' + p.email,
    'Phone:           ' + (p.phone || '—'),
    'Investor Status: ' + (p.status || '—'),
    '',
    'Note:',
    p.message || '—',
    '',
    'Reply directly to this email to reach the lead.'
  ].join('\n');
}

function welcomeEmailHtml(p) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#F4EFE6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0E2A2E;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;padding:48px 16px;">' +
        '<tr><td align="center">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid rgba(14,42,46,0.08);">' +
            '<tr><td align="center" style="padding:40px 40px 28px;border-bottom:1px solid rgba(212,168,74,0.4);">' +
              '<div style="font-family:Georgia,serif;font-size:20px;letter-spacing:0.34em;color:#0E2A2E;font-weight:500;">FAITHBRIDGE</div>' +
              '<div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#B68A2E;margin-top:10px;font-weight:500;">A Private Multifamily Partnership</div>' +
            '</td></tr>' +
            '<tr><td style="padding:40px 44px 8px;">' +
              '<h1 style="font-family:Georgia,serif;font-size:34px;font-weight:300;margin:0 0 26px;color:#0E2A2E;line-height:1.2;">Welcome, ' + esc(p.firstName) + '.</h1>' +
              '<p style="font-size:16px;line-height:1.75;color:#0E2A2E;margin:0 0 18px;">' +
                'Thank you for reaching out to FaithBridge Capital. Your details are in front of me, and I will be in touch personally within two business days — no automation, no list, no pressure.' +
              '</p>' +
              '<p style="font-size:16px;line-height:1.75;color:#0E2A2E;margin:0 0 14px;">In the meantime, three things to expect:</p>' +
              '<ul style="font-size:15.5px;line-height:1.85;color:#0E2A2E;padding-left:20px;margin:0 0 26px;">' +
                '<li>A short conversation to understand what you are building, and whether what we offer fits.</li>' +
                '<li>If it does, full materials on our current Harmony Grove offering — underwriting, market thesis, sponsor track record.</li>' +
                '<li>If it does not, an honest "not yet" and a referral if we can help you find one.</li>' +
              '</ul>' +
              '<p style="font-size:16px;line-height:1.75;color:#0E2A2E;margin:0 0 36px;">' +
                'Wealth that endures beyond your lifetime is not built on hype. It is built on the right partners, on the right terms, on the right day. I am glad you are here.' +
              '</p>' +
            '</td></tr>' +
            '<tr><td style="padding:0 44px 36px;">' +
              '<div style="border-top:1px solid rgba(212,168,74,0.4);padding-top:22px;">' +
                '<div style="font-family:Georgia,serif;font-style:italic;color:#B68A2E;font-size:20px;">— Dr. Ntiense Robin, DNAP, CRNA</div>' +
                '<div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(11,26,20,0.55);margin-top:6px;font-weight:500;">Founder &amp; Chief Executive Officer</div>' +
              '</div>' +
            '</td></tr>' +
          '</table>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin-top:20px;">' +
            '<tr><td style="padding:0 16px;font-size:11px;line-height:1.7;color:rgba(11,26,20,0.45);text-align:center;">' +
              'FaithBridge Capital is a private partnership. Offerings are extended only to accredited investors under Reg D, Rule 501(a). This email is informational and does not constitute an offer to sell securities. Past performance is not indicative of future results.' +
            '</td></tr>' +
          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</body></html>';
}

function welcomeEmailText(p) {
  return [
    'Welcome, ' + p.firstName + '.',
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
    'Founder & Chief Executive Officer, FaithBridge Capital'
  ].join('\n');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
