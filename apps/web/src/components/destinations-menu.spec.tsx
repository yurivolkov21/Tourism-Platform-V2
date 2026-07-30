import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { DestinationsMenu } from './destinations-menu';

// Menu rút còn ĐÚNG BỐN mục (user chốt 30/07): All + ba vùng. Bốn test dưới đây
// THAY bốn test cũ vốn khẳng định "mỗi nhóm vùng liệt kê đúng 3 địa danh" — bất
// biến đó không còn tồn tại vì 9 link địa danh đã bị bỏ hẳn.
//
// NavigationMenuContent của Base UI không mount vào DOM cho tới khi trigger mở
// popup (`keepMounted` mặc định false) — phải bấm trigger trước khi query.
async function openMenu() {
  const user = userEvent.setup();
  render(<DestinationsMenu />);
  await user.click(screen.getByRole('button', { name: /destinations/i }));
  // Popup portal ra ngoài cây React gốc; đợi mục "All destinations" xuất hiện là
  // dấu hiệu nội dung đã mount xong.
  await screen.findByRole('link', { name: new RegExp(messages.nav.destinationsMenu.all, 'i') });
}

/** Đường dẫn mong đợi — viết TAY, không map lại từ `REGIONS`. Tự tính lại bằng
    chính dữ liệu component đọc thì một bug trong `slug` sẽ lọt qua test. */
const EXPECTED_HREFS = [
  '/destinations',
  '/destinations/northern-vietnam',
  '/destinations/central-vietnam',
  '/destinations/southern-vietnam',
];

describe('DestinationsMenu — đúng bốn mục', () => {
  it('có ĐÚNG 4 link, không hơn', async () => {
    await openMenu();
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('bốn link trỏ đúng bốn trang, theo đúng thứ tự All → Bắc → Trung → Nam', async () => {
    await openMenu();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(EXPECTED_HREFS);
  });

  // Chốt chặn cho chính yêu cầu của user: menu KHÔNG được quay lại kiểu trải
  // danh sách địa danh. Link địa danh có dạng `/tours?destinations=<slug>`, nên
  // sự vắng mặt của chuỗi đó là phép khẳng định trực tiếp — thêm lại 9 link cũ
  // là test này ĐỎ ngay, chứ không im lặng đi qua như một phép đếm nới lỏng.
  it('KHÔNG còn link lọc theo địa danh nào', async () => {
    await openMenu();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((h) => h.includes('destinations='))).toHaveLength(0);
  });

  it('mỗi dòng vùng mang tên vùng và câu gợi ý của chính vùng đó', async () => {
    await openMenu();
    for (const region of REGIONS) {
      // `data-region` là móc cấu trúc: khoanh đúng một dòng để không nhặt chữ của
      // vùng bên cạnh.
      const row = screen
        .getByText(region.name)
        .closest(`[data-region="${region.key}"]`) as HTMLElement | null;
      expect(row, region.key).not.toBeNull();
      const hint = messages.nav.destinationsMenu.regionHints[region.key];
      expect(within(row as HTMLElement).getByText(hint)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByRole('link')).toHaveAttribute(
        'href',
        `/destinations/${region.slug}`,
      );
    }
  });
});
