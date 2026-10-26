import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import type { NotificationRowVM } from './notification-copy';
import { NotificationsScreen, type NotificationsScreenProps } from './notifications-screen';

const ROWS: NotificationRowVM[] = [
  {
    id: 'payment_due:BK-1',
    title: 'Finish payment for Ha Giang Loop',
    body: "Your seat isn't secured until payment is complete.",
    imageUrl: null,
    icon: 'credit-card',
    unread: true,
  },
  {
    id: 'departing:BK-2',
    title: 'Hoi An Lantern Evening is coming up',
    body: 'Departs in 5 days',
    imageUrl: null,
    icon: 'calendar',
    unread: false,
  },
];

function baseProps(overrides: Partial<NotificationsScreenProps> = {}): NotificationsScreenProps {
  return {
    status: 'content',
    rows: ROWS,
    unreadCount: 1,
    markAllLabel: 'Mark all as read',
    onMarkAllRead: jest.fn(),
    onRowPress: jest.fn(),
    unreadLabel: 'Unread',
    emptyTitle: "You're all caught up",
    emptyBody: 'Trip reminders and review updates will show up here.',
    errorTitle: "Couldn't load notifications.",
    retryLabel: 'Try again',
    onRetry: jest.fn(),
    ...overrides,
  };
}

describe('NotificationsScreen', () => {
  it('vẽ từng thông báo; chỉ thông báo chưa đọc có chấm', async () => {
    await renderWithTheme(<NotificationsScreen {...baseProps()} />);

    expect(screen.getByText('Finish payment for Ha Giang Loop')).toBeTruthy();
    expect(screen.getByText('Departs in 5 days')).toBeTruthy();
    expect(screen.getAllByTestId('notification-unread-dot')).toHaveLength(1);
  });

  it('dòng chưa đọc báo "Unread" cho trình đọc màn hình', async () => {
    await renderWithTheme(<NotificationsScreen {...baseProps()} />);

    expect(screen.getByLabelText(/Finish payment for Ha Giang Loop\..*\. Unread$/)).toBeTruthy();
    expect(screen.getByLabelText(/Hoi An Lantern Evening is coming up\.[^.]*days$/)).toBeTruthy();
  });

  it('bấm một dòng gọi onRowPress với id của nó', async () => {
    const onRowPress = jest.fn();
    await renderWithTheme(<NotificationsScreen {...baseProps({ onRowPress })} />);

    await fireEvent.press(screen.getByText('Departs in 5 days'));
    expect(onRowPress).toHaveBeenCalledWith('departing:BK-2');
  });

  it('có chưa đọc thì hiện "Mark all as read" và bấm gọi onMarkAllRead; hết chưa đọc thì ẩn', async () => {
    const onMarkAllRead = jest.fn();
    const { rerender } = await renderWithTheme(
      <NotificationsScreen {...baseProps({ onMarkAllRead })} />,
    );

    await fireEvent.press(screen.getByText('Mark all as read'));
    expect(onMarkAllRead).toHaveBeenCalled();

    await rerender(<NotificationsScreen {...baseProps({ unreadCount: 0 })} />);
    expect(screen.queryByText('Mark all as read')).toBeNull();
  });

  it('rỗng: câu "all caught up"; lỗi: câu lỗi + nút thử lại; đang tải: không có hàng nào', async () => {
    const onRetry = jest.fn();
    const { rerender } = await renderWithTheme(
      <NotificationsScreen {...baseProps({ rows: [], unreadCount: 0 })} />,
    );
    expect(screen.getByText("You're all caught up")).toBeTruthy();

    await rerender(<NotificationsScreen {...baseProps({ status: 'error', onRetry })} />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();

    await rerender(<NotificationsScreen {...baseProps({ status: 'loading' })} />);
    expect(screen.queryByText('Finish payment for Ha Giang Loop')).toBeNull();
  });
});
