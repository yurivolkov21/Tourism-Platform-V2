import { render, screen, within } from '@testing-library/react';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { TourDetailProvider } from './tour-detail-context';
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

function renderStep(detail: AdminTourDetail) {
  render(
    <TourDetailProvider detail={detail}>
      <TourReviewStep setPublished={vi.fn()} remove={vi.fn()} />
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
    expect(screen.queryByRole('link', { name: r.fix })).toBeNull();
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
    expect(within(itinerary).getByRole('link', { name: r.fix })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/itinerary#day-2',
    );
    expect(screen.getAllByRole('link', { name: r.fix })).toHaveLength(1);
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
    expect(screen.queryByText(r.deleteBlocked.body)).toBeNull();
  });

  it('đã có booking: không có nút xoá, một câu nói vì sao', () => {
    renderStep(detailFixture({ bookingCount: 2 }));
    expect(screen.queryByRole('button', { name: e.delete.action })).toBeNull();
    expect(screen.getByRole('region', { name: r.deleteBlocked.title })).toHaveTextContent(
      r.deleteBlocked.body,
    );
  });
});
