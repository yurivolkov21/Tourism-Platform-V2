import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { TourWorkspaceHeader } from './tour-workspace-header';

let pathname = '/tours/ha-long-bay-cruise';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/tours/ha-long-bay-cruise';
});

/**
 * Phần đầu khu sửa tour (ADR-0049 §4): chỉ còn trạng thái — không còn công tắc hay
 * khung readiness.
 */
const t = messages.admin.tours.editor;

describe('TourWorkspaceHeader', () => {
  it('đang bán: chip "On sale", View on site mở trang tour ở tab mới, lần lưu cuối giờ UTC', () => {
    render(<TourWorkspaceHeader detail={detailFixture()} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Ha Long Bay Cruise' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('/tours/ha-long-bay-cruise · Last saved 24 Sep 2026, 10:11 UTC'),
    ).toBeInTheDocument();
    expect(screen.getByText(t.header.onSale)).toBeInTheDocument();
    const site = screen.getByRole('link', { name: t.header.viewOnSite });
    expect(site).toHaveAttribute(
      'href',
      'https://www.nexora-travel.agency/tours/ha-long-bay-cruise',
    );
    expect(site).toHaveAttribute('target', '_blank');
    expect(site).toHaveAttribute('rel', 'noreferrer');
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('tắt bán: chip "Off sale", KHÔNG có View on site (trang web 404)', () => {
    render(<TourWorkspaceHeader detail={detailFixture({ isPublished: false })} />);
    expect(screen.getByText(t.header.offSale)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t.header.viewOnSite })).toBeNull();
  });

  it('Departures: link tới bảng chuyến; aria-current="page" chỉ khi đang ở đó', () => {
    const view = render(<TourWorkspaceHeader detail={detailFixture()} />);
    const departures = () => screen.getByRole('link', { name: t.tabs.departures });
    expect(departures()).toHaveAttribute('href', '/tours/ha-long-bay-cruise/departures');
    expect(departures()).not.toHaveAttribute('aria-current');

    pathname = '/tours/ha-long-bay-cruise/departures';
    view.rerender(<TourWorkspaceHeader detail={detailFixture()} />);
    expect(departures()).toHaveAttribute('aria-current', 'page');
  });
});
