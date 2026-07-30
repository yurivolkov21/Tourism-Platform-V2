import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AMPLITUDE } from '@/lib/motion';
import { RevealItem } from './reveal-item';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `RevealItem` dùng `whileInView`
  // — thiếu API này là ném ReferenceError lúc mount. Stub tối giản là đủ, và nó
  // còn là ĐIỀU KIỆN của các test dưới đây: observer không bao giờ bắn nên phần tử
  // đứng nguyên ở `initial`, tức `style` đọc được chính là trạng thái HTML server.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù vài spec khác có bản y hệt:
  // đã đo — dời lên setup chung làm **19 test ở 3 file khác gãy**, vì có global
  // này thì framer-motion đi nhánh khác hẳn so với khi không có.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function styleOf(html: HTMLElement, selector = 'div'): string {
  return html.querySelector<HTMLElement>(selector)?.getAttribute('style') ?? '';
}

describe('RevealItem — ba chữ ký, ba trục', () => {
  it('rise trượt DỌC đúng biên độ nhà', () => {
    const { container } = render(<RevealItem enter="rise">x</RevealItem>);
    expect(styleOf(container)).toContain(`translateY(${AMPLITUDE.rise}px)`);
  });

  // Trục x đi từ TRÁI: đó là hướng đọc, và nó là phía an toàn — nội dung tràn sang
  // trái bị cắt chứ KHÔNG sinh thanh cuộn ngang như tràn sang phải.
  it('slide trượt NGANG từ trái, biên độ âm', () => {
    const { container } = render(<RevealItem enter="slide">x</RevealItem>);
    expect(styleOf(container)).toContain(`translateX(-${AMPLITUDE.slide}px)`);
  });

  it('bloom NỞ RA từ nhỏ hơn 1, không dịch chỗ', () => {
    const { container } = render(<RevealItem enter="bloom">x</RevealItem>);
    const style = styleOf(container);
    expect(style).toContain(`scale(${AMPLITUDE.bloom})`);
    expect(style).not.toMatch(/translate/);
  });

  it('ba chữ ký cho ba transform KHÁC nhau — không phải ba tên cho một nhịp', () => {
    const seen = (['rise', 'slide', 'bloom'] as const).map((enter) => {
      const { container, unmount } = render(<RevealItem enter={enter}>x</RevealItem>);
      const style = styleOf(container);
      unmount();
      return style;
    });
    expect(new Set(seen).size).toBe(3);
  });
});

describe('RevealItem — ràng buộc SSG: phải đọc được khi JS chưa chạy', () => {
  // Bài học đo được trước Task 5m: `initial={{ opacity: 0 }}` cộng `whileInView` là
  // nội dung KHÔNG BAO GIỜ hiện nếu JS chết, vì motion render `initial` thành style
  // inline ngay trong HTML của server. Trang vùng là SSG.
  it.each(['rise', 'slide', 'bloom'] as const)('%s không đặt opacity vào initial', (enter) => {
    const { container } = render(<RevealItem enter={enter}>x</RevealItem>);
    expect(styleOf(container)).not.toContain('opacity');
  });

  // Biên độ x là chỗ 5n có rủi ro RIÊNG mà trục y không có: 16px đúng bằng gutter
  // hẹp nhất của trang vùng (`px-4`), ĐO được ở 390px là khe trái/phải = 16 cho mọi
  // phần tử ứng viên trên cả ba miền. Lớn hơn là cắt chữ ở mép trái hoặc sinh thanh
  // cuộn ngang ở mép phải.
  it('biên độ x không vượt gutter hẹp nhất đã đo', () => {
    expect(AMPLITUDE.slide).toBeLessThanOrEqual(16);
  });

  // `scale` chỉ được nhỏ ĐI, không được lớn hơn 1: một phần tử phóng to khi JS chết
  // là phần tử phủ lên hàng xóm của nó.
  it('bloom chỉ thu nhỏ, không phóng to', () => {
    expect(AMPLITUDE.bloom).toBeLessThan(1);
    expect(AMPLITUDE.bloom).toBeGreaterThan(0.9);
  });
});

describe('RevealItem — thẻ render được', () => {
  it('mặc định là div', () => {
    const { container } = render(<RevealItem enter="rise">x</RevealItem>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  // `h3` cần thiết vì tiêu đề khối highlight của khu intro phải đi CÙNG nhịp với ba
  // mục dưới nó — để nó đứng im trên một danh sách đang trượt thì nó đọc thành một
  // mẩu sót lại (cùng lý lẽ 5m đã áp cho nhãn `Best months` của khu mùa).
  it('as="h3" render đúng h3, không phải div bọc thêm', () => {
    const { container } = render(
      <RevealItem as="h3" enter="rise">
        x
      </RevealItem>,
    );
    expect(container.firstElementChild?.tagName).toBe('H3');
  });

  it('className đi thẳng vào phần tử — chỗ gọi không phải bọc thêm hộp nào', () => {
    const { container } = render(
      <RevealItem enter="rise" className="border-t pt-6">
        x
      </RevealItem>,
    );
    expect(container.firstElementChild?.className).toBe('border-t pt-6');
  });
});
