import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { TourUnpublishedNotice } from './tour-unpublished-notice';

/**
 * Dòng báo tour chưa đăng (spec F16 §2h). Giai đoạn chỉ tả chuyến, nên chuyến
 * `on-sale` của một tour đang ẩn vẫn mang huy hiệu xanh — dòng này là nơi
 * DUY NHẤT nói rằng khách không đặt được.
 */
const t = messages.admin.departures.list.unpublished;

describe('TourUnpublishedNotice', () => {
  it('tour CHƯA đăng: nói rõ khách không đặt được chuyến nào, kể cả chuyến On sale', () => {
    render(<TourUnpublishedNotice isPublished={false} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(t.title);
    expect(notice).toHaveTextContent(t.body);
  });

  it('là vùng `status`, không phải `alert` — thông tin tĩnh không được ngắt lời trình đọc màn hình', () => {
    render(<TourUnpublishedNotice isPublished={false} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('tour ĐÃ đăng: không hiện gì', () => {
    const { container } = render(<TourUnpublishedNotice isPublished />);

    expect(container).toBeEmptyDOMElement();
  });

  it('`isPublished` VẮNG MẶT (API cũ trong khe deploy): không báo động giả', () => {
    // Vercel thường deploy xong trước Render; vài phút ấy tour chưa có field
    // này. Coi "không biết" là "chưa đăng" thì mọi tour đang bán đều hiện câu
    // báo sai (vòng review F16) — chỉ báo khi server nói rõ `false`.
    const { container } = render(
      <TourUnpublishedNotice isPublished={undefined as unknown as boolean} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
