import { act, render, screen } from '@testing-library/react';
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

  it('link trong trang trỏ hash khác thì tab đổi theo', () => {
    // Thẻ policy ở panel đặt chỗ và link trong card dữ kiện đều là <a href="#...">.
    // Không nghe `hashchange` thì URL đổi mà tab đứng yên — bấm xong không thấy
    // gì xảy ra.
    render(<TourTabs panels={panels} />);
    // `act` bắt buộc: `hashchange` bắn NGOÀI React nên setState của listener
    // không được flush trước khi assert nếu không bọc.
    act(() => {
      window.location.hash = '#good-to-know';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.goodToKnow })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('ghi hash bằng replaceState — không đẻ mục lịch sử để Back phải bấm 5 lần', async () => {
    const before = window.history.length;
    render(<TourTabs panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.itinerary }));
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.reviews }));
    expect(window.history.length).toBe(before);
  });

  it('CHỈ panel Itinerary bị bó hẹp 768 — bốn panel kia dùng trọn bề ngang', () => {
    // `.pane.narrow` trong wireframe chỉ gắn cho tab Itinerary: dòng lịch trình
    // là văn xuôi, đọc hết 1056 thì dài quá tầm mắt.
    const { container } = render(<TourTabs panels={panels} />);
    const narrow = container.querySelectorAll('[data-narrow="true"]');
    expect(narrow).toHaveLength(1);
    expect(narrow[0]).toHaveTextContent('ITINERARY_BODY');
  });
});
