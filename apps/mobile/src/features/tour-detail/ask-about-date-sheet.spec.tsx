import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { AskAboutDateSheet, type AskAboutDateSheetProps } from './ask-about-date-sheet';

function baseProps(overrides: Partial<AskAboutDateSheetProps> = {}): AskAboutDateSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    title: 'Ask about this date',
    description: 'This departure (Sat 26 Sep – Tue 29 Sep) is closed for booking.',
    nameLabel: 'Full name',
    emailLabel: 'Email',
    messageLabel: 'Your message',
    values: { name: '', email: '', message: '' },
    errors: {},
    onChange: jest.fn(),
    submitLabel: 'Send message',
    submittingLabel: 'Sending…',
    submitting: false,
    onSubmit: jest.fn(),
    formError: null,
    sent: false,
    successTitle: 'Message sent',
    successBody: "We'll reply by email soon.",
    closeLabel: 'Close',
    ...overrides,
  };
}

describe('AskAboutDateSheet', () => {
  it('vẽ tiêu đề + mô tả đợt khi visible', async () => {
    await renderWithTheme(<AskAboutDateSheet {...baseProps()} />);

    expect(screen.getByText('Ask about this date')).toBeTruthy();
    expect(
      screen.getByText('This departure (Sat 26 Sep – Tue 29 Sep) is closed for booking.'),
    ).toBeTruthy();
  });

  it('ẩn khi visible=false', async () => {
    await renderWithTheme(<AskAboutDateSheet {...baseProps({ visible: false })} />);
    expect(screen.queryByText('Ask about this date')).toBeNull();
  });

  it('gõ vào ô tên gọi onChange đúng field', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<AskAboutDateSheet {...baseProps({ onChange })} />);

    await fireEvent.changeText(screen.getByLabelText('Full name'), 'Alice');
    expect(onChange).toHaveBeenCalledWith('name', 'Alice');
  });

  it('vẽ lỗi từng ô khi errors có mặt', async () => {
    await renderWithTheme(
      <AskAboutDateSheet
        {...baseProps({ errors: { email: 'Enter a valid email address, e.g. you@example.com.' } })}
      />,
    );

    expect(screen.getByText('Enter a valid email address, e.g. you@example.com.')).toBeTruthy();
  });

  it('bấm Send gọi onSubmit; submitting=true đổi chữ + vô hiệu nút', async () => {
    const onSubmit = jest.fn();
    await renderWithTheme(<AskAboutDateSheet {...baseProps({ onSubmit })} />);
    await fireEvent.press(screen.getByText('Send message'));
    expect(onSubmit).toHaveBeenCalled();

    onSubmit.mockClear();
    await renderWithTheme(<AskAboutDateSheet {...baseProps({ submitting: true, onSubmit })} />);
    await fireEvent.press(screen.getByText('Sending…'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('formError khác null: vẽ banner lỗi cấp form', async () => {
    await renderWithTheme(
      <AskAboutDateSheet
        {...baseProps({ formError: "Couldn't send your message. Please try again." })}
      />,
    );
    expect(screen.getByText("Couldn't send your message. Please try again.")).toBeTruthy();
  });

  it('sent=true: vẽ trạng thái thành công, KHÔNG vẽ form; bấm Close gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<AskAboutDateSheet {...baseProps({ sent: true, onClose })} />);

    expect(screen.getByText('Message sent')).toBeTruthy();
    expect(screen.queryByLabelText('Full name')).toBeNull();
    await fireEvent.press(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
