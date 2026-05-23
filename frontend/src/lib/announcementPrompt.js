import { ANNOUNCEMENT_CONTENT_FORMAT_HTML as Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML, ALLOWED_ANNOUNCEMENT_TAGS as Silian_ALLOWED_ANNOUNCEMENT_TAGS, ANNOUNCEMENT_SANITIZE_OPTIONS as Silian_ANNOUNCEMENT_SANITIZE_OPTIONS } from './announcementHtml';

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

export function normalizeAnnouncementPromptAction(Silian_value) {
  const Silian_normalized = typeof Silian_value === 'string' ? Silian_value.trim().toLowerCase() : '';
  return ANNOUNCEMENT_PROMPT_ACTIONS.includes(Silian_normalized)
    ? Silian_normalized
    : ANNOUNCEMENT_PROMPT_ACTION_GENERATE;
}

function Silian_buildOutputRules() {
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
    `- Allowed tags: ${Silian_ALLOWED_ANNOUNCEMENT_TAGS.join(', ')}`,
    `- Allowed attributes: ${Silian_ANNOUNCEMENT_SANITIZE_OPTIONS.ALLOWED_ATTR.join(', ')}`,
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
    ...Silian_buildOutputRules().map((Silian_rule) => `- ${Silian_rule}`),
  ].join('\n');
}

function Silian_buildIntentInstructions(Silian_action, Silian_hasContent) {
  switch (Silian_action) {
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
      return Silian_hasContent
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

function Silian_formatPriority(Silian_priority) {
  const Silian_normalized = typeof Silian_priority === 'string' ? Silian_priority.trim().toLowerCase() : 'normal';
  return Silian_normalized || 'normal';
}

function Silian_buildContextLines({ title: Silian_title, content: Silian_content, priority: Silian_priority, contentFormat: Silian_contentFormat }) {
  const Silian_safeTitle = typeof Silian_title === 'string' && Silian_title.trim() ? Silian_title.trim() : '(untitled announcement)';
  const Silian_safeContent = typeof Silian_content === 'string' ? Silian_content.trim() : '';
  const Silian_normalizedFormat = Silian_contentFormat === Silian_ANNOUNCEMENT_CONTENT_FORMAT_HTML ? 'html' : 'text';

  return [
    `Title: ${Silian_safeTitle}`,
    `Priority: ${Silian_formatPriority(Silian_priority)}`,
    `Current content format in editor: ${Silian_normalizedFormat}`,
    Silian_safeContent ? 'Current draft / notes:' : 'Current draft / notes: (empty)',
    Silian_safeContent || '(no existing content yet)',
  ];
}

export function buildAnnouncementUserPrompt({
  action: Silian_action,
  title: Silian_title,
  content: Silian_content,
  priority: Silian_priority,
  contentFormat: Silian_contentFormat,
  instruction: Silian_instruction,
} = {}) {
  const Silian_normalizedAction = normalizeAnnouncementPromptAction(Silian_action);
  const Silian_safeContent = typeof Silian_content === 'string' ? Silian_content.trim() : '';
  const Silian_safeInstruction = typeof Silian_instruction === 'string' ? Silian_instruction.trim() : '';
  const Silian_intentLines = Silian_buildIntentInstructions(Silian_normalizedAction, Boolean(Silian_safeContent));

  const Silian_lines = [
    ...Silian_intentLines,
    '',
    'Project constraints:',
    '- This HTML will be used for both web announcement preview and email preview.',
    '- The result must survive sanitizer cleanup without losing key meaning.',
    '- Prefer headings, paragraphs, lists, blockquotes, code blocks, simple tables, and safe links.',
    '',
    'Context:',
    ...Silian_buildContextLines({ title: Silian_title, content: Silian_content, priority: Silian_priority, contentFormat: Silian_contentFormat }),
  ];

  if (Silian_safeInstruction) {
    Silian_lines.push('', 'Additional admin request:', Silian_safeInstruction);
  }

  Silian_lines.push('', 'Return requirement:', '- Return only the final HTML fragment, nothing else.');

  return Silian_lines.join('\n');
}

export function buildAnnouncementPromptBundle(Silian_options = {}) {
  return [
    '=== SYSTEM PROMPT ===',
    buildAnnouncementSystemPrompt(),
    '',
    '=== USER PROMPT ===',
    buildAnnouncementUserPrompt(Silian_options),
  ].join('\n');
}