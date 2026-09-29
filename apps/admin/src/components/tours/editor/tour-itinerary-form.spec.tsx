import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetItineraryAction } from '@/lib/tour-editor-write';
import { detailFixture, TOUR_ID, VERSION } from '@/test/tour-detail';
import { TourItineraryForm } from './tour-itinerary-form';

/**
 * Tab Itinerary (spec F17 §2h): đủ N thẻ ngày, ngày không tiêu đề không được lưu,
 * tour đang bán thì tiêu đề ngày nào cũng bắt buộc.
 */
const e = messages.admin.tours.editor;
const t = e.itinerary;
const fe = e.form.errors;

const success = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => success(...args), error: vi.fn() },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh(), push: vi.fn() }),
}));

beforeEach(() => {
  success.mockReset();
  refresh.mockReset();
});

const NEXT_VERSION = '2026-09-24T10:11:13.000Z';

function renderForm(detail: AdminTourDetail = detailFixture(), save: SetItineraryAction = vi.fn()) {
  const user = userEvent.setup();
  render(<TourItineraryForm detail={detail} save={save} />);
  return { user };
}

const dayCard = (n: number) => screen.getByRole('group', { name: t.day(n) });
const dayTitle = (n: number) => within(dayCard(n)).getByRole('textbox', { name: t.dayTitle });
const saveButton = () => screen.getByRole('button', { name: e.save });

/** Tour tắt bán: lưu dở được, không vướng luật "tour đang bán". */
const offSale = (patch: Partial<AdminTourDetail> = {}) =>
  detailFixture({ isPublished: false, ...patch });

describe('TourItineraryForm', () => {
  it('tour 3 ngày: ba thẻ Day 1…3 mang id="day-N", ô mô tả có ví dụ khuôn giờ', () => {
    renderForm();

    expect(screen.getByText(t.intro(3))).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(3);
    for (const n of [1, 2, 3]) {
      expect(dayCard(n)).toHaveAttribute('id', `day-${n}`);
      const description = within(dayCard(n)).getByRole('textbox', { name: t.description });
      expect(description).toHaveAttribute('placeholder', t.descriptionPlaceholder);
      expect(description).toHaveAccessibleDescription(t.descriptionHint);
    }
    expect(dayTitle(1)).toHaveValue('Board the boat');
  });

  it('ngày chưa có hàng thì hai ô trống', () => {
    renderForm(
      offSale({
        itinerary: [
          { dayNumber: 1, title: 'Board the boat', description: null },
          { dayNumber: 3, title: 'Back to Hanoi', description: null },
        ],
      }),
    );

    expect(dayTitle(2)).toHaveValue('');
    expect(within(dayCard(2)).getByRole('textbox', { name: t.description })).toHaveValue('');
    expect(dayTitle(3)).toHaveValue('Back to Hanoi');
  });

  it('tour ĐANG bán mà xoá tiêu đề ngày 2: lỗi dưới đúng ô ngày 2, không gửi', async () => {
    const save = vi.fn();
    const { user } = renderForm(detailFixture(), save);

    await user.clear(dayTitle(2));
    await user.click(saveButton());

    expect(within(dayCard(2)).getByRole('alert')).toHaveTextContent(fe.dayTitleOnSale);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('tour tắt bán: payload chỉ có ngày có tiêu đề, rồi toast và refresh', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: offSale() });
    const { user } = renderForm(offSale(), save);

    await user.clear(dayTitle(2));
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toEqual({
      id: TOUR_ID,
      version: VERSION,
      days: [
        { dayNumber: 1, title: 'Board the boat', description: '09:00 — Pick-up at your hotel' },
        { dayNumber: 3, title: 'Back to Hanoi', description: null },
      ],
    });
    await waitFor(() => expect(success).toHaveBeenCalledWith(e.saved));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('có mô tả mà không tiêu đề: lỗi dưới ô mô tả, không gửi', async () => {
    const save = vi.fn();
    const { user } = renderForm(offSale(), save);

    await user.clear(dayTitle(1));
    await user.click(saveButton());

    expect(within(dayCard(1)).getByRole('alert')).toHaveTextContent(fe.descriptionWithoutTitle);
    expect(save).not.toHaveBeenCalled();
  });

  it('server trả TOUR_NOT_READY: dải liệt kê ngày thiếu theo chính lệnh vừa gửi', async () => {
    // Form mở lúc tour tắt bán; trong lúc đó ai đó bật bán — server chặn.
    const save = vi.fn().mockResolvedValue({ ok: false, code: 'TOUR_NOT_READY' });
    const { user } = renderForm(offSale(), save);

    await user.clear(dayTitle(2));
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByText(e.banners.notReady)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: e.readiness.days('2', 1) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/itinerary#day-2',
    );
    expect(dayTitle(2)).toHaveValue('');
  });

  it('lưu hai lần liền: lần hai gửi version của response lần một, không phải của props', async () => {
    // Response mang ĐÚNG thứ vừa lưu (ngày 3 có "!"): form phải lấy nó làm bản gốc
    // mới thì nút Save mới tắt — response trùng dữ liệu cũ sẽ che mất lỗi ấy.
    const saved = offSale({
      version: NEXT_VERSION,
      itinerary: [
        { dayNumber: 1, title: 'Board the boat', description: '09:00 — Pick-up at your hotel' },
        { dayNumber: 2, title: 'Kayak the lagoons', description: null },
        { dayNumber: 3, title: 'Back to Hanoi!', description: null },
      ],
    });
    const save = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, detail: saved })
      .mockResolvedValueOnce({
        ok: true,
        detail: offSale({ version: '2026-09-24T10:11:14.000Z' }),
      });
    const { user } = renderForm(offSale(), save);

    await user.type(dayTitle(3), '!');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-disabled', 'true'));

    await user.type(dayTitle(3), '?');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));

    expect(save.mock.calls[0]?.[0].version).toBe(VERSION);
    expect(save.mock.calls[1]?.[0].version).toBe(NEXT_VERSION);
  });
});

describe('TourItineraryForm — bước Itinerary (F19)', () => {
  const a = e.aside;
  const state = e.steps.state;
  const days = () => within(screen.getByRole('complementary'));

  it('câu giới thiệu là `lead`: ngoài form, đứng trước form', () => {
    renderForm();
    const intro = screen.getByText(t.intro(3));
    expect(intro.closest('form')).toBeNull();
    expect(intro.compareDocumentPosition(dayCard(1))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('ngày chưa có tiêu đề: nhãn trên thẻ và dấu "!" ở danh mục Days; gõ tiêu đề là hết ngay', async () => {
    const { user } = renderForm(
      offSale({ itinerary: [{ dayNumber: 1, title: 'Board the boat', description: null }] }),
    );
    expect(within(dayCard(2)).getByText(a.itinerary.needed)).toBeInTheDocument();
    expect(within(dayCard(1)).queryByText(a.itinerary.needed)).toBeNull();
    expect(
      days().getByRole('link', { name: `${t.day(1)} · Board the boat ${state.ok}` }),
    ).toHaveAttribute('href', '#day-1');
    expect(days().getByRole('link', { name: `${t.day(2)} ${state.warn}` })).toHaveAttribute(
      'href',
      '#day-2',
    );

    await user.type(dayTitle(2), 'Kayak the lagoons');

    expect(within(dayCard(2)).queryByText(a.itinerary.needed)).toBeNull();
    expect(
      days().getByRole('link', { name: `${t.day(2)} · Kayak the lagoons ${state.ok}` }),
    ).toBeInTheDocument();
  });

  it('chân form: link Next: FAQ & policies', () => {
    renderForm();
    expect(screen.getByRole('link', { name: e.next(e.tabs.content) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/content',
    );
  });
});
