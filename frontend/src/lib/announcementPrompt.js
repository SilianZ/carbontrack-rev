import { ANNOUNCEMENT_CONTENT_FORMAT_HTML } from './announcementHtml';

export const ANNOUNCEMENT_PROMPT_ACTION_GENERATE = 'generate';
export const ANNOUNCEMENT_PROMPT_ACTION_REWRITE = 'rewrite';
export const ANNOUNCEMENT_PROMPT_ACTION_COMPRESS = 'compress';
export const ANNOUNCEMENT_PROMPT_ACTION_CONVERT = 'convert';

export const ANNOUNCEMENT_PROMPT_ACTIONS = [
  ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  ANNOUNCEMENT_PROMPT_ACTION_REWRITE,
  ANNOUNCEMENT_PROMPT_ACTION_COMPRESS,
  ANNOUNCEMENT_PROMPT_ACTION_CONVERT,
];

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4',
  'p', 'br',
  'strong', 'em', 'u',
  'ul', 'ol', 'li',
  'blockquote',
  'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'hr',
];

const ALLOWED_ATTRIBUTES = [
  'href', 'title', 'target', 'rel',
  'scope', 'colspan', 'rowspan', 'align',
];

export function normalizeAnnouncementPromptAction(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ANNOUNCEMENT_PROMPT_ACTIONS.includes(normalized)
    ? normalized
    : ANNOUNCEMENT_PROMPT_ACTION_GENERATE;
}

function buildOutputRules() {
  return [
    'Output only the final HTML fragment.',
    'Do not wrap the answer in Markdown code fences.',
    'Do not include <html>, <head>, <body>, <style>, <script>, <iframe>, <img>, <video>, <audio>, <form>, or inline event handlers.',
    'Keep the structure semantic and concise.',
    'Use only safe links with absolute https:// URLs when links are necessary.',
    'Do not invent facts, dates, prices, or promises that are not present in the input.',
    'If information is missing, write a neutral placeholder sentence instead of hallucinating details.',
  ];
}

export function buildAnnouncementSystemPrompt() {
  return [
    'You are an announcement HTML editor for an admin broadcast system.',
    'Your task is to produce SAFE, SANITIZED-FRIENDLY announcement HTML that can be rendered in both a web inbox and an email preview.',
    '',
    'Announcement HTML profile:',
    `- Allowed tags: ${ALLOWED_TAGS.join(', ')}`,
    `- Allowed attributes: ${ALLOWED_ATTRIBUTES.join(', ')}`,
    '- No custom CSS, no <style>, no class attribute, no inline style attribute.',
    '- No JavaScript, no event handlers, no embedded media, no remote assets.',
    '- Tables may be used only for simple announcement data, not for full-page layout hacks.',
    '- Code blocks must use <pre><code>...</code></pre>.',
    '- Links must use descriptive anchor text, not raw URLs unless unavoidable.',
    '',
    'Writing goals:',
    '- Preserve meaning across web and email rendering.',
    '- Prefer readable headings, short paragraphs, lists, and simple tables.',
    '- Keep tone professional, trustworthy, and clear.',
    '- Match urgency to the provided priority but avoid fearmongering.',
    '',
    'Hard output rules:',
    ...buildOutputRules().map((rule) => `- ${rule}`),
  ].join('\n');
}

function buildIntentInstructions(action, hasContent) {
  switch (action) {
    case ANNOUNCEMENT_PROMPT_ACTION_REWRITE:
      return [
        'Task: polish and rewrite the existing announcement HTML.',
        '- Preserve all confirmed facts.',
        '- Improve clarity, structure, and readability.',
        '- Keep the output safe and within the allowed HTML profile.',
      ];
    case ANNOUNCEMENT_PROMPT_ACTION_COMPRESS:
      return [
        'Task: compress the existing announcement into a shorter version.',
        '- Keep only the most important actionable information.',
        '- Preserve all required dates, deadlines, and user actions if they exist.',
        '- Use concise HTML structure.',
      ];
    case ANNOUNCEMENT_PROMPT_ACTION_CONVERT:
      return [
        'Task: convert the provided plain text or rough notes into announcement HTML.',
        '- Organize the material into clear sections.',
        '- Preserve the original meaning and avoid adding new facts.',
      ];
    case ANNOUNCEMENT_PROMPT_ACTION_GENERATE:
    default:
      return hasContent
        ? [
            'Task: generate a refined announcement HTML draft from the provided title and notes.',
            '- Use the supplied notes as the content source of truth.',
            '- Fill only structural gaps, not factual gaps.',
          ]
        : [
            'Task: generate a first-draft announcement HTML fragment from the provided title and constraints.',
            '- If the input lacks details, produce a generic but honest draft and clearly avoid fabricated specifics.',
          ];
  }
}

function formatPriority(priority) {
  const normalized = typeof priority === 'string' ? priority.trim().toLowerCase() : 'normal';
  return normalized || 'normal';
}

function buildContextLines({ title, content, priority, contentFormat }) {
  const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : '(untitled announcement)';
  const safeContent = typeof content === 'string' ? content.trim() : '';
  const normalizedFormat = contentFormat === ANNOUNCEMENT_CONTENT_FORMAT_HTML ? 'html' : 'text';

  return [
    `Title: ${safeTitle}`,
    `Priority: ${formatPriority(priority)}`,
    `Current content format in editor: ${normalizedFormat}`,
    safeContent ? 'Current draft / notes:' : 'Current draft / notes: (empty)',
    safeContent || '(no existing content yet)',
  ];
}

export function buildAnnouncementUserPrompt({
  action,
  title,
  content,
  priority,
  contentFormat,
  instruction,
} = {}) {
  const normalizedAction = normalizeAnnouncementPromptAction(action);
  const safeContent = typeof content === 'string' ? content.trim() : '';
  const safeInstruction = typeof instruction === 'string' ? instruction.trim() : '';
  const intentLines = buildIntentInstructions(normalizedAction, Boolean(safeContent));

  const lines = [
    ...intentLines,
    '',
    'Project constraints:',
    '- This HTML will be used for both web announcement preview and email preview.',
    '- The result must survive sanitizer cleanup without losing key meaning.',
    '- Prefer headings, paragraphs, lists, blockquotes, code blocks, simple tables, and safe links.',
    '',
    'Context:',
    ...buildContextLines({ title, content, priority, contentFormat }),
  ];

  if (safeInstruction) {
    lines.push('', 'Additional admin request:', safeInstruction);
  }

  lines.push('', 'Return requirement:', '- Return only the final HTML fragment, nothing else.');

  return lines.join('\n');
}

export function buildAnnouncementPromptBundle(options = {}) {
  return [
    '=== SYSTEM PROMPT ===',
    buildAnnouncementSystemPrompt(),
    '',
    '=== USER PROMPT ===',
    buildAnnouncementUserPrompt(options),
  ].join('\n');
}