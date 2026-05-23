import Silian_React from 'react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { Mail as Silian_Mail, MailOpen as Silian_MailOpen, Eye as Silian_Eye, Trash2 as Silian_Trash2 } from 'lucide-react';
import Silian_PropTypes from 'prop-types';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { isAnnouncementMessage as Silian_isAnnouncementMessage } from '../../lib/messageAnnouncement';

export function MessageList({ messages: Silian_messages, onRowClick: Silian_onRowClick, onMarkRead: Silian_onMarkRead, onDelete: Silian_onDelete }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'messages']);

  const Silian_getStatusIcon = (Silian_is_read) => {
    if (Silian_is_read) {
      return <Silian_MailOpen className="h-4 w-4 text-muted-foreground" />;
    } else {
      return <Silian_Mail className="h-4 w-4 text-primary" />;
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
              {Silian_t('messages.subject')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('messages.content')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('messages.status')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('messages.date')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-transparent">
          {Silian_messages.map((Silian_message) => (
            <tr
              key={Silian_message.id}
              className={`transition-colors hover:bg-muted/40 ${!Silian_message.is_read ? 'bg-primary/5' : ''}`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {Silian_getStatusIcon(Silian_message.is_read)}
                  <span className="ml-2 line-clamp-1 text-sm font-medium text-foreground">
                    {Silian_message.title}
                  </span>
                  {Silian_message.priority && (
                    <Silian_Badge
                      variant={Silian_message.sender_id === null ? 'secondary' : 'default'}
                      className="ml-3"
                    >
                      {Silian_t(`messages.priority.${Silian_message.priority}`)}
                    </Silian_Badge>
                  )}
                  {Silian_isAnnouncementMessage(Silian_message) && (
                    <Silian_Badge variant="outline" className="ml-2">
                      {Silian_t('messages.labels.announcement')}
                    </Silian_Badge>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="line-clamp-1 text-sm text-foreground">
                  {Silian_message.content?.slice(0, 120)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {Silian_message.is_read ? Silian_t('messages.read') : Silian_t('messages.unread')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {Silian_formatDateSafe(Silian_message.created_at, 'yyyy-MM-dd HH:mm')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Silian_Button
                  variant="ghost"
                  size="sm"
                  onClick={() => Silian_onRowClick(Silian_message)}
                  className="mr-2"
                >
                  <Silian_Eye className="h-4 w-4 mr-1" /> {Silian_t('common.view')}
                </Silian_Button>
                {!Silian_message.is_read && (
                  <Silian_Button
                    variant="ghost"
                    size="sm"
                    onClick={() => Silian_onMarkRead(Silian_message.id)}
                    className="mr-2"
                  >
                    <Silian_MailOpen className="h-4 w-4 mr-1" /> {Silian_t('messages.markRead')}
                  </Silian_Button>
                )}
                <Silian_Button
                  variant="ghost"
                  size="sm"
                  onClick={() => Silian_onDelete(Silian_message.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Silian_Trash2 className="h-4 w-4 mr-1" /> {Silian_t('common.delete')}
                </Silian_Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

MessageList.propTypes = {
  messages: Silian_PropTypes.arrayOf(Silian_PropTypes.shape({
    id: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]).isRequired,
    is_read: Silian_PropTypes.bool,
    title: Silian_PropTypes.string,
    content: Silian_PropTypes.string,
    created_at: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number, Silian_PropTypes.instanceOf(Date)]),
    priority: Silian_PropTypes.string,
    sender_id: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]),
  })).isRequired,
  onRowClick: Silian_PropTypes.func.isRequired,
  onMarkRead: Silian_PropTypes.func.isRequired,
  onDelete: Silian_PropTypes.func.isRequired,
};
