import {
  ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  renderAnnouncementContentHtml,
} from './announcementHtml';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildPriorityNotice(priority) {
  const normalized = String(priority ?? '').trim().toLowerCase();
  if (normalized === 'urgent') {
    return 'This announcement is marked as urgent. Please review it as soon as possible.';
  }
  if (normalized === 'high') {
    return 'This announcement is marked as high priority.';
  }
  return '';
}

export function renderAnnouncementEmailPreviewHtml({
  title,
  content,
  contentFormat = ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  priority = 'normal',
  appName = 'CarbonTrack',
  supportEmail = 'support@example.com',
}) {
  const safeTitle = escapeHtml(title || 'Announcement preview');
  const safeAppName = escapeHtml(appName);
  const safeSupportEmail = escapeHtml(supportEmail);
  const priorityNotice = buildPriorityNotice(priority);
  const announcementBody = renderAnnouncementContentHtml(content, contentFormat);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", sans-serif;
      background-color: #f5f7fa;
      color: #1f2a37;
    }
    .email-wrapper {
      max-width: 640px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
    }
    .email-header {
      padding: 32px 32px 16px;
      background: linear-gradient(135deg, #0ea5e9, #14b8a6);
      color: #ffffff;
    }
    .brand {
      font-size: 16px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
      margin: 0 0 12px 0;
    }
    .email-header h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.25;
      font-weight: 600;
    }
    .email-body {
      padding: 32px;
      color: #1f2a37;
      font-size: 16px;
      line-height: 1.6;
    }
    .email-body p { margin: 0 0 16px 0; }
    .announcement-shell {
      margin: 16px 0;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
    }
    .priority-notice {
      margin: 0 0 16px 0;
      color: #dc2626;
      font-weight: 600;
    }
    .announcement-body a { color: #0ea5e9; text-decoration: none; }
    .announcement-body blockquote {
      margin: 0 0 16px 0;
      padding-left: 12px;
      border-left: 4px solid #dbeafe;
      color: #334155;
    }
    .announcement-body pre {
      overflow-x: auto;
      border-radius: 8px;
      background: #0f172a;
      color: #e2e8f0;
      padding: 12px;
      font-size: 13px;
    }
    .announcement-body table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .announcement-body th,
    .announcement-body td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }
    .announcement-body th { background: #f8fafc; }
    .cta-button {
      display: inline-block;
      margin-top: 12px;
      padding: 12px 24px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      color: #ffffff !important;
      background-color: #0ea5e9;
    }
    .email-footer {
      padding: 24px 32px 32px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
      text-align: center;
    }
    .email-footer a {
      color: #0ea5e9;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <header class="email-header">
      <p class="brand">${safeAppName}</p>
      <h1>${safeTitle}</h1>
    </header>
    <main class="email-body">
      <p>Hello ${safeAppName} community member,</p>
      ${priorityNotice ? `<p class="priority-notice">${escapeHtml(priorityNotice)}</p>` : ''}
      <p>${safeAppName} has published a new announcement:</p>
      <div class="announcement-shell">
        <h2 style="margin:0 0 12px 0;font-size:18px;color:#0f172a;">${safeTitle}</h2>
        <div class="announcement-body">${announcementBody}</div>
      </div>
      <p>You can review the announcement in your inbox at any time.</p>
      <a class="cta-button" href="#">View announcements</a>
    </main>
    <footer class="email-footer">
      <p>&copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p>
      <p>For assistance contact <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a></p>
    </footer>
  </div>
</body>
</html>`;
}