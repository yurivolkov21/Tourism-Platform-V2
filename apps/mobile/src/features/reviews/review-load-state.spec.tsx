import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { ReviewLoadState } from './review-load-state';

describe('ReviewLoadState', () => {
  it('đang tải: có vòng quay, không có nút thử lại', async () => {
    await renderWithTheme(
      <ReviewLoadState state="loading" errorText="Lỗi" retryLabel="Thử lại" onRetry={jest.fn()} />,
    );

    expect(screen.getByTestId('review-loading')).toBeTruthy();
    expect(screen.queryByText('Thử lại')).toBeNull();
  });

  it('lỗi: hiện câu lỗi và nút thử lại gọi onRetry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(
      <ReviewLoadState state="error" errorText="Lỗi" retryLabel="Thử lại" onRetry={onRetry} />,
    );

    expect(screen.getByText('Lỗi')).toBeTruthy();
    fireEvent.press(screen.getByText('Thử lại'));
    expect(onRetry).toHaveBeenCalled();
  });
});
