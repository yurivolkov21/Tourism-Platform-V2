import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { EditAvatarSheet, type EditAvatarSheetProps } from './edit-avatar-sheet';

function baseProps(overrides: Partial<EditAvatarSheetProps> = {}): EditAvatarSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    title: 'Profile photo',
    takePhotoLabel: 'Take a photo',
    chooseLibraryLabel: 'Choose from library',
    removePhotoLabel: 'Remove photo',
    cancelLabel: 'Cancel',
    showRemove: false,
    pending: false,
    errorText: null,
    onTakePhoto: jest.fn(),
    onChooseLibrary: jest.fn(),
    onRemove: jest.fn(),
    ...overrides,
  };
}

describe('EditAvatarSheet', () => {
  it('A4 — chưa có ảnh: KHÔNG hiện "Remove photo"', async () => {
    await renderWithTheme(<EditAvatarSheet {...baseProps()} />);
    expect(screen.getByText('Take a photo')).toBeTruthy();
    expect(screen.getByText('Choose from library')).toBeTruthy();
    expect(screen.queryByText('Remove photo')).toBeNull();
  });

  it('đang có ảnh: hiện "Remove photo", bấm gọi onRemove', async () => {
    const onRemove = jest.fn();
    await renderWithTheme(<EditAvatarSheet {...baseProps({ showRemove: true, onRemove })} />);
    await fireEvent.press(screen.getByText('Remove photo'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('bấm "Take a photo" gọi onTakePhoto, "Choose from library" gọi onChooseLibrary', async () => {
    const onTakePhoto = jest.fn();
    const onChooseLibrary = jest.fn();
    await renderWithTheme(<EditAvatarSheet {...baseProps({ onTakePhoto, onChooseLibrary })} />);
    await fireEvent.press(screen.getByText('Take a photo'));
    await fireEvent.press(screen.getByText('Choose from library'));
    expect(onTakePhoto).toHaveBeenCalled();
    expect(onChooseLibrary).toHaveBeenCalled();
  });

  it('lỗi hiện NGAY trong tấm, không đóng tấm', async () => {
    await renderWithTheme(
      <EditAvatarSheet {...baseProps({ errorText: 'File must be an image.' })} />,
    );
    expect(screen.getByText('File must be an image.')).toBeTruthy();
  });

  it('đang pending: khoá cả ba dòng và nút Cancel', async () => {
    await renderWithTheme(<EditAvatarSheet {...baseProps({ showRemove: true, pending: true })} />);
    for (const label of ['Take a photo', 'Choose from library', 'Remove photo', 'Cancel']) {
      expect(screen.getByRole('button', { name: label }).props.accessibilityState).toMatchObject({
        disabled: true,
      });
    }
  });

  it('bấm Cancel gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<EditAvatarSheet {...baseProps({ onClose })} />);
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  // N3 (rà 07/10): Cancel đã khoá khi pending, nhưng backdrop/back Android thì chưa.
  it('đang pending thì chạm backdrop KHÔNG đóng tấm', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<EditAvatarSheet {...baseProps({ pending: true, onClose })} />);
    await fireEvent.press(screen.getByTestId('bottom-sheet-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('không pending thì chạm backdrop đóng tấm', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<EditAvatarSheet {...baseProps({ onClose })} />);
    await fireEvent.press(screen.getByTestId('bottom-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
