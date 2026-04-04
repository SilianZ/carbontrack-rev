import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateSafe } from '../../lib/utils';
import { Mail, MailOpen, Eye, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { isAnnouncementMessage } from '../../lib/messageAnnouncement';

export function MessageList({ messages, onRowClick, onMarkRead, onDelete }) {
  const { t } = useTranslation();

  const getStatusIcon = (is_read) => {
    if (is_read) {
      return <MailOpen className="h-4 w-4 text-muted-foreground" />;
    } else {
      return <Mail className="h-4 w-4 text-primary" />;
    }
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/60">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('messages.subject')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('messages.content')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('messages.status')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('messages.date')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-transparent">
          {messages.map((message) => (
            <tr
              key={message.id}
              className={`transition-colors hover:bg-muted/40 ${!message.is_read ? 'bg-primary/5' : ''}`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {getStatusIcon(message.is_read)}
                  <span className="ml-2 line-clamp-1 text-sm font-medium text-foreground">
                    {message.title}
                  </span>
                  {message.priority && (
                    <Badge
                      variant={message.sender_id === null ? 'secondary' : 'default'}
                      className="ml-3"
                    >
                      {t(`messages.priority.${message.priority}`)}
                    </Badge>
                  )}
                  {isAnnouncementMessage(message) && (
                    <Badge variant="outline" className="ml-2">
                      {t('messages.labels.announcement')}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="line-clamp-1 text-sm text-foreground">
                  {message.content?.slice(0, 120)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {message.is_read ? t('messages.read') : t('messages.unread')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {formatDateSafe(message.created_at, 'yyyy-MM-dd HH:mm')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRowClick(message)}
                  className="mr-2"
                >
                  <Eye className="h-4 w-4 mr-1" /> {t('common.view')}
                </Button>
                {!message.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkRead(message.id)}
                    className="mr-2"
                  >
                    <MailOpen className="h-4 w-4 mr-1" /> {t('messages.markRead')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(message.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

MessageList.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    is_read: PropTypes.bool,
    title: PropTypes.string,
    content: PropTypes.string,
    created_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    priority: PropTypes.string,
    sender_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })).isRequired,
  onRowClick: PropTypes.func.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
