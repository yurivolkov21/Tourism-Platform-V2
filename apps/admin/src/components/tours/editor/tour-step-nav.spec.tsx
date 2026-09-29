import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tourSteps } from '@/lib/tour-editor-view';
import { detailFixture } from '@/test/tour-detail';
import { TourStepNav } from './tour-step-nav';

let pathname = '/tours/ha-long-bay-cruise';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/tours/ha-long-bay-cruise';
});

/**
 * Thanh bước (ADR-0049 §1): sáu link chỉ có icon; tên bước và dòng trạng thái nằm
 * trong tooltip VÀ trong chữ `sr-only` của link — máy cảm ứng không có tooltip.
 */
const e = messages.admin.tours.editor;
// Tour tắt bán, chưa có ảnh: Photos thiếu, bước cuối còn một việc.
const STEPS = tourSteps(detailFixture({ isPublished: false, photos: [] }));

function renderNav() {
  render(<TourStepNav slug="ha-long-bay-cruise" steps={STEPS} />);
  return within(screen.getByRole('navigation', { name: e.tabsLabel })).getAllByRole('link');
}

describe('TourStepNav', () => {
  it('sáu link đúng thứ tự và đúng đường; tên link là tên bước kèm dòng trạng thái', () => {
    const links = renderNav();
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tours/ha-long-bay-cruise',
      '/tours/ha-long-bay-cruise/photos',
      '/tours/ha-long-bay-cruise/itinerary',
      '/tours/ha-long-bay-cruise/content',
      '/tours/ha-long-bay-cruise/costs',
      '/tours/ha-long-bay-cruise/review',
    ]);
    // Tên đọc-màn-hình, không phải `textContent`: dấu "!" ở góc là chữ trang trí
    // `aria-hidden` — nằm trong `textContent` nhưng không nằm trong tên của link.
    const names = [
      'Details: Summary and primary destination set',
      'Photos: Missing: a cover photo',
      'Itinerary: Every day planned',
      'FAQ & policies: Optional · 0 questions · 0 policies',
      'Costs: Optional · no cost lines',
      'Review & publish: 1 thing to fix',
    ];
    expect(links).toHaveLength(names.length);
    names.forEach((name, index) => {
      expect(links[index]).toHaveAccessibleName(name);
    });
  });

  it('bước đang mở mang aria-current="step"; ở Departures không bước nào sáng', () => {
    pathname = '/tours/ha-long-bay-cruise/photos';
    const links = renderNav();
    expect(
      links
        .filter((link) => link.getAttribute('aria-current') === 'step')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/tours/ha-long-bay-cruise/photos']);
  });

  it('ở trang Departures không link nào mang aria-current', () => {
    pathname = '/tours/ha-long-bay-cruise/departures';
    const links = renderNav();
    expect(links.some((link) => link.hasAttribute('aria-current'))).toBe(false);
  });

  it('dấu góc: ✓ ở bước đủ, "!" ở bước thiếu, không dấu ở bước tuỳ chọn và bước cuối', () => {
    const links = renderNav();
    const dot = (index: number) => links[index]?.querySelector('[data-slot="step-dot"]');
    expect(dot(0)?.querySelector('svg')).not.toBeNull();
    expect(dot(1)?.textContent).toBe('!');
    expect(dot(3)).toBeNull();
    expect(dot(5)).toBeNull();
    expect(links[3]).toHaveAttribute('data-status', 'optional');
  });

  it('rê chuột: tooltip hiện dòng trạng thái của bước', async () => {
    const user = userEvent.setup();
    const links = renderNav();
    expect(screen.queryByText('Missing: a cover photo')).toBeNull();
    await user.hover(links[1] as HTMLElement);
    expect(await screen.findByText('Missing: a cover photo')).toBeInTheDocument();
  });

  it('focus bằng bàn phím cũng hiện tooltip', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.tab();
    expect(await screen.findByText(e.steps.detailsReady)).toBeInTheDocument();
  });
});
