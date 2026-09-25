import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourEditorOptions } from '@/lib/api/tours';
import type { DeleteTourAction, UpdateDetailsAction } from '@/lib/tour-editor-write';
import {
  CATEGORY_ID,
  DEST_A,
  DEST_B,
  detailFixture,
  HIDDEN_CATEGORY_ID,
  HIDDEN_DEST,
  TOUR_ID,
  VERSION,
} from '@/test/tour-detail';
import { TourDetailsForm } from './tour-details-form';

/**
 * Tab Details (spec F17 §2h): ba khung, một nút Save, vùng xoá ở cuối.
 */
const e = messages.admin.tours.editor;
const t = e.details;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh(), push: (href: string) => push(href) }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
  push.mockReset();
});

const OPTIONS: TourEditorOptions = {
  categories: [
    { id: CATEGORY_ID, name: 'Day Tours', isActive: true },
    { id: HIDDEN_CATEGORY_ID, name: 'Retired', isActive: false },
  ],
  destinations: [
    { id: DEST_A, name: 'Hạ Long', isActive: true },
    { id: DEST_B, name: 'Hà Nội', isActive: true },
    { id: HIDDEN_DEST, name: 'An Bàng', isActive: false },
  ],
};

const NEXT_VERSION = '2026-09-24T10:11:13.000Z';

function renderForm(
  detail: AdminTourDetail = detailFixture(),
  save: UpdateDetailsAction = vi.fn(),
  remove: DeleteTourAction = vi.fn(),
) {
  const user = userEvent.setup();
  render(<TourDetailsForm detail={detail} options={OPTIONS} save={save} remove={remove} />);
  return { user, save: save as ReturnType<typeof vi.fn>, remove };
}

const saveButton = () => screen.getByRole('button', { name: e.save });
const field = (name: string) => screen.getByRole('textbox', { name });

describe('TourDetailsForm', () => {
  it('mở ra đủ giá trị; Save khoá tới khi sửa một ô', async () => {
    const { user } = renderForm();

    expect(field(t.title)).toHaveValue('Ha Long Bay Cruise');
    expect(field(t.summary)).toHaveValue('Three days on the bay.');
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    await user.type(field(t.title), '!');
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('lưu gửi ĐÚNG payload rồi toast và refresh', async () => {
    const save = vi.fn().mockResolvedValue({
      ok: true,
      detail: detailFixture({ title: 'Renamed', version: NEXT_VERSION }),
    });
    const { user } = renderForm(detailFixture(), save);

    await user.clear(field(t.title));
    await user.type(field(t.title), '  Renamed ');
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const payload = save.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ id: TOUR_ID, version: VERSION, title: 'Renamed' });
    expect(payload.destinations).toEqual([{ destinationId: DEST_A, isPrimary: true }]);
    await waitFor(() => expect(success).toHaveBeenCalledWith(e.saved));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('tour có chuyến: ô số ngày khoá, kèm câu vì sao', () => {
    renderForm(detailFixture({ departureCount: 2 }));

    expect(field(t.durationDays)).toBeDisabled();
    expect(screen.getByText(e.form.errors.durationLocked)).toBeInTheDocument();
  });

  it('hạ số ngày của tour tắt bán: báo trước ngày nào sẽ bị xoá; giữ nguyên thì không', async () => {
    const detail = detailFixture({
      isPublished: false,
      durationDays: 4,
      itinerary: [1, 2, 3, 4].map((n) => ({ dayNumber: n, title: `D${n}`, description: null })),
    });
    const { user } = renderForm(detail);

    await user.clear(field(t.durationDays));
    await user.type(field(t.durationDays), '2');
    expect(screen.getByText(t.daysRemoved('3–4', 2))).toBeInTheDocument();
    expect(screen.getByText(t.daysRemoved('3–4', 2))).not.toHaveAttribute('role', 'alert');

    await user.clear(field(t.durationDays));
    await user.type(field(t.durationDays), '4');
    expect(screen.queryByText(t.daysRemoved('3–4', 2))).not.toBeInTheDocument();
  });

  it('sàn số khách: dưới sàn thì lỗi dưới ô và KHÔNG gửi', async () => {
    const save = vi.fn();
    const { user } = renderForm(detailFixture({ liveSeatsMax: 12, maxGroupSize: 20 }), save);

    await user.clear(field(t.maxGroupSize));
    await user.type(field(t.maxGroupSize), '11');
    await user.click(saveButton());

    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toContain(e.form.errors.groupFloor(12));
    expect(save).not.toHaveBeenCalled();
  });

  it('tour ĐANG bán mà xoá tóm tắt: lỗi dưới ô, không gửi; tắt bán thì lưu được', async () => {
    const save = vi.fn();
    const { user } = renderForm(detailFixture(), save);

    await user.clear(field(t.summary));
    await user.click(saveButton());
    expect(screen.getByRole('alert')).toHaveTextContent(e.form.errors.summaryOnSale);
    expect(save).not.toHaveBeenCalled();
  });

  it('tour TẮT bán thì xoá tóm tắt vẫn lưu được', async () => {
    const save = vi.fn().mockResolvedValue({
      ok: true,
      detail: detailFixture({ isPublished: false, summary: null, version: NEXT_VERSION }),
    });
    const { user } = renderForm(detailFixture({ isPublished: false }), save);

    await user.clear(field(t.summary));
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].summary).toBeNull();
  });

  it('chọn "Primary" ở dòng thứ hai: đúng MỘT radio được chọn và payload theo đó', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: detailFixture() });
    const detail = detailFixture({
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_B, isPrimary: false },
      ],
    });
    const { user } = renderForm(detail, save);

    const radios = screen.getAllByRole('radio', { name: t.primary });
    expect(radios).toHaveLength(2);
    await user.click(radios[1] as HTMLElement);

    const checked = screen
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toBe(radios[1]);

    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].destinations).toEqual([
      { destinationId: DEST_A, isPrimary: false },
      { destinationId: DEST_B, isPrimary: true },
    ]);
  });

  it('xoá dòng đang là điểm chính → dòng đầu còn lại thành điểm chính', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: detailFixture() });
    const detail = detailFixture({
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_B, isPrimary: false },
      ],
    });
    const { user } = renderForm(detail, save);

    await user.click(
      screen.getByRole('button', {
        name: messages.admin.listEditor.remove(t.destinationName(1)),
      }),
    );
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].destinations).toEqual([
      { destinationId: DEST_B, isPrimary: true },
    ]);
  });

  it('ô tích Good for và Badges: payload theo thứ tự danh sách, không theo thứ tự bấm', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: detailFixture() });
    const { user } = renderForm(detailFixture({ suitableFor: ['COUPLE'], badges: [] }), save);
    const box = (name: string) => screen.getByRole('checkbox', { name });

    expect(box(messages.travellerTypes.COUPLE)).toHaveAttribute('aria-checked', 'true');
    await user.click(box(messages.travellerTypes.SOLO));
    await user.click(box(messages.travellerTypes.FAMILY));
    await user.click(box(messages.travellerTypes.COUPLE));
    await user.click(box(messages.tourDetail.badges.BEST_VALUE));
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      suitableFor: ['FAMILY', 'SOLO'],
      badges: ['BEST_VALUE'],
    });
  });

  it('danh mục ĐANG ẨN của tour được chọn sẵn, nhãn mang "(hidden)"', () => {
    renderForm(detailFixture({ categoryId: HIDDEN_CATEGORY_ID }));

    expect(screen.getByRole('combobox', { name: t.category })).toHaveTextContent(
      'Retired (hidden)',
    );
  });

  it('server trả DURATION_LOCKED → câu dưới ô số ngày, không có dải báo', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, code: 'DURATION_LOCKED' });
    const { user } = renderForm(detailFixture({ isPublished: false }), save);

    await user.clear(field(t.durationDays));
    await user.type(field(t.durationDays), '2');
    await user.click(saveButton());

    // Câu phải nối vào CHÍNH ô số ngày: dải báo của form cũng in được đúng câu
    // này, nên chỉ tìm một `alert` có chữ ấy là không phân biệt được hai chỗ.
    await waitFor(() =>
      expect(field(t.durationDays)).toHaveAccessibleDescription(
        expect.stringContaining(e.details.errors.DURATION_LOCKED),
      ),
    );
    expect(field(t.durationDays)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(e.banners.stale)).not.toBeInTheDocument();
  });

  it('server trả GROUP_SIZE_BELOW_SEATS → câu dưới ô số khách, không có dải báo', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, code: 'GROUP_SIZE_BELOW_SEATS' });
    const { user } = renderForm(detailFixture(), save);

    await user.clear(field(t.maxGroupSize));
    await user.type(field(t.maxGroupSize), '8');
    await user.click(saveButton());

    await waitFor(() =>
      expect(field(t.maxGroupSize)).toHaveAccessibleDescription(
        expect.stringContaining(e.details.errors.GROUP_SIZE_BELOW_SEATS),
      ),
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('server trả STALE_TOUR → dải báo kèm Reload, chữ đang gõ còn nguyên', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, code: 'STALE_TOUR' });
    const { user } = renderForm(detailFixture(), save);

    await user.clear(field(t.title));
    await user.type(field(t.title), 'Mine');
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByText(e.banners.stale)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: e.banners.reload })).toBeInTheDocument();
    expect(field(t.title)).toHaveValue('Mine');
  });

  it('ô tóm tắt và khung điểm đến mang id mà khung readiness trỏ tới', () => {
    renderForm();

    expect(field(t.summary)).toHaveAttribute('id', 'tour-summary');
    expect(document.getElementById('tour-destinations')).not.toBeNull();
    expect(
      within(document.getElementById('tour-destinations') as HTMLElement).getByRole('combobox', {
        name: t.destination,
      }),
    ).toBeInTheDocument();
  });

  it('nút Delete chỉ có khi tour chưa từng có booking', () => {
    const { unmount } = render(
      <TourDetailsForm
        detail={detailFixture({ bookingCount: 0 })}
        options={OPTIONS}
        save={vi.fn()}
        remove={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: e.delete.action })).toBeInTheDocument();
    unmount();

    renderForm(detailFixture({ bookingCount: 1 }));
    expect(screen.queryByRole('button', { name: e.delete.action })).not.toBeInTheDocument();
  });

  it('lưu hai lần liền: lần hai gửi version của response lần một, không phải của props', async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        detail: detailFixture({ title: 'First', version: NEXT_VERSION }),
      })
      .mockResolvedValueOnce({
        ok: true,
        detail: detailFixture({ title: 'Second', version: '2026-09-24T10:11:14.000Z' }),
      });
    const { user } = renderForm(detailFixture(), save);

    await user.clear(field(t.title));
    await user.type(field(t.title), 'First');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-disabled', 'true'));

    await user.clear(field(t.title));
    await user.type(field(t.title), 'Second');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));

    expect(save.mock.calls[0]?.[0].version).toBe(VERSION);
    expect(save.mock.calls[1]?.[0].version).toBe(NEXT_VERSION);
  });
});
