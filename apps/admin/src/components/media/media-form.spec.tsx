import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateMediaAction } from '@/lib/media-write';
import { MEDIA_VERSION, mediaItem, USAGES } from '@/test/media';
import { MediaForm } from './media-form';

/**
 * Form alt và ghi công (spec P4f Media §6.2): lưu một lần cho mọi chỗ dùng, báo lệch và CC, lỗi
 * từng ô trước khi gửi, ba lối ra của lệnh lưu.
 */
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const t = messages.admin.media;
const d = t.drawer;

beforeEach(() => {
  refresh.mockReset();
  success.mockReset();
  errorToast.mockReset();
});

function renderForm(item = mediaItem(), update = vi.fn<UpdateMediaAction>()) {
  render(
    <MediaForm
      item={item}
      licenses={['CC BY-SA 4.0', 'Unsplash License']}
      update={update}
      onPendingChange={vi.fn()}
    />,
  );
  return update;
}

const save = () => screen.getByRole('button', { name: d.save });

describe('MediaForm', () => {
  it('chưa đổi gì thì chưa lưu được; sửa một ô là lưu được', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(d.unchanged)).toBeInTheDocument();
    await user.type(screen.getByLabelText(d.author), ' Jr');
    expect(save()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('lưu: gửi năm ô đã cắt khoảng trắng kèm version, toast, tải lại trang', async () => {
    const user = userEvent.setup();
    const item = mediaItem();
    const update = renderForm(
      item,
      vi.fn<UpdateMediaAction>().mockResolvedValue({ ok: true, item }),
    );
    await user.clear(screen.getByLabelText(d.sourceUrl));
    await user.type(screen.getByLabelText(d.author), '  ');
    await user.click(save());

    expect(update).toHaveBeenCalledWith({
      publicId: item.publicId,
      version: MEDIA_VERSION,
      alt: 'Lanterns over the river',
      author: 'Jane Doe',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: null,
    });
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.toast.saved, {
        description: t.toast.savedBody(3),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('alt bắt buộc mà để trống, link sai: báo ở từng ô, không gửi', async () => {
    const user = userEvent.setup();
    const update = renderForm();
    await user.clear(screen.getByLabelText(d.alt));
    await user.clear(screen.getByLabelText(d.licenseUrl));
    await user.type(screen.getByLabelText(d.licenseUrl), 'creativecommons.org');
    await user.click(save());

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText(d.alt)).toHaveAccessibleDescription(
      expect.stringContaining(d.altMissing),
    );
    expect(screen.getByLabelText(d.licenseUrl)).toHaveAccessibleDescription(
      expect.stringContaining(d.invalidLink),
    );
  });

  it('đếm ký tự alt; gợi ý giấy phép đang có', () => {
    renderForm();
    expect(screen.getByText(d.altCounter(23, 300))).toBeInTheDocument();
    const options = document.querySelectorAll('#media-license-options option');
    expect([...options].map((option) => option.getAttribute('value'))).toEqual([
      'CC BY-SA 4.0',
      'Unsplash License',
    ]);
    expect(screen.getByLabelText(d.license)).toHaveAttribute('list', 'media-license-options');
  });

  it('các chỗ dùng đang lệch: nói lưu là làm giống nhau, liệt kê giá trị, lưu được ngay', () => {
    renderForm(
      mediaItem({
        altVaries: true,
        usages: [USAGES.library, USAGES.tourA, { ...USAGES.tourB, alt: 'Old alt' }],
      }),
    );
    expect(screen.getByText(d.varies(3))).toBeInTheDocument();
    expect(screen.getByText('Old alt')).toBeInTheDocument();
    expect(save()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('CC BY thiếu link giấy phép: cảnh báo, không chặn lưu', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByText(d.ccIncomplete)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(d.licenseUrl));
    expect(screen.getByText(d.ccIncomplete)).toBeInTheDocument();
    expect(save()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('STALE_MEDIA: toast lỗi rồi tải lại, không giữ câu lỗi trong form', async () => {
    const user = userEvent.setup();
    renderForm(
      mediaItem(),
      vi.fn<UpdateMediaAction>().mockResolvedValue({ ok: false, code: 'STALE_MEDIA' }),
    );
    await user.type(screen.getByLabelText(d.author), ' Jr');
    await user.click(save());
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith(t.errors.STALE_MEDIA));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ALT_REQUIRED từ server: lỗi nằm ở ô alt, form ở lại', async () => {
    const user = userEvent.setup();
    renderForm(
      mediaItem({ altRequired: false, usages: [USAGES.post] }),
      vi.fn<UpdateMediaAction>().mockResolvedValue({ ok: false, code: 'ALT_REQUIRED' }),
    );
    await user.clear(screen.getByLabelText(d.alt));
    await user.click(save());
    const alt = screen.getByLabelText(d.alt);
    await waitFor(() =>
      expect(alt).toHaveAccessibleDescription(expect.stringContaining(t.errors.ALT_REQUIRED)),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.errors.ALT_REQUIRED);
  });
});
