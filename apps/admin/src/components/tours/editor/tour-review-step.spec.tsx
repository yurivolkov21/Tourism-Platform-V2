import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { SetPublishedAction } from '@/lib/tours-publish';
import { detailFixture } from '@/test/tour-detail';
import { TourDetailProvider, useWorkspaceDetail } from './tour-detail-context';
import { TourReviewStep } from './tour-review-step';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Bước Review & publish (ADR-0049 §3): danh sách kiểm tra dựng bằng CHÍNH `tourSteps`
 * của thanh bước, công tắc On sale khoá chiều bật khi tour còn thiếu, vùng xoá chỉ khi
 * tour chưa từng có booking.
 */
const e = messages.admin.tours.editor;
const r = e.review;
const s = e.steps;

/** Đọc bản mà phần đầu (provider) đang giữ — để thấy bước Review có đẩy bản mới lên không. */
function HeaderProbe() {
  const detail = useWorkspaceDetail();
  return (
    <p data-testid="header-probe">
      {`${detail.isPublished ? 'on' : 'off'} · ${detail.departureCount} departures`}
    </p>
  );
}

/**
 * `detail` là bản TRANG vừa đọc; `layout` là bản cũ hơn mà layout (provider) đang giữ —
 * layout không render lại khi chuyển bước phía client (vòng review F19).
 */
function renderStep(
  detail: AdminTourDetail,
  {
    layout = detail,
    setPublished = vi.fn<SetPublishedAction>(),
  }: { layout?: AdminTourDetail; setPublished?: SetPublishedAction } = {},
) {
  render(
    <TourDetailProvider detail={layout}>
      <HeaderProbe />
      <TourReviewStep detail={detail} setPublished={setPublished} remove={vi.fn()} />
    </TourDetailProvider>,
  );
}

const rows = () => within(screen.getByRole('list', { name: r.title })).getAllByRole('listitem');
const toggle = () =>
  screen.getByRole('switch', {
    name: messages.admin.tours.publish.toggleLabel('Ha Long Bay Cruise'),
  });

describe('TourReviewStep — danh sách kiểm tra', () => {
  it('năm hàng — mọi bước trừ chính nó — cùng dòng trạng thái với thanh bước', () => {
    renderStep(detailFixture());
    expect(rows().map((row) => row.textContent)).toEqual([
      `${s.state.ok}${e.tabs.details}${s.detailsReady}`,
      `${s.state.ok}${e.tabs.photos}1 photo · cover set`,
      `${s.state.ok}${e.tabs.itinerary}${s.itineraryReady}`,
      `${s.state.optional}${e.tabs.content}Optional · 0 questions · 0 policies`,
      `${s.state.optional}${e.tabs.costs}Optional · no cost lines`,
    ]);
    expect(screen.queryAllByRole('link', { name: /^Fix/ })).toHaveLength(0);
  });

  it('bước thiếu: CHỈ hàng ấy có nút Fix, trỏ tới chỗ thiếu đầu tiên', () => {
    renderStep(
      detailFixture({
        isPublished: false,
        itinerary: [{ dayNumber: 1, title: 'Board the boat', description: null }],
      }),
    );
    const itinerary = rows()[2] as HTMLElement;
    expect(itinerary).toHaveTextContent(
      `${s.state.warn}${e.tabs.itinerary}Missing: an itinerary for days 2–3`,
    );
    // Tên truy cập kèm tên bước: nhiều link "Fix" phải phân biệt được (vòng review F19).
    const fix = within(itinerary).getByRole('link', { name: r.fixLabel(e.tabs.itinerary) });
    expect(fix).toHaveAttribute('href', '/tours/ha-long-bay-cruise/itinerary#day-2');
    expect(fix).toHaveTextContent(r.fix);
    expect(screen.getAllByRole('link', { name: /^Fix/ })).toHaveLength(1);
  });
});

describe('TourReviewStep — Visibility', () => {
  it('tắt bán mà còn thiếu: công tắc khoá, trình đọc màn hình nghe vì sao', () => {
    renderStep(detailFixture({ isPublished: false, summary: null }));
    expect(toggle()).toHaveAttribute('aria-disabled', 'true');
    expect(toggle()).toHaveAccessibleDescription(e.toggleBlocked);
    expect(screen.getByText(r.visibility.offSale)).toBeInTheDocument();
  });

  it('tắt bán mà đủ: công tắc bấm được, không có câu khoá', () => {
    renderStep(detailFixture({ isPublished: false }));
    expect(toggle()).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText(e.toggleBlocked)).toBeNull();
  });

  it('đang bán: công tắc bật, câu trạng thái và câu "gỡ bán luôn được"', () => {
    renderStep(detailFixture());
    expect(toggle()).toBeChecked();
    expect(screen.getByText(r.visibility.onSale)).toBeInTheDocument();
    expect(screen.getByText(r.visibility.always)).toBeInTheDocument();
    for (const item of r.after.items) expect(screen.getByText(item)).toBeInTheDocument();
  });
});

describe('TourReviewStep — xoá tour', () => {
  it('chưa từng có booking: vùng xoá như cũ', () => {
    renderStep(detailFixture());
    expect(screen.getByRole('button', { name: e.delete.action })).toBeInTheDocument();
    expect(screen.queryByText(e.delete.blocked)).toBeNull();
  });

  it('đã có booking và còn bán: không nút xoá; nói vì sao và khuyên gỡ bán', () => {
    renderStep(detailFixture({ bookingCount: 2 }));
    expect(screen.queryByRole('button', { name: e.delete.action })).toBeNull();
    const zone = screen.getByRole('region', { name: e.delete.title });
    expect(zone).toHaveTextContent(e.delete.blocked);
    expect(zone).toHaveTextContent(e.delete.blockedOnSale);
  });

  it('đã có booking mà đã gỡ bán: không khuyên gỡ bán thêm lần nữa (vòng review F19)', () => {
    renderStep(detailFixture({ bookingCount: 2, isPublished: false }));
    const zone = screen.getByRole('region', { name: e.delete.title });
    expect(zone).toHaveTextContent(e.delete.blocked);
    expect(zone).not.toHaveTextContent(e.delete.blockedOnSale);
  });

  // Layout giữ bản cũ (0 chuyến) vì không render lại khi chuyển bước; trang vừa đọc 3.
  it('đọc bản của TRANG: hộp xoá đếm đúng số chuyến sẽ mất theo, và phần đầu theo kịp', () => {
    renderStep(detailFixture({ departureCount: 3 }), {
      layout: detailFixture({ departureCount: 0 }),
    });
    fireEvent.click(screen.getByRole('button', { name: e.delete.action }));
    expect(screen.getByRole('dialog', { name: e.delete.dialog.title })).toHaveTextContent(
      'together with 3 departures',
    );
    expect(screen.getByTestId('header-probe')).toHaveTextContent('3 departures');
  });

  it('ngoài provider (layout không đọc được tour) vẫn dựng được', () => {
    render(<TourReviewStep detail={detailFixture()} setPublished={vi.fn()} remove={vi.fn()} />);
    expect(screen.getByRole('list', { name: r.title })).toBeInTheDocument();
  });
});

describe('TourReviewStep — bật/tắt bán', () => {
  it('bật bán xong: phần đầu đổi NGAY, không chờ lượt refresh', async () => {
    const setPublished = vi
      .fn<SetPublishedAction>()
      .mockResolvedValue({ ok: true, isPublished: true, changed: true });
    renderStep(detailFixture({ isPublished: false }), { setPublished });
    expect(screen.getByTestId('header-probe')).toHaveTextContent('off');
    await act(async () => {
      fireEvent.click(toggle());
    });
    expect(screen.getByTestId('header-probe')).toHaveTextContent('on');
    expect(screen.getByText(r.visibility.onSale)).toBeInTheDocument();
  });
});
