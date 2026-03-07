import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../lib/utils';
import {
  ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  renderAnnouncementContentHtml,
} from '../../lib/announcementHtml';

export function AnnouncementContent({ content, contentFormat = ANNOUNCEMENT_CONTENT_FORMAT_TEXT, className }) {
  const renderedHtml = useMemo(
    () => renderAnnouncementContentHtml(content, contentFormat),
    [content, contentFormat]
  );

  return (
    <div
      className={cn(
        'space-y-3 break-words text-sm leading-7 text-gray-700 dark:text-slate-200 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 dark:[&_blockquote]:border-slate-700 [&_blockquote]:pl-4 [&_blockquote]:text-slate-700 dark:[&_blockquote]:text-slate-300 [&_caption]:mb-2 [&_caption]:text-left [&_caption]:text-xs [&_caption]:text-muted-foreground [&_code]:rounded [&_code]:bg-gray-100 dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-rose-700 dark:[&_code]:text-slate-100 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-gray-900 dark:[&_h1]:text-slate-50 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 dark:[&_h2]:text-slate-50 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 dark:[&_h3]:text-slate-100 [&_h4]:text-sm [&_h4]:font-semibold dark:[&_h4]:text-slate-100 [&_hr]:my-4 [&_hr]:border-gray-200 dark:[&_hr]:border-slate-700 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-slate-800 [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-slate-50 dark:[&_pre]:border-slate-700 dark:[&_pre]:bg-slate-950 dark:[&_pre]:text-slate-50 [&_pre_code]:!bg-transparent [&_pre_code]:!px-0 [&_pre_code]:!py-0 [&_pre_code]:!text-slate-50 [&_pre_code]:shadow-none [&_pre_code]:font-mono [&_table]:w-full [&_table]:border-collapse [&_tbody_tr:not(:last-child)]:border-b [&_tbody_tr:not(:last-child)]:border-gray-200 dark:[&_tbody_tr:not(:last-child)]:border-slate-700 [&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-slate-700 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-slate-700 [&_th]:bg-gray-100 dark:[&_th]:bg-slate-800/80 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:text-slate-100 [&_thead]:border-b [&_thead]:border-gray-200 dark:[&_thead]:border-slate-700 [&_ul]:list-disc',
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

AnnouncementContent.propTypes = {
  content: PropTypes.string,
  contentFormat: PropTypes.oneOf(['text', 'html']),
  className: PropTypes.string,
};