import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { TourPhotosUnavailable } from './tour-photos-unavailable';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

/**
 * Tab Photos trong khe deploy (vòng review F18): API chưa trả danh sách ảnh thì KHÔNG
 * có form nào để lưu — chỉ một câu nói vì sao và nút tải lại.
 */
const e = messages.admin.tours.editor;

describe('TourPhotosUnavailable', () => {
  it('nói vì sao chưa sửa được ảnh; không có nút tải lên, thư viện hay Save', () => {
    render(<TourPhotosUnavailable />);

    expect(screen.getByRole('status')).toHaveTextContent(e.photos.unavailable);
    expect(screen.queryByRole('button', { name: e.photos.upload })).toBeNull();
    expect(screen.queryByRole('button', { name: e.photos.library })).toBeNull();
    expect(screen.queryByRole('button', { name: e.save })).toBeNull();
  });

  it('Reload làm tươi trang — API đã lên thì trang dựng form từ danh sách thật', async () => {
    const user = userEvent.setup();
    render(<TourPhotosUnavailable />);

    await user.click(screen.getByRole('button', { name: e.banners.reload }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
