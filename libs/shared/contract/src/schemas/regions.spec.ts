import { findRegion, REGIONS, RegionNameSchema } from './regions.js';

/**
 * Ba vùng miền là từ vựng chung, sống ở contract (ADR-0045).
 *
 * Bộ test này canh HAI mặt của cùng một từ vựng:
 *
 * - **Ghi thì chặt.** `RegionNameSchema` là cổng admin ghi xuống cột
 *   `destinations.region` — chỉ ba `name`, không hơn. Cột là `VARCHAR(80)` chữ
 *   tự do, nên một lần gõ nhầm lọt qua đây là một điểm đến biến khỏi mọi trang
 *   vùng mà không có lỗi nào ở đâu cả.
 * - **Đọc thì rộng.** `findRegion` là luật xếp một chuỗi đã nằm trong DB vào
 *   một vùng — nhận cả `name` lẫn `key`, không phân biệt hoa-thường. Web xếp
 *   điểm đến vào trang vùng bằng nó, admin chọn sẵn ô vùng bằng nó; hai bên
 *   đọc chung một hàm thì không thể đọc cùng một hàng ra hai vùng khác nhau.
 */

describe('REGIONS', () => {
  it('đúng ba vùng, xếp Bắc → Trung → Nam', () => {
    // Thứ tự có nghĩa: menu vùng, sitemap và tie-break của `topDestinations`
    // phía web đều đọc theo chỉ số của mảng này.
    expect(REGIONS.map((region) => region.key)).toEqual(['north', 'central', 'south']);
  });

  it('slug là từ vựng URL của ba trang vùng — đổi là ba trang biến khỏi bản build', () => {
    expect(REGIONS.map((region) => region.slug)).toEqual([
      'northern-vietnam',
      'central-vietnam',
      'southern-vietnam',
    ]);
  });

  it('`name` là đúng chuỗi mà 18 hàng dữ liệu hiện có đang lưu', () => {
    // ADR-0045: lưu `name` xuống DB chứ không lưu `key`, vì dữ liệu đang có
    // lưu `name` — đổi một chữ ở đây là admin ghi ra một giá trị khác hẳn mọi
    // hàng cũ.
    expect(REGIONS.map((region) => region.name)).toEqual([
      'Northern Vietnam',
      'Central Vietnam',
      'Southern Vietnam',
    ]);
  });
});

describe('RegionNameSchema — cổng GHI, chỉ ba giá trị', () => {
  it('nhận đúng ba `name`', () => {
    for (const region of REGIONS) {
      expect(RegionNameSchema.safeParse(region.name).success).toBe(true);
    }
  });

  it('từ chối mọi chuỗi khác, kể cả thứ `findRegion` đọc được', () => {
    // Đọc thì rộng để không bỏ rơi dữ liệu cũ; ghi thì chặt để không đẻ thêm
    // dữ liệu kiểu cũ. `North` và `north` đọc ra miền Bắc, nhưng admin không
    // được GHI chúng xuống.
    for (const value of ['North', 'north', 'northern vietnam', ' Northern Vietnam', 'Mekong', '']) {
      expect(RegionNameSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe('findRegion — cổng ĐỌC, chuẩn hoá chuỗi tự do trong DB', () => {
  it('khớp `name`, không phân biệt hoa-thường, bỏ khoảng trắng thừa', () => {
    expect(findRegion(REGIONS, 'Northern Vietnam')?.key).toBe('north');
    expect(findRegion(REGIONS, '  southern vietnam ')?.key).toBe('south');
  });

  it('khớp cả `key` — dạng khoá ngắn mà web vẫn nhận từ trước', () => {
    expect(findRegion(REGIONS, 'central')?.key).toBe('central');
    expect(findRegion(REGIONS, 'North')?.key).toBe('north');
  });

  it('chuỗi lạ hay `null` thì KHÔNG đoán', () => {
    // Đoán sai là xếp điểm đến vào vùng sai — tệ hơn không xếp.
    expect(findRegion(REGIONS, 'Mekong')).toBeUndefined();
    expect(findRegion(REGIONS, '')).toBeUndefined();
    expect(findRegion(REGIONS, null)).toBeUndefined();
  });

  it('thứ admin GHI thì web ĐỌC ra đúng vùng ấy', () => {
    // Đây là đường nối giữa hai cổng: một giá trị qua được `RegionNameSchema`
    // mà `findRegion` không nhận là một điểm đến vừa lưu xong đã tàng hình.
    for (const region of REGIONS) {
      const written = RegionNameSchema.parse(region.name);
      expect(findRegion(REGIONS, written)?.key).toBe(region.key);
    }
  });

  it('trả CHÍNH mục của danh sách truyền vào — web dùng lại được với kiểu của nó', () => {
    const regions = [{ key: 'north', name: 'Northern Vietnam', extra: 1 }] as const;

    expect(findRegion(regions, 'north')).toBe(regions[0]);
  });
});
