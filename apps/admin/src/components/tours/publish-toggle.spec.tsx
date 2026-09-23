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
  countNote: null,
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

  /**
   * Hai ca dưới đây là lý do state của component đổi trục so sánh ở vòng review
   * 21/09: từ "prop có vừa đổi không" sang "server đã đuổi kịp chưa".
   *
   * Bản trước giữ một gương `serverValue` và `setChecked` mỗi khi prop khác
   * gương. Đã đo: cả hai ca ĐỎ với bản cũ, XANH với bản mới.
   */
  it('refresh của lệnh TRƯỚC không đè lên cú bấm đang bay', async () => {
    const user = userEvent.setup();
    let treo: (() => void) | undefined;
    const setPublished = vi
      .fn()
      // Lệnh 1 (bật) xong ngay.
      .mockResolvedValueOnce({ ok: true, id: ROW.id, isPublished: true, changed: true })
      // Lệnh 2 (tắt) treo, để một lượt refresh cũ kịp về giữa chừng.
      .mockReturnValueOnce(
        new Promise((resolve) => {
          // Giải phóng ở cuối test bằng một kết quả HỢP LỆ: resolve bằng
          // `undefined` làm `result.ok` nổ thành unhandled rejection, và vitest
          // vẫn báo "889 passed" kèm một Error lạc lõng ở cuối log.
          treo = () => resolve({ ok: true, id: ROW.id, isPublished: false, changed: true });
        }),
      );

    const { rerender } = render(
      <PublishToggle row={{ ...ROW, isPublished: false }} setPublished={setPublished} />,
    );

    await user.click(toggle()); // BẬT
    // Chờ công tắc thật sự NHẢ (pending về false và React đã vẽ xong) — bấm
    // tiếp khi chưa nhả thì cú thứ hai đọc trạng thái cũ và đo sai thứ khác.
    await waitFor(() => expect(toggle()).toBeChecked());
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    await user.click(toggle()); // TẮT — lệnh còn đang bay
    expect(toggle()).not.toBeChecked();

    // Giờ mới tới lượt router.refresh() của lệnh BẬT, mang giá trị đã cũ.
    rerender(<PublishToggle row={{ ...ROW, isPublished: true }} setPublished={setPublished} />);

    // Phải giữ ý người dùng. Bản cũ lật ngược về BẬT ở đúng đây.
    expect(toggle()).not.toBeChecked();
    treo?.();
  });

  it('lệnh hỏng giữa lúc người khác đã đổi trạng thái: theo server, không kẹt', async () => {
    const user = userEvent.setup();
    let hong: ((value: { ok: false; code: 'GENERIC' }) => void) | undefined;
    const setPublished = vi.fn().mockReturnValue(
      new Promise<{ ok: false; code: 'GENERIC' }>((resolve) => {
        hong = resolve;
      }),
    );

    const { rerender } = render(
      <PublishToggle row={{ ...ROW, isPublished: false }} setPublished={setPublished} />,
    );

    await user.click(toggle()); // bấm BẬT, lệnh chưa về

    // Trong lúc chờ, một tab khác publish chính tour này; một lượt refresh bất
    // kỳ mang sự thật đó về.
    rerender(<PublishToggle row={{ ...ROW, isPublished: true }} setPublished={setPublished} />);

    hong?.({ ok: false, code: 'GENERIC' });
    await waitFor(() => expect(errorToast).toHaveBeenCalled());

    // Server đang nói "đang bán" → công tắc phải nói thế. Bản cũ kẹt ở TẮT
    // (giá trị trước khi bấm) và không lối nào thoát trừ tải lại cả trang.
    rerender(<PublishToggle row={{ ...ROW, isPublished: true }} setPublished={setPublished} />);
    expect(toggle()).toBeChecked();
  });
});
