import { messages } from '@tourism/i18n';
import type { FeatherIconName } from '@tourism/mobile-ui';
import type { AppNotification, NotificationKind } from './notifications';

/** Icon thay ảnh khi thông báo không có ảnh tour. */
const ICONS: Record<NotificationKind, FeatherIconName> = {
  payment_due: 'credit-card',
  on_tour: 'map-pin',
  departing: 'calendar',
  trip_cancelled: 'x-circle',
  refunded: 'credit-card',
  review_prompt: 'star',
  review_rejected: 'edit-3',
  review_approved: 'star',
};

export interface NotificationRowVM {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  icon: FeatherIconName;
  unread: boolean;
}

/** Dòng hiển thị của một thông báo — chữ lấy hết từ `messages.mobile.notifications` (luật 7). */
export function describeNotification(
  notification: AppNotification,
  unread: boolean,
): NotificationRowVM {
  const copy = messages.mobile.notifications;
  const tour = notification.tourTitle ?? copy.fallbackTourTitle;
  const { item } = copy;

  let title: string;
  let body: string;
  switch (notification.kind) {
    case 'payment_due':
      title = item.paymentDue.title(tour);
      body = item.paymentDue.body;
      break;
    case 'on_tour':
      title = item.onTour.title(tour);
      body = item.onTour.body(notification.dayOfTrip ?? 1, notification.totalDays ?? 1);
      break;
    case 'departing':
      title = item.departing.title(tour);
      body = item.departing.body(notification.daysUntil ?? 0);
      break;
    case 'trip_cancelled':
      title = item.tripCancelled.title(tour);
      body = item.tripCancelled.body;
      break;
    case 'refunded':
      title = item.refunded.title(tour);
      body = item.refunded.body;
      break;
    case 'review_prompt':
      title = item.reviewPrompt.title(tour);
      body = item.reviewPrompt.body;
      break;
    case 'review_rejected':
      title = item.reviewRejected.title(tour);
      body = item.reviewRejected.body;
      break;
    case 'review_approved':
      title = item.reviewApproved.title(tour);
      body = item.reviewApproved.body;
      break;
  }

  return {
    id: notification.id,
    title,
    body,
    imageUrl: notification.imageUrl,
    icon: ICONS[notification.kind],
    unread,
  };
}
