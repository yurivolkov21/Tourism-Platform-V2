import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import {
  CANCEL_REASON_MAX_LENGTH,
  CancelBookingSheet,
  type CancelBookingSheetProps,
} from './cancel-sheet';

function baseProps(overrides: Partial<CancelBookingSheetProps> = {}): CancelBookingSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    title: 'Cancel this booking?',
    body: "You're inside the free-cancellation window, so you get the full amount back.",
    refundLabel: 'Refund',
    refundAmount: '$1,377',
    reasonLabel: 'Why are you cancelling? (optional)',
    reason: '',
    onChangeReason: jest.fn(),
    confirmLabel: 'Cancel and refund $1,377',
    dismissLabel: 'Keep booking',
    pending: false,
    error: null,
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe('CancelBookingSheet', () => {
  it('ô lý do giới hạn đúng 1000 ký tự như contract', async () => {
    await renderWithTheme(
      <CancelBookingSheet {...baseProps({ reasonPlaceholder: 'Tell us what changed…' })} />,
    );

    expect(CANCEL_REASON_MAX_LENGTH).toBe(1000);
    expect(screen.getByDisplayValue('').props.maxLength).toBe(1000);
  });

  it('T6 — vẽ khối hoàn tiền và ô lý do', async () => {
    await renderWithTheme(<CancelBookingSheet {...baseProps()} />);

    expect(screen.getByText('Refund')).toBeTruthy();
    expect(screen.getByText('$1,377')).toBeTruthy();
    expect(screen.getByText('Cancel and refund $1,377')).toBeTruthy();
  });

  it('bấm nút xác nhận gọi onConfirm', async () => {
    const onConfirm = jest.fn();
    await renderWithTheme(<CancelBookingSheet {...baseProps({ onConfirm })} />);

    fireEvent.press(screen.getByText('Cancel and refund $1,377'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('T7 (quá hạn) — không khối hoàn tiền dương, có dòng liên hệ', async () => {
    const onContact = jest.fn();
    await renderWithTheme(
      <CancelBookingSheet
        {...baseProps({
          refundAmount: '$0',
          confirmLabel: 'Cancel without refund',
          contactLine: { prompt: 'Something serious happened? Contact us', onPress: onContact },
        })}
      />,
    );

    expect(screen.getByText('$0')).toBeTruthy();
    fireEvent.press(screen.getByText('Something serious happened? Contact us'));
    expect(onContact).toHaveBeenCalled();
  });

  it('huỷ booking PENDING — vắng refund/reason thì không vẽ hai khối đó', async () => {
    await renderWithTheme(
      <CancelBookingSheet
        {...baseProps({
          refundLabel: undefined,
          refundAmount: undefined,
          reasonLabel: undefined,
          reason: undefined,
          onChangeReason: undefined,
          body: 'This releases your pending reservation. You can book again any time.',
          confirmLabel: 'Yes, cancel it',
        })}
      />,
    );

    expect(screen.queryByText('Refund')).toBeNull();
    expect(screen.getByText('Yes, cancel it')).toBeTruthy();
  });

  it('có lỗi thì hiện FormMessage', async () => {
    await renderWithTheme(
      <CancelBookingSheet {...baseProps({ error: 'Something went wrong. Please try again.' })} />,
    );

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
  });
});
