import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { EditNameSheet, type EditNameSheetProps } from './edit-name-sheet';

function baseProps(overrides: Partial<EditNameSheetProps> = {}): EditNameSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    label: 'Display name',
    value: 'Lan Nguyen',
    formError: null,
    pending: false,
    saveLabel: 'Save',
    savingLabel: 'Saving…',
    onChangeText: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
}

describe('EditNameSheet', () => {
  it('A3 — vẽ ô tên, bấm Save gọi onSave', async () => {
    const onSave = jest.fn();
    await renderWithTheme(<EditNameSheet {...baseProps({ onSave })} />);

    expect(screen.getByDisplayValue('Lan Nguyen')).toBeTruthy();
    await fireEvent.press(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('lỗi ô hiện dưới ô', async () => {
    await renderWithTheme(<EditNameSheet {...baseProps({ error: 'Enter your name.' })} />);
    expect(screen.getByText('Enter your name.')).toBeTruthy();
  });

  it('lỗi server hiện trong FormMessage', async () => {
    await renderWithTheme(
      <EditNameSheet {...baseProps({ formError: "Couldn't update your name." })} />,
    );
    expect(screen.getByText("Couldn't update your name.")).toBeTruthy();
  });

  it('đang lưu thì đổi nhãn nút và khoá nút', async () => {
    await renderWithTheme(<EditNameSheet {...baseProps({ pending: true })} />);
    expect(screen.getByRole('button', { name: 'Saving…' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
