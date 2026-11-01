import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { renderWithTheme } from '@/test-utils';
import { ConfirmMatchHint, NewPasswordField, PasswordRequirements } from './password-hints';

const copy = messages.authForms.passwordStrength;

describe('PasswordRequirements', () => {
  it('ô trống vẫn hiện đủ năm yêu cầu, tất cả chưa đạt', async () => {
    await renderWithTheme(<PasswordRequirements password="" />);

    expect(
      screen.getByLabelText(copy.requirementState(copy.requirements.length.text, false)),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(copy.requirementState(copy.requirements.symbol.text, false)),
    ).toBeTruthy();
  });

  it('tick đúng yêu cầu đã đạt', async () => {
    await renderWithTheme(<PasswordRequirements password="abcdefgh1" />);

    expect(
      screen.getByLabelText(copy.requirementState(copy.requirements.length.text, true)),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(copy.requirementState(copy.requirements.number.text, true)),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(copy.requirementState(copy.requirements.uppercase.text, false)),
    ).toBeTruthy();
  });
});

describe('ConfirmMatchHint', () => {
  it('ô xác nhận trống → không hiện gì', async () => {
    await renderWithTheme(<ConfirmMatchHint password="abc" confirm="" />);

    expect(screen.queryByText(copy.confirmMatch)).toBeNull();
    expect(screen.queryByText(copy.confirmNoMatch)).toBeNull();
  });

  it('khớp / chưa khớp', async () => {
    await renderWithTheme(<ConfirmMatchHint password="abc" confirm="abc" />);
    expect(screen.getByText(copy.confirmMatch)).toBeTruthy();

    await renderWithTheme(<ConfirmMatchHint password="abc" confirm="ab" />);
    expect(screen.getByText(copy.confirmNoMatch)).toBeTruthy();
  });

  it('đang có lỗi ở ô thì nhường chỗ cho lỗi', async () => {
    await renderWithTheme(<ConfirmMatchHint password="abc" confirm="ab" error="x" />);

    expect(screen.queryByText(copy.confirmNoMatch)).toBeNull();
  });
});

describe('NewPasswordField', () => {
  const lengthUnmet = copy.requirementState(copy.requirements.length.text, false);

  it('checklist ẩn tới khi chạm vào ô, rời ô trống thì ẩn lại', async () => {
    await renderWithTheme(<NewPasswordField label="New password" value="" />);
    expect(screen.queryByLabelText(lengthUnmet)).toBeNull();

    await fireEvent(screen.getByLabelText('New password'), 'focus');
    expect(screen.getByLabelText(lengthUnmet)).toBeTruthy();

    await fireEvent(screen.getByLabelText('New password'), 'blur');
    expect(screen.queryByLabelText(lengthUnmet)).toBeNull();
  });

  it('đã có chữ thì checklist vẫn hiện sau khi rời ô', async () => {
    await renderWithTheme(<NewPasswordField label="New password" value="abc" />);

    expect(screen.getByLabelText(lengthUnmet)).toBeTruthy();
  });
});
