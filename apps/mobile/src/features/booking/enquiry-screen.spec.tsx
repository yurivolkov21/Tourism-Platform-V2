import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { EnquiryScreen, type EnquiryScreenProps } from './enquiry-screen';

function baseProps(overrides: Partial<EnquiryScreenProps> = {}): EnquiryScreenProps {
  return {
    nameLabel: 'Full name',
    emailLabel: 'Email',
    phoneLabel: 'Phone (optional)',
    messageLabel: 'Message',
    messagePlaceholder: 'Tell us about your dates, group size and questions…',
    values: { name: '', email: '', phone: '', message: '' },
    errors: {},
    onChange: jest.fn(),
    submitLabel: 'Send enquiry',
    submitting: false,
    onSubmit: jest.fn(),
    formError: null,
    sent: false,
    successTitle: 'Message sent',
    successBody: "Thanks! We'll get back to you within 24 hours.",
    backToTourLabel: 'Back to tour',
    onClose: jest.fn(),
    ...overrides,
  };
}

describe('EnquiryScreen', () => {
  it('không có tripTitle/tripSubtitle/tripImageUrl: không vẽ thẻ chuyến', async () => {
    await renderWithTheme(<EnquiryScreen {...baseProps()} />);
    expect(screen.queryByText('Central Heritage')).toBeNull();
  });

  it('có tripTitle: vẽ thẻ chuyến với đúng tiêu đề + khoảng ngày', async () => {
    await renderWithTheme(
      <EnquiryScreen
        {...baseProps({
          tripTitle: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
          tripSubtitle: 'Wed 23 – Sat 26 Sep 2026 · booking closed',
        })}
      />,
    );
    expect(screen.getByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toBeTruthy();
    expect(screen.getByText('Wed 23 – Sat 26 Sep 2026 · booking closed')).toBeTruthy();
  });

  it('gõ vào ô tên gọi onChange đúng field', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<EnquiryScreen {...baseProps({ onChange })} />);

    await fireEvent.changeText(screen.getByLabelText('Full name'), 'Lan N.');
    expect(onChange).toHaveBeenCalledWith('name', 'Lan N.');
  });

  it('có lỗi thì in câu lỗi cạnh đúng ô', async () => {
    await renderWithTheme(
      <EnquiryScreen
        {...baseProps({ errors: { email: 'Please enter a valid email address.' } })}
      />,
    );
    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
  });

  it('bấm Send enquiry gọi onSubmit; submitting=true vô hiệu nút', async () => {
    const onSubmit = jest.fn();
    await renderWithTheme(<EnquiryScreen {...baseProps({ onSubmit })} />);
    await fireEvent.press(screen.getByText('Send enquiry'));
    expect(onSubmit).toHaveBeenCalled();

    onSubmit.mockClear();
    await renderWithTheme(<EnquiryScreen {...baseProps({ submitting: true, onSubmit })} />);
    await fireEvent.press(screen.getByText('Send enquiry'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('formError khác null: vẽ banner lỗi cấp form', async () => {
    await renderWithTheme(
      <EnquiryScreen
        {...baseProps({ formError: "Couldn't send your enquiry. Please try again." })}
      />,
    );
    expect(screen.getByText("Couldn't send your enquiry. Please try again.")).toBeTruthy();
  });

  it('sent=true: vẽ trạng thái thành công, KHÔNG vẽ form; bấm Back to tour gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<EnquiryScreen {...baseProps({ sent: true, onClose })} />);

    expect(screen.getByText('Message sent')).toBeTruthy();
    expect(screen.queryByLabelText('Full name')).toBeNull();
    await fireEvent.press(screen.getByText('Back to tour'));
    expect(onClose).toHaveBeenCalled();
  });
});
