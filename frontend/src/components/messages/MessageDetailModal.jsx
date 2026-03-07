import React, { useMemo } from 'react';
import { Mail, MailOpen, MessageSquare, Info } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateSafe } from '../../lib/utils';
import { AnnouncementContent } from '../content/AnnouncementContent';
import { contentLooksLikeHtml, normalizeAnnouncementContentFormat } from '../../lib/announcementHtml';
import { sanitizeMessageHtml } from '../../lib/sanitizeMessageHtml';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import PropTypes from 'prop-types';

export function MessageDetailModal({ message, isOpen, onClose, onMarkRead }) {
  const { t } = useTranslation();
  const sanitizedContent = useMemo(() => sanitizeMessageHtml(message?.content), [message?.content]);
  const isAnnouncement = useMemo(() => {
    if (!message) return false;
    if (message.type === 'system' && contentLooksLikeHtml(message.content)) return true;
    if (message.sender_id !== null) return false;
    const title = (message.title || '').toLowerCase();
    return /\b(公告|announcement|system|系统|broadcast|boardcast)\b/i.test(title);
  }, [message]);
  const announcementContentFormat = useMemo(
    () => normalizeAnnouncementContentFormat(isAnnouncement && contentLooksLikeHtml(message?.content) ? 'html' : 'text'),
    [isAnnouncement, message?.content]
  );

  if (!isOpen || !message) return null;

  const getStatusBadge = (is_read) => {
    if (is_read) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <MailOpen className="h-3 w-3 mr-1" /> {t('messages.read')}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Mail className="h-3 w-3 mr-1" /> {t('messages.unread')}
        </span>
      );
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('messages.detail.title')}</DialogTitle>
          <DialogDescription>{t('messages.detail.subtitle')}</DialogDescription>
        </DialogHeader>

          <div className="flex items-center space-x-2">
            {message.priority && (
              <Badge variant={message.priority}>
                {t(`messages.priority.${message.priority}`)}
              </Badge>
            )}
            {isAnnouncement && (
              <Badge variant="outline">{t('messages.labels.announcement')}</Badge>
            )}
          </div>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">{t('messages.status')}</p>
              {getStatusBadge(message.is_read)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('messages.date')}</p>
              <p className="text-gray-900">{formatDateSafe(message.created_at, 'yyyy-MM-dd HH:mm')}</p>
            </div>
          </div>

          {/* 主题和内容 */}
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />{t('messages.subject')}
            </h4>
            <p className="text-gray-900 bg-gray-50 p-3 rounded-md">{message.title}</p>
          </div>
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2" />{t('messages.content')}
            </h4>
            {isAnnouncement ? (
              <AnnouncementContent
                content={message.content}
                contentFormat={announcementContentFormat}
                className="bg-gray-50 rounded-md p-3"
              />
            ) : (
              <div
                className="text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap break-words [&_a]:text-blue-600 [&_a]:underline [&_pre]:overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              ></div>
            )}
          </div>

          {/* 操作按钮 */}
          <DialogFooter className="pt-2">
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

