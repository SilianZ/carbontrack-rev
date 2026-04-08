import React, { useMemo } from 'react';
import { Mail, MailOpen, MessageSquare, Info } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateSafe } from '../../lib/utils';
import { AnnouncementContent } from '../content/AnnouncementContent';
import { contentLooksLikeHtml, normalizeAnnouncementContentFormat } from '../../lib/announcementHtml';
import { isAnnouncementMessage } from '../../lib/messageAnnouncement';
import { sanitizeMessageHtml } from '../../lib/sanitizeMessageHtml';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import PropTypes from 'prop-types';

export function MessageDetailModal({ message, isOpen, onClose, onMarkRead }) {
  const { t } = useTranslation(['common', 'messages']);
  const sanitizedContent = useMemo(() => sanitizeMessageHtml(message?.content), [message?.content]);
  const isAnnouncement = useMemo(() => isAnnouncementMessage(message), [message]);
  const announcementContentFormat = useMemo(
    () => normalizeAnnouncementContentFormat(isAnnouncement && contentLooksLikeHtml(message?.content) ? 'html' : 'text'),
    [isAnnouncement, message?.content]
  );

  if (!isOpen || !message) return null;

  const getStatusBadge = (is_read) => {
    if (is_read) {
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
          <MailOpen className="h-3 w-3 mr-1" /> {t('messages.read')}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Mail className="h-3 w-3 mr-1" /> {t('messages.unread')}
        </span>
      );
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-2xl lg:max-w-3xl">
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
            <DialogTitle className="text-xl">{t('messages.detail.title')}</DialogTitle>
            <DialogDescription>{t('messages.detail.subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              {message.priority && (
                <Badge variant={message.priority}>
                  {t(`messages.priority.${message.priority}`)}
                </Badge>
              )}
              {isAnnouncement && (
                <Badge variant="outline">{t('messages.labels.announcement')}</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('messages.status')}</p>
                {getStatusBadge(message.is_read)}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('messages.date')}</p>
                <p className="text-foreground">{formatDateSafe(message.created_at, 'yyyy-MM-dd HH:mm')}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                <MessageSquare className="mr-2 h-4 w-4" />{t('messages.subject')}
              </h4>
              <p className="rounded-md bg-muted/50 p-3 text-foreground">{message.title}</p>
            </div>
            <div>
              <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                <Info className="mr-2 h-4 w-4" />{t('messages.content')}
              </h4>
              {isAnnouncement ? (
                <AnnouncementContent
                  content={message.content}
                  contentFormat={announcementContentFormat}
                  className="rounded-md bg-muted/50 p-3"
                />
              ) : (
                <div
                  className="rounded-md bg-muted/50 p-3 text-foreground whitespace-pre-wrap break-words [&_a]:text-primary [&_a]:underline [&_pre]:overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                ></div>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t pt-4">
              {!message.is_read && (
                <Button
                  variant="outline"
                  onClick={() => onMarkRead(message.id)}
                  className="mr-2"
                >
                  <MailOpen className="h-4 w-4 mr-1" /> {t('messages.markRead')}
                </Button>
              )}
              <Button onClick={onClose}>{t('common.close')}</Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

MessageDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    is_read: PropTypes.bool.isRequired,
    title: PropTypes.string,
    created_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]).isRequired,
    content: PropTypes.string,
    priority: PropTypes.string,
    sender_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    type: PropTypes.string,
  }),
};
