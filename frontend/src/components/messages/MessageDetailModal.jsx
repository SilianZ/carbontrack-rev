import Silian_React, { useMemo as Silian_useMemo } from 'react';
import { Mail as Silian_Mail, MailOpen as Silian_MailOpen, MessageSquare as Silian_MessageSquare, Info as Silian_Info } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { AnnouncementContent as Silian_AnnouncementContent } from '../content/AnnouncementContent';
import { contentLooksLikeHtml as Silian_contentLooksLikeHtml, normalizeAnnouncementContentFormat as Silian_normalizeAnnouncementContentFormat } from '../../lib/announcementHtml';
import { isAnnouncementMessage as Silian_isAnnouncementMessage } from '../../lib/messageAnnouncement';
import { sanitizeMessageHtml as Silian_sanitizeMessageHtml } from '../../lib/sanitizeMessageHtml';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogDescription as Silian_DialogDescription, DialogFooter as Silian_DialogFooter, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '../ui/dialog';
import Silian_PropTypes from 'prop-types';

export function MessageDetailModal({ message: Silian_message, isOpen: Silian_isOpen, onClose: Silian_onClose, onMarkRead: Silian_onMarkRead }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'messages']);
  const Silian_sanitizedContent = Silian_useMemo(() => Silian_sanitizeMessageHtml(Silian_message?.content), [Silian_message?.content]);
  const Silian_isAnnouncement = Silian_useMemo(() => Silian_isAnnouncementMessage(Silian_message), [Silian_message]);
  const Silian_announcementContentFormat = Silian_useMemo(
    () => Silian_normalizeAnnouncementContentFormat(Silian_isAnnouncement && Silian_contentLooksLikeHtml(Silian_message?.content) ? 'html' : 'text'),
    [Silian_isAnnouncement, Silian_message?.content]
  );

  if (!Silian_isOpen || !Silian_message) return null;

  const Silian_getStatusBadge = (Silian_is_read) => {
    if (Silian_is_read) {
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
          <Silian_MailOpen className="h-3 w-3 mr-1" /> {Silian_t('messages.read')}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Silian_Mail className="h-3 w-3 mr-1" /> {Silian_t('messages.unread')}
        </span>
      );
    }
  };
  return (
    <Silian_Dialog open={Silian_isOpen} onOpenChange={(Silian_open) => { if (!Silian_open) Silian_onClose?.(); }}>
      <Silian_DialogContent className="w-[calc(100vw-1.5rem)] max-w-none overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-2xl lg:max-w-3xl">
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <Silian_DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
            <Silian_DialogTitle className="text-xl">{Silian_t('messages.detail.title')}</Silian_DialogTitle>
            <Silian_DialogDescription>{Silian_t('messages.detail.subtitle')}</Silian_DialogDescription>
          </Silian_DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              {Silian_message.priority && (
                <Silian_Badge variant={Silian_message.priority}>
                  {Silian_t(`messages.priority.${Silian_message.priority}`)}
                </Silian_Badge>
              )}
              {Silian_isAnnouncement && (
                <Silian_Badge variant="outline">{Silian_t('messages.labels.announcement')}</Silian_Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('messages.status')}</p>
                {Silian_getStatusBadge(Silian_message.is_read)}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('messages.date')}</p>
                <p className="text-foreground">{Silian_formatDateSafe(Silian_message.created_at, 'yyyy-MM-dd HH:mm')}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                <Silian_MessageSquare className="mr-2 h-4 w-4" />{Silian_t('messages.subject')}
              </h4>
              <p className="rounded-md bg-muted/50 p-3 text-foreground">{Silian_message.title}</p>
            </div>
            <div>
              <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                <Silian_Info className="mr-2 h-4 w-4" />{Silian_t('messages.content')}
              </h4>
              {Silian_isAnnouncement ? (
                <Silian_AnnouncementContent
                  content={Silian_message.content}
                  contentFormat={Silian_announcementContentFormat}
                  className="rounded-md bg-muted/50 p-3"
                />
              ) : (
                <div
                  className="rounded-md bg-muted/50 p-3 text-foreground whitespace-pre-wrap break-words [&_a]:text-primary [&_a]:underline [&_pre]:overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: Silian_sanitizedContent }}
                ></div>
              )}
            </div>

            <Silian_DialogFooter className="shrink-0 border-t pt-4">
              {!Silian_message.is_read && (
                <Silian_Button
                  variant="outline"
                  onClick={() => Silian_onMarkRead(Silian_message.id)}
                  className="mr-2"
                >
                  <Silian_MailOpen className="h-4 w-4 mr-1" /> {Silian_t('messages.markRead')}
                </Silian_Button>
              )}
              <Silian_Button onClick={Silian_onClose}>{Silian_t('common.close')}</Silian_Button>
            </Silian_DialogFooter>
          </div>
        </div>
      </Silian_DialogContent>
    </Silian_Dialog>
  );
}

MessageDetailModal.propTypes = {
  isOpen: Silian_PropTypes.bool.isRequired,
  onClose: Silian_PropTypes.func.isRequired,
  onMarkRead: Silian_PropTypes.func.isRequired,
  message: Silian_PropTypes.shape({
    id: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]).isRequired,
    is_read: Silian_PropTypes.bool.isRequired,
    title: Silian_PropTypes.string,
    created_at: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number, Silian_PropTypes.instanceOf(Date)]).isRequired,
    content: Silian_PropTypes.string,
    priority: Silian_PropTypes.string,
    sender_id: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]),
    type: Silian_PropTypes.string,
  }),
};
