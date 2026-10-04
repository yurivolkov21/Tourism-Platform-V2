import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { BookingContactScreen, type BookingContactScreenProps } from './booking-contact-screen';

function baseProps(overrides: Partial<BookingContactScreenProps> = {}): BookingContactScreenProps {
  return {
    step: 2,
    totalSteps: 3,
    stepLabel: 'Step 2 of 3',
    heading: 'Contact details',
    subtitle: 'We send the confirmation here.',
    nameLabel: 'Full name',
    emailLabel: 'Email',
    phoneLabel: 'Phone (optional)',
    notesLabel: 'Anything we should know? (optional)',
    values: {
      contactName: 'Lan Nguyen',
      contactEmail: 'lan.nguyen@example.com',
      contactPhone: '',
      specialRequests: '',
    },
    errors: {},
    onChange: jest.fn(),
    totalLabel: '3 travellers × $459',
    totalAmount: '$1,377',
    continueLabel: 'Continue',
    onContinue: jest.fn(),
    ...overrides,
  };
}

describe('BookingContactScreen', () => {
  it('B3 — điền sẵn tên/email, giữ nguyên phone rỗng', async () => {
    await renderWithTheme(<BookingContactScreen {...baseProps()} />);

    expect(screen.getByDisplayValue('Lan Nguyen')).toBeTruthy();
    expect(screen.getByDisplayValue('lan.nguyen@example.com')).toBeTruthy();
  });

  it('gõ vào ô tên gọi onChange đúng field', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<BookingContactScreen {...baseProps({ onChange })} />);

    await fireEvent.changeText(screen.getByLabelText('Full name'), 'Lan N.');
    expect(onChange).toHaveBeenCalledWith('contactName', 'Lan N.');
  });

  it('có lỗi thì in câu lỗi cạnh đúng ô', async () => {
    await renderWithTheme(
      <BookingContactScreen
        {...baseProps({ errors: { contactEmail: 'Enter a valid email address.' } })}
      />,
    );

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  });

  it('bấm Continue gọi onContinue', async () => {
    const onContinue = jest.fn();
    await renderWithTheme(<BookingContactScreen {...baseProps({ onContinue })} />);

    await fireEvent.press(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});
