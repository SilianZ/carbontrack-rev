import Silian_React, { useMemo as Silian_useMemo } from 'react';
import Silian_PropTypes from 'prop-types';
import { cn as Silian_cn } from '../../lib/utils';
import { ANNOUNCEMENT_CONTENT_FORMAT_TEXT as Silian_ANNOUNCEMENT_CONTENT_FORMAT_TEXT } from '../../lib/announcementHtml';
import { renderAnnouncementEmailPreviewHtml as Silian_renderAnnouncementEmailPreviewHtml } from '../../lib/announcementEmailPreview';

export function AnnouncementEmailPreview({
  title: Silian_title,
  content: Silian_content,
  contentFormat: Silian_contentFormat = Silian_ANNOUNCEMENT_CONTENT_FORMAT_TEXT,
  priority: Silian_priority = 'normal',
  className: Silian_className,
}) {
  const Silian_srcDoc = Silian_useMemo(
    () => Silian_renderAnnouncementEmailPreviewHtml({ title: Silian_title, content: Silian_content, contentFormat: Silian_contentFormat, priority: Silian_priority }),
    [Silian_title, Silian_content, Silian_contentFormat, Silian_priority]
  );

  return (
    <div className={Silian_cn('overflow-hidden rounded-lg border bg-white', Silian_className)}>
      <iframe
        title="announcement-email-preview"
        srcDoc={Silian_srcDoc}
        className="h-[640px] w-full bg-white"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

AnnouncementEmailPreview.propTypes = {
  title: Silian_PropTypes.string,
  content: Silian_PropTypes.string,
  contentFormat: Silian_PropTypes.oneOf(['text', 'html']),
  priority: Silian_PropTypes.oneOf(['low', 'normal', 'high', 'urgent']),
  className: Silian_PropTypes.string,
};