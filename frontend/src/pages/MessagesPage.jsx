import Silian_React, { useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { MessageFilters as Silian_MessageFilters } from '../components/messages/MessageFilters';
import { MessageList as Silian_MessageList } from '../components/messages/MessageList';
import { MessageDetailModal as Silian_MessageDetailModal } from '../components/messages/MessageDetailModal';
import { Pagination as Silian_Pagination } from '../components/ui/Pagination';
import { messageAPI as Silian_messageAPI } from '../lib/api';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../components/ui/Alert';
import { AlertCircle as Silian_AlertCircle, Loader2 as Silian_Loader2, MailOpen as Silian_MailOpen, Trash2 as Silian_Trash2 } from 'lucide-react';
import { Button as Silian_Button } from '../components/ui/Button';
import { toast as Silian_toast } from 'react-hot-toast';
import {
  AlertDialog as Silian_AlertDialog,
  AlertDialogAction as Silian_AlertDialogAction,
  AlertDialogCancel as Silian_AlertDialogCancel,
  AlertDialogContent as Silian_AlertDialogContent,
  AlertDialogDescription as Silian_AlertDialogDescription,
  AlertDialogFooter as Silian_AlertDialogFooter,
  AlertDialogHeader as Silian_AlertDialogHeader,
  AlertDialogTitle as Silian_AlertDialogTitle,
} from '../components/ui/alert-dialog';

export default function MessagesPage() {
  const { t: Silian_t } = Silian_useTranslation(['common', 'errors', 'messages', 'pagination']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_filters, Silian_setFilters] = Silian_useState({
    search: '',
    type: '',
    status: '',
    priority: '',
    sort: 'created_at_desc',
    page: 1,
    limit: 10
  });
  const [Silian_selectedMessage, Silian_setSelectedMessage] = Silian_useState(null);
  const [Silian_confirmDialog, Silian_setConfirmDialog] = Silian_useState({
    open: false,
    type: null, // 'delete', 'deleteAll', 'markAllRead'
    data: null,
  });

  const { data: Silian_data, isLoading: Silian_isLoading, error: Silian_error, isFetching: Silian_isFetching } = Silian_useQuery(
    ['messages', Silian_filters],
    () => Silian_messageAPI.getMessages(Silian_filters),
    { keepPreviousData: true }
  );

  const Silian_markReadMutation = Silian_useMutation(
    (Silian_messageId) => Silian_messageAPI.markAsRead(Silian_messageId),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('messages');
        Silian_toast.success(Silian_t('messages.markReadSuccess'));
        if (Silian_selectedMessage) {
          // selectedMessage uses `is_read` boolean in API responses
          Silian_setSelectedMessage(Silian_prev => Silian_prev ? ({ ...Silian_prev, is_read: true }) : Silian_prev);
        }
      },
      onError: () => {
        Silian_toast.error(Silian_t('messages.markReadFailed'));
      }
    }
  );

  const Silian_deleteMutation = Silian_useMutation(
    (Silian_messageId) => Silian_messageAPI.deleteMessage(Silian_messageId),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('messages');
        Silian_toast.success(Silian_t('messages.deleteSuccess'));
        Silian_setSelectedMessage(null);
      },
      onError: () => {
        Silian_toast.error(Silian_t('messages.deleteFailed'));
      }
    }
  );

  const Silian_markAllReadMutation = Silian_useMutation(
    () => Silian_messageAPI.markAllAsRead(),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('messages');
        Silian_toast.success(Silian_t('messages.markAllReadSuccess'));
      },
      onError: () => {
        Silian_toast.error(Silian_t('messages.markAllReadFailed'));
      }
    }
  );

  const Silian_handleFiltersChange = (Silian_newFilters) => {
    Silian_setFilters(Silian_newFilters);
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_handleRowClick = (Silian_message) => {
    Silian_setSelectedMessage(Silian_message);
    // backend message object uses `is_read` boolean
    if (!Silian_message.is_read) {
      Silian_markReadMutation.mutate(Silian_message.id);
    }
  };

  const Silian_closeModal = () => {
    Silian_setSelectedMessage(null);
  };

  const Silian_handleMarkRead = (Silian_messageId) => {
    Silian_markReadMutation.mutate(Silian_messageId);
  };

  const Silian_handleDelete = (Silian_messageId) => {
    Silian_setConfirmDialog({
      open: true,
      type: 'delete',
      data: Silian_messageId
    });
  };

  const Silian_handleMarkAllRead = () => {
    Silian_setConfirmDialog({
      open: true,
      type: 'markAllRead',
      data: null
    });
  };

  const Silian_handleDeleteAll = () => {
    Silian_setConfirmDialog({
      open: true,
      type: 'deleteAll',
      data: null
    });
  };

  const Silian_handleConfirmAction = () => {
    const { type: Silian_type, data: Silian_data } = Silian_confirmDialog;
    if (Silian_type === 'delete') {
      Silian_deleteMutation.mutate(Silian_data);
    } else if (Silian_type === 'markAllRead') {
      Silian_markAllReadMutation.mutate();
    } else if (Silian_type === 'deleteAll') {
      // Implement delete all logic or call a new mutation
      Silian_toast.error(Silian_t('messages.deleteAllNotImplemented'));
    }
    Silian_closeConfirmDialog();
  };

  const Silian_closeConfirmDialog = () => {
    Silian_setConfirmDialog({ open: false, type: null, data: null });
  };

  const Silian_messages = Silian_data?.data?.data || [];
  const Silian_pagination = Silian_data?.data?.pagination || {};

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-tr from-indigo-50/50 via-purple-50/30 to-transparent opacity-50 dark:from-indigo-900/20 dark:via-purple-900/10 dark:opacity-30 pointer-events-none" />

      <div className="container mx-auto py-8 px-4 relative">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">{Silian_t('messages.title')}</h1>
            <p className="text-muted-foreground">{Silian_t('messages.subtitle')}</p>
          </div>
        <div className="flex space-x-2">
          <Silian_Button
            variant="outline"
            onClick={Silian_handleMarkAllRead}
            disabled={Silian_markAllReadMutation.isLoading || Silian_messages.filter(Silian_m => !Silian_m.is_read).length === 0}
          >
            <Silian_MailOpen className="h-4 w-4 mr-2" /> {Silian_t('messages.markAllRead')}
          </Silian_Button>
          <Silian_Button
            variant="destructive"
            onClick={Silian_handleDeleteAll}
            disabled={Silian_messages.length === 0}
          >
            <Silian_Trash2 className="h-4 w-4 mr-2" /> {Silian_t('messages.deleteAll')}
          </Silian_Button>
        </div>
      </div>

      <Silian_MessageFilters
        filters={Silian_filters}
        onFiltersChange={Silian_handleFiltersChange}
        isLoading={Silian_isFetching}
      />

      {Silian_isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : Silian_error ? (
        <Silian_Alert variant="destructive">
          <Silian_AlertCircle className="h-4 w-4" />
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      ) : Silian_messages.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/95 py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{Silian_t('messages.noMessagesFound')}</h3>
          <p className="text-muted-foreground mt-2">{Silian_t('messages.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <Silian_MessageList
            messages={Silian_messages}
            onRowClick={Silian_handleRowClick}
            onMarkRead={Silian_handleMarkRead}
            onDelete={Silian_handleDelete}
          />
          <Silian_Pagination
            currentPage={Silian_pagination.current_page}
            totalPages={Silian_pagination.total_pages}
            onPageChange={Silian_handlePageChange}
            itemsPerPage={Silian_pagination.per_page}
            totalItems={Silian_pagination.total_items}
          />
        </>
      )}

      <Silian_MessageDetailModal
        message={Silian_selectedMessage}
        isOpen={!!Silian_selectedMessage}
        onClose={Silian_closeModal}
        onMarkRead={Silian_handleMarkRead}
      />

      <Silian_AlertDialog open={Silian_confirmDialog.open} onOpenChange={(Silian_open) => !Silian_open && Silian_closeConfirmDialog()}>
        <Silian_AlertDialogContent>
          <Silian_AlertDialogHeader>
            <Silian_AlertDialogTitle>
              {Silian_confirmDialog.type === 'delete' && Silian_t('messages.confirmDeleteTitle')}
              {Silian_confirmDialog.type === 'deleteAll' && Silian_t('messages.confirmDeleteAllTitle')}
              {Silian_confirmDialog.type === 'markAllRead' && Silian_t('messages.confirmMarkAllReadTitle')}
            </Silian_AlertDialogTitle>
            <Silian_AlertDialogDescription>
              {Silian_confirmDialog.type === 'delete' && Silian_t('messages.confirmDelete')}
              {Silian_confirmDialog.type === 'deleteAll' && Silian_t('messages.confirmDeleteAll')}
              {Silian_confirmDialog.type === 'markAllRead' && Silian_t('messages.confirmMarkAllRead')}
            </Silian_AlertDialogDescription>
          </Silian_AlertDialogHeader>
          <Silian_AlertDialogFooter>
            <Silian_AlertDialogCancel onClick={Silian_closeConfirmDialog}>{Silian_t('common.cancel')}</Silian_AlertDialogCancel>
            <Silian_AlertDialogAction onClick={Silian_handleConfirmAction}>{Silian_t('common.confirm')}</Silian_AlertDialogAction>
          </Silian_AlertDialogFooter>
        </Silian_AlertDialogContent>
      </Silian_AlertDialog>
    </div>
    </div>
  );
}
