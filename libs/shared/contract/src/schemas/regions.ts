import { z } from 'zod';

/**
 * Ba vùng miền — từ vựng chung của web, admin và API (ADR-0045).
 *
 * Sống ở contract chứ không ở `apps/web/src/mocks/` vì ba lý do, xếp theo sức
 * nặng: hai bản khai (picker của admin và trang vùng của web) là hai bản sẽ
 * trôi xa nhau mà không gì bắt được; luật dùng chung cho nhiều bề mặt đã có
 * nếp sống ở đây (ADR-0041 §8); và `mocks/` là chỗ của dữ liệu GIẢ, còn ba
 * vùng thì không giả chút nào — chúng là từ vựng mà dữ liệu thật phải khớp.
 *
 * Đây KHÔNG phải dữ liệu. Mỗi vùng có nguyên một trang với hero, gallery, mùa
 * và bưu thiếp viết tay trong `apps/web`, lấy chữ từ
 * `messages.regionPage.regions[key]` — thêm vùng thứ tư là một đợt việc của
 * web, không phải một dòng mới ở đây. Nếu vùng miền thật sự cần thành dữ liệu
 * biên tập được, đó là một ADR khác; đừng lặng lẽ nới enum này ra thành chữ tự do.
 */

/**
 * Bản khai DUY NHẤT. `as const` để ba `key` và ba `name` là kiểu chữ cụ thể —
 * `RegionKey` và `RegionNameSchema` bên dưới đều suy từ đây chứ không gõ lại.
 *
 * Thứ tự Bắc → Trung → Nam có nghĩa: menu vùng, sitemap và tie-break của
 * `topDestinations` phía web đều đọc theo chỉ số của mảng này.
 */
const REGION_LIST = [
  { key: 'north', slug: 'northern-vietnam', name: 'Northern Vietnam' },
  { key: 'central', slug: 'central-vietnam', name: 'Central Vietnam' },
  { key: 'south', slug: 'southern-vietnam', name: 'Southern Vietnam' },
] as const;

/** Khoá nội bộ của một vùng — đổ ra thuộc tính `data-region`, tra chữ trong i18n. */
export type RegionKey = (typeof REGION_LIST)[number]['key'];

/** Tên hiển thị — và cũng là giá trị lưu ở cột `destinations.region` (ADR-0045). */
export type RegionName = (typeof REGION_LIST)[number]['name'];

export interface Region {
  readonly key: RegionKey;
  /**
   * Từ vựng URL của `/destinations/[region]`. Cố ý KHÁC `key`: `key` là khoá
   * nội bộ, còn slug là chuyện SEO — trộn hai thứ lại mới là nợ.
   */
  readonly slug: string;
  readonly name: RegionName;
}

export const REGIONS: readonly Region[] = REGION_LIST;

/**
 * Cổng GHI xuống cột `destinations.region`: đúng ba `name`, không hơn.
 *
 * Cột là `VARCHAR(80)` chữ tự do, nên chốt nằm ở đây chứ không ở DB (lý do
 * không đổi cột thành enum Postgres: ADR-0045 "Đã cân nhắc và loại"). Chặt hơn
 * `findRegion` có chủ đích — đọc thì rộng để không bỏ rơi dữ liệu cũ, ghi thì
 * chặt để không đẻ thêm dữ liệu kiểu cũ.
 */
export const RegionNameSchema = z.enum(REGION_LIST.map((region) => region.name));

/**
 * Cổng ĐỌC: xếp một chuỗi đã nằm trong DB vào một vùng — nhận cả `name`
 * (`Northern Vietnam`) lẫn `key` (`north`), không phân biệt hoa-thường, bỏ
 * khoảng trắng thừa. Trả `undefined` khi không nhận ra: KHÔNG đoán, vì đoán
 * sai là xếp điểm đến vào vùng sai.
 *
 * Đây là luật mà `regionOf` của web vẫn chạy từ trước; nó dời về đây để admin
 * đọc CÙNG một luật khi chọn sẵn ô vùng của form sửa. Hai bản luật là một hàng
 * hiện ở miền Bắc trên web mà admin lại báo "chưa có vùng".
 *
 * Nhận danh sách qua tham số (cùng khuôn các hàm vùng của web, test được với
 * fixture nhỏ) và trả CHÍNH mục của danh sách ấy, để nơi gọi giữ nguyên kiểu
 * phần tử của mình.
 */
export function findRegion<R extends { readonly key: string; readonly name: string }>(
  regions: readonly R[],
  value: string | null,
): R | undefined {
  if (value === null) return undefined;
  const needle = value.trim().toLowerCase();
  return regions.find((region) => region.key === needle || region.name.toLowerCase() === needle);
}
