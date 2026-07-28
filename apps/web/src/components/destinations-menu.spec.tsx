import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { DestinationsMenu } from './destinations-menu';

// Fix review Important (Task 2, cụm Destinations): `dest.region` giờ mang TÊN
// HIỂN THỊ ('Northern Vietnam'), không còn khớp trực tiếp `region.key`
// ('north'). Component lọc DESTINATIONS theo `regionOf(REGIONS, dest) ===
// region.key` — nếu ai quay lại so thô `dest.region === region.key`, MỌI
// nhóm vùng rỗng trơn (dropdown Destinations trên navbar rỗng cả ba vùng).
//
// NavigationMenuContent của Base UI không mount vào DOM cho tới khi trigger
// mở popup (keepMounted mặc định false) — phải bấm trigger trước khi query.
async function openMenu() {
  const user = userEvent.setup();
  render(<DestinationsMenu />);
  await user.click(screen.getByRole('button', { name: /destinations/i }));
  // Popup portal ra ngoài cây React gốc; đợi một link bất kỳ xuất hiện là dấu
  // hiệu nội dung đã mount xong.
  await screen.findByRole('link', { name: /Sa Pa/i });
}

/** Sự thật nền cố định theo đúng fixture DESTINATIONS (3 địa điểm/vùng, xếp
    Bắc→Trung→Nam) — viết tay, KHÔNG gọi lại regionOf() để tính, để một bug
    trong hàm đó không lọt qua test. */
const EXPECTED_SLUGS_BY_REGION: Record<string, string[]> = {
  north: ['sa-pa', 'ha-long', 'ninh-binh'],
  central: ['hue', 'da-nang', 'hoi-an'],
  south: ['sai-gon', 'can-tho', 'phu-quoc'],
};

function groupFor(regionKey: string) {
  // Mỗi nhóm vùng là một <div data-region="…"> bọc tiêu đề + <ul> địa danh.
  const heading = screen.getByText(REGIONS.find((r) => r.key === regionKey)?.name ?? '');
  const group = heading.closest(`[data-region="${regionKey}"]`);
  expect(group).not.toBeNull();
  return group as HTMLElement;
}

describe('DestinationsMenu — mỗi nhóm vùng liệt kê ĐÚNG địa điểm của vùng đó', () => {
  it('nhóm North liệt kê đúng 3 địa danh của vùng North, không lẫn vùng khác', async () => {
    await openMenu();
    const group = groupFor('north');
    const links = within(group).getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const slug of EXPECTED_SLUGS_BY_REGION.north) {
      const dest = DESTINATIONS.find((d) => d.slug === slug);
      expect(dest).toBeDefined();
      expect(within(group).getByText(dest?.name as string)).toBeInTheDocument();
    }
  });

  it('nhóm Central liệt kê đúng 3 địa danh của vùng Central, không lẫn vùng khác', async () => {
    await openMenu();
    const group = groupFor('central');
    const links = within(group).getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const slug of EXPECTED_SLUGS_BY_REGION.central) {
      const dest = DESTINATIONS.find((d) => d.slug === slug);
      expect(dest).toBeDefined();
      expect(within(group).getByText(dest?.name as string)).toBeInTheDocument();
    }
  });

  it('nhóm South liệt kê đúng 3 địa danh của vùng South, không lẫn vùng khác', async () => {
    await openMenu();
    const group = groupFor('south');
    const links = within(group).getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const slug of EXPECTED_SLUGS_BY_REGION.south) {
      const dest = DESTINATIONS.find((d) => d.slug === slug);
      expect(dest).toBeDefined();
      expect(within(group).getByText(dest?.name as string)).toBeInTheDocument();
    }
  });

  it('không nhóm vùng nào rỗng — tổng cộng đủ 9 link trên toàn menu', async () => {
    await openMenu();
    // Khẳng định dương độc lập với cách nhóm: nếu so thô làm filter() luôn
    // rỗng, popup vẫn mount nhưng KHÔNG có link địa danh nào cả.
    expect(screen.getAllByRole('link')).toHaveLength(DESTINATIONS.length);
  });
});
