import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../lib/utils';
import { ANNOUNCEMENT_CONTENT_FORMAT_TEXT } from '../../lib/announcementHtml';
import { renderAnnouncementEmailPreviewHtml } from '../../lib/announcementEmailPreview';

export function AnnouncementEmailPreview({
  title,
  content,
  contentFormat = ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  priority = 'normal',
  className,
}) {
  const srcDoc = useMemo(
    () => renderAnnouncementEmailPreviewHtml({ title, content, contentFormat, priority }),
    [title, content, contentFormat, priority]
  );

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-white', className)}>
      <iframe
        title="announcement-email-preview"
        srcDoc={srcDoc}
        className="h-[640px] w-full bg-white"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

AnnouncementEmailPreview.propTypes = {
  title: PropTypes.string,
  content: PropTypes.string,
  contentFormat: PropTypes.oneOf(['text', 'html']),
  priority: PropTypes.oneOf(['low', 'normal', 'high', 'urgent']),
  className: PropTypes.string,
};