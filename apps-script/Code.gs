/**
 * FaithBridge Capital, form handler (Google Apps Script)
 *
 * Active role today: log every form submission to a Google Sheet.
 * The browser fires a GET with the form data as query params after the
 * EmailJS sends succeed. GET works in Workspace where POST is blocked.
 *
 * doPost is kept intact as a backup path in case Workspace policy ever
 * loosens (or if you redeploy from a personal Gmail account).
 *
 * After editing this file:
 *   1. Save (Cmd/Ctrl + S)
 *   2. Deploy, Manage deployments, pencil icon, Version: New version, Deploy
 *   3. Re-authorize when prompted (Drive + Gmail + Sheets scopes)
 */

// ===== CONFIGURATION =====
const FOUNDER_EMAIL = 'ntiense@faithbridgecap.com';
const FOUNDER_NAME  = 'Dr. Ntiense Robin';
const FROM_BRAND    = 'FaithBridge Capital';

// Google Sheet logging (the sheet you created in Drive)
const SHEET_ID  = '1qnoxLTvD2EpOQeJ18qOqnwMafTWy3hVUKpMlcptHP0w';
const SHEET_TAB = 'Leads';
// =========================

// GET handler
// - No params (or no firstName): health check
// - With form params: log a row to the sheet
function doGet(e) {
  const hasFormData = e && e.parameter && e.parameter.firstName;
  if (!hasFormData) {
    return json({ ok: true, message: 'FaithBridge form endpoint is live.' });
  }
  try {
    return logToSheet(e.parameter);
  } catch (err) {
    console.error('Sheet logging failed:', err);
    return json({ ok: false, error: err.toString() });
  }
}

// POST handler (backup, not currently used by the live site)
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

  if (honeypot) return json({ ok: true });
  if (!firstName || !lastName || !email) {
    return json({ ok: false, error: 'firstName, lastName and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'Invalid email address.' });
  }

  const fullName = (firstName + ' ' + lastName).trim();

  try {
    GmailApp.sendEmail(
      FOUNDER_EMAIL,
      'New Lead, ' + fullName + ' · ' + (status || 'Status not provided'),
      'See HTML body.',
      { replyTo: email, name: FROM_BRAND + ' Leads' }
    );
    GmailApp.sendEmail(
      email,
      'Welcome to FaithBridge, we will be in touch shortly',
      'See HTML body.',
      { replyTo: FOUNDER_EMAIL, name: FOUNDER_NAME + ' · ' + FROM_BRAND }
    );

    logToSheet({ firstName, lastName, email, phone, status, message });

    return json({ ok: true });
  } catch (err) {
    console.error('Send failed:', err);
    return json({ ok: false, error: 'Send failed.' });
  }
}

// Append one row to the Leads sheet. Creates the tab + header row on first use.
function logToSheet(p) {
  if (!SHEET_ID) return json({ ok: false, error: 'No SHEET_ID set' });

  // Silent bot trap on the GET path too
  const honeypot = ((p.website || p._honey) || '').toString().trim();
  if (honeypot) return json({ ok: true });

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TAB);
    sheet.appendRow(['Timestamp', 'First Name', 'Last Name', 'Email', 'Phone', 'Investor Status', 'Note']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(),
    (p.firstName || '').toString(),
    (p.lastName  || '').toString(),
    (p.email     || '').toString(),
    (p.phone     || '').toString(),
    (p.status    || '').toString(),
    (p.message   || '').toString()
  ]);
  return json({ ok: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
