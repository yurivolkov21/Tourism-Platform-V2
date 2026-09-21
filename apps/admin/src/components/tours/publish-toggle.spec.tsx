import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourRowVM } from '@/lib/tours-view';
import { PublishToggle } from './publish-toggle';

/**
 * Công tắc bán/ngừng bán của MỘT hàng trong `/tours` (spec P4e-1 §3-F11).
 *
 * Hành vi được pin ở đây là hành vi mà vùng này KHÔNG mượn được từ kit
 * `ConfirmWriteDialog`: cập nhật lạc quan, và HOÀN NGUYÊN khi lệnh hỏng. Một
 * công tắc kẹt ở trạng thái sai sau lỗi mạng là công tắc nói dối về việc tour
 * còn đang bán hay không — thứ đắt nhất có thể sai trên màn hình này.
 */
const t = messages.admin.tours.publish;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const ROW: TourRowVM = {
  id: '7f2a1b3c-0000-4000-8000-000000000001',
  slug: 'hoi-an-lantern-evening',
  title: 'Hoi An Lantern Evening',
  category: 'Day Tours',
  price: '$39.00',
  openDepartureCount: 3,
  countLabel: messages.admin.tours.list.openDepartures(3),
  isPublished: true,
  isFeatured: false,
  heroUrl: null,
  departuresHref: '/tours/hoi-an-lantern-evening/departures',
  departuresLabel: messages.admin.tours.list.manageDepartures('Hoi An Lantern Evening'),
};

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

const toggle = () => screen.getByRole('switch', { name: t.toggleLabel(ROW.title) });

describe('PublishToggle', () => {
  it('công tắc mang tên riêng theo tour và phản ánh trạng thái đang bán', () => {
    render(<PublishToggle row={ROW} setPublished={vi.fn()} />);
    expect(toggle()).toBeChecked();
  });

  it('LỆNH HỎNG → hoàn nguyên về trạng thái cũ và nói vì sao', async () => {
    const user = userEvent.setup();
    const setPublished = vi.fn(async () => ({ ok: false as const, code: 'NOT_FOUND' as const }));
    render(<PublishToggle row={ROW} setPublished={setPublished} />);

    await user.click(toggle());
    // Hoàn nguyên: hàng vẫn đang bán, đúng như server vẫn đang giữ.
    await waitFor(() => expect(toggle()).toBeChecked());
    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FOUND);
    expect(success).not.toHaveBeenCalled();
  });

  it('action NÉM → cũng hoàn nguyên, không để công tắc kẹt ở trạng thái lạc quan', async () => {
    const user = userEvent.setup();
    const setPublished = vi.fn(async () => {
      throw new Error('network down');
    });
    render(<PublishToggle row={ROW} setPublished={setPublished} />);

    await user.click(toggle());
    await waitFor(() => expect(toggle()).toBeChecked());
    expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC);
  });

  it('lạc quan: đổi hình ngay khi bấm, trước khi server trả lời', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const setPublished = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { ok: true as const, isPublished: false, changed: true };
    });
    render(<PublishToggle row={ROW} setPublished={setPublished} />);

    await user.click(toggle());
    // Chưa ai trả lời mà công tắc đã tắt — đó là toàn bộ điểm của "lạc quan".
    await waitFor(() => expect(toggle()).not.toBeChecked());
    expect(success).not.toHaveBeenCalled();

    release?.();
    await waitFor(() => expect(success).toHaveBeenCalledWith(t.toast.off(ROW.title)));
  });

  it('gửi ĐÚNG trạng thái đích, không phải lệnh "đảo"', async () => {
    const user = userEvent.setup();
    const setPublished = vi.fn(async () => ({
      ok: true as const,
      isPublished: false,
      changed: true,
    }));
    render(<PublishToggle row={ROW} setPublished={setPublished} />);

    await user.click(toggle());
    await waitFor(() =>
      expect(setPublished).toHaveBeenCalledWith({ id: ROW.id, isPublished: false }),
    );
  });

  it('thành công → toast kể đúng hệ quả và kéo bảng tươi về', async () => {
    const user = userEvent.setup();
    const setPublished = vi.fn(async () => ({
      ok: true as const,
      isPublished: false,
      changed: true,
    }));
    render(<PublishToggle row={ROW} setPublished={setPublished} />);

    await user.click(toggle());
    // Câu này là thứ ngăn vận hành ngần ngại rút một tour khỏi kệ.
    await waitFor(() => expect(success).toHaveBeenCalledWith(t.toast.off(ROW.title)));
    expect(refresh).toHaveBeenCalled();
  });

  it('bật lại một tour đang ẩn → settle theo RESPONSE, không theo cú bấm', async () => {
    const user = userEvent.setup();
    const draft = { ...ROW, isPublished: false };
    // Tab khác đã bật sẵn: server nói "đã bật rồi, không đổi gì".
    const setPublished = vi.fn(async () => ({
      ok: true as const,
      isPublished: true,
      changed: false,
    }));
    render(<PublishToggle row={draft} setPublished={setPublished} />);

    await user.click(toggle());
    await waitFor(() => expect(success).toHaveBeenCalledWith(t.toast.unchanged(ROW.title)));
    expect(toggle()).toBeChecked();
  });

  it('đang bắn thì khoá — bấm đúp chỉ gửi MỘT lệnh', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const setPublished = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { ok: true as const, isPublished: false, changed: true };
    });
    render(<PublishToggle row={ROW} setPublished={setPublished} />);

    await user.click(toggle());
    // Base UI dựng switch bằng `<span role="switch">` + input ẩn, nên "đang
    // khoá" nói ra bằng `aria-disabled` chứ không phải thuộc tính `disabled`.
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-disabled', 'true'));
    await user.click(toggle());
    expect(setPublished).toHaveBeenCalledTimes(1);

    release?.();
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(setPublished).toHaveBeenCalledTimes(1);
  });
});
