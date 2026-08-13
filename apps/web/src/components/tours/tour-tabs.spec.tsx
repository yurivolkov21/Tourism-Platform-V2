import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TourTabs } from './tour-tabs';

const panels = {
  overview: <p>OVERVIEW_BODY</p>,
  itinerary: <p>ITINERARY_BODY</p>,
  departures: <p>DEPARTURES_BODY</p>,
  reviews: <p>REVIEWS_BODY</p>,
  goodToKnow: <p>GOODTOKNOW_BODY</p>,
};

describe('TourTabs', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/tours/x');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/tours/x');
  });

  it('render ĐỦ 5 panel vào DOM, chỉ ẩn bằng thuộc tính hidden', () => {
    // Trang tour là SSG nằm trong sitemap: mount có điều kiện = giấu lịch trình
    // khỏi crawler. Đây là ràng buộc của ADR-0022, không phải sở thích.
    render(<TourTabs panels={panels} />);
    for (const body of [
      'OVERVIEW_BODY',
      'ITINERARY_BODY',
      'DEPARTURES_BODY',
      'REVIEWS_BODY',
      'GOODTOKNOW_BODY',
    ]) {
      expect(screen.getByText(body)).toBeInTheDocument();
    }
  });

  it('mặc định mở tab đầu tiên khi URL không có hash', () => {
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.overview })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('hash trên URL mở đúng tab', () => {
    window.history.replaceState(null, '', '/tours/x#departures');
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.departures })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('hash lạ thì rơi về tab đầu, không để trang trống', () => {
    window.history.replaceState(null, '', '/tours/x#khong-ton-tai');
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.overview })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('đổi tab thì ghi lại hash', async () => {
    render(<TourTabs panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.reviews }));
    expect(window.location.hash).toBe('#reviews');
  });

  it('ghi hash bằng replaceState — không đẻ thêm mục lịch sử để nút Back phải bấm 5 lần', async () => {
    const before = window.history.length;
    render(<TourTabs panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.itinerary }));
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.reviews }));
    expect(window.history.length).toBe(before);
  });
});
