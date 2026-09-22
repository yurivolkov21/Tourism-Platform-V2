import { contract } from '../contract.js';
import {
  AdminDepartureCreateInputSchema,
  AdminDepartureRowSchema,
  AdminDepartureSetStatusInputSchema,
  AdminDeparturesListQuerySchema,
  AdminDepartureUpdateInputSchema,
  DEPARTURE_PRICE_MAX,
  DEPARTURE_SEATS_MAX,
} from './admin-departures.js';

/**
 * Contract `admin.departures` (spec P4e-1 F12) — bốn thao tác của bảng chuyến.
 *
 * Bộ test này canh những ràng buộc mà CHỈ schema quan sát được (không CHECK
 * nào ở DB nói hộ) và một bất biến an toàn: `setStatus` KHÔNG nhận `CANCELLED`.
 */

const ROW = {
  id: '4f1b1f2e-0000-4000-8000-000000000001',
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  price: '129.00',
  priceOverride: null,
  currency: 'USD',
  seatsBooked: 3,
  seatsTotal: 20,
  status: 'OPEN',
  cancellationDeadline: '2026-10-03',
  liveBookingCount: 2,
  pendingBookingCount: 1,
  version: '2026-09-20T08:00:00.000Z',
};

describe('AdminDepartureRowSchema', () => {
  it('nhận một hàng đầy đủ', () => {
    expect(AdminDepartureRowSchema.safeParse(ROW).success).toBe(true);
  });

  it('ba trạng thái của enum Prisma đều đọc được — kể cả CANCELLED', () => {
    // Đọc thì phải thấy: seed có ~13% chuyến lịch sử bị huỷ, và F13 sẽ sinh
    // thêm. Chặn CANCELLED là việc của INPUT `setStatus`, không phải của hàng.
    for (const status of ['OPEN', 'CLOSED', 'CANCELLED']) {
      expect(AdminDepartureRowSchema.safeParse({ ...ROW, status }).success).toBe(true);
    }
  });

  it('tiền đi qua dây dạng CHUỖI, không phải số', () => {
    expect(AdminDepartureRowSchema.safeParse({ ...ROW, price: 129 }).success).toBe(false);
  });

  it('`seatsTotal` ở ĐẦU RA rộng hơn ở đầu vào — một hàng lệch dải không được 500 cả trang', () => {
    // DB chỉ bảo đảm `seats_total >= 0`, không có trần. Khai chặt ở đầu ra thì
    // một hàng vá tay / import / tour `maxGroupSize > 500` sẽ trượt validation
    // và giết chính cái form dùng để sửa nó.
    expect(
      AdminDepartureRowSchema.safeParse({ ...ROW, seatsTotal: DEPARTURE_SEATS_MAX + 1 }).success,
    ).toBe(true);
    expect(AdminDepartureRowSchema.safeParse({ ...ROW, seatsTotal: -1 }).success).toBe(false);
  });

  it('`priceOverride` phân biệt được "giá riêng" với "thừa hưởng basePrice"', () => {
    // Form sửa cần biết ô giá đang TRỐNG (thừa hưởng) hay đang mang một con
    // số riêng — `price` đã gộp hai ca đó thành một.
    expect(AdminDepartureRowSchema.safeParse({ ...ROW, priceOverride: '99.00' }).success).toBe(
      true,
    );
  });
});

describe('AdminDeparturesListQuerySchema', () => {
  it('slug bắt buộc — bảng luôn thuộc về đúng MỘT tour', () => {
    expect(AdminDeparturesListQuerySchema.safeParse({}).success).toBe(false);
  });

  it('page/limit thừa hưởng mặc định của mọi list admin', () => {
    const parsed = AdminDeparturesListQuerySchema.parse({ slug: 'ha-long-bay-cruise' });

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it('lọc theo trạng thái nhận cả ba giá trị', () => {
    expect(
      AdminDeparturesListQuerySchema.safeParse({ slug: 'a-tour', status: 'CANCELLED' }).success,
    ).toBe(true);
  });
});

describe('AdminDepartureCreateInputSchema', () => {
  const BASE = { slug: 'ha-long-bay-cruise', startDate: '2026-12-01', endDate: '2026-12-03' };

  it('ghế tối thiểu 1 — một chuyến 0 ghế không phải là một chuyến', () => {
    expect(AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: 0 }).success).toBe(
      false,
    );
    expect(AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: 1 }).success).toBe(
      true,
    );
  });

  it('ghế có TRẦN — một số nguyên không chặn trên là một ô nhập chờ tai nạn', () => {
    expect(
      AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: DEPARTURE_SEATS_MAX })
        .success,
    ).toBe(true);
    expect(
      AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: DEPARTURE_SEATS_MAX + 1 })
        .success,
    ).toBe(false);
  });

  it('giá để trống = thừa hưởng `basePrice` của tour', () => {
    const parsed = AdminDepartureCreateInputSchema.parse({ ...BASE, seatsTotal: 12 });

    expect(parsed.priceOverride).toBeNull();
  });

  it('giá riêng là chuỗi thập phân không âm', () => {
    expect(
      AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: 12, priceOverride: '-1.00' })
        .success,
    ).toBe(false);
    expect(
      AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: 12, priceOverride: '99.50' })
        .success,
    ).toBe(true);
  });

  it('giá quá 2 chữ số lẻ bị CHẶN, không bị cột làm tròn hộ', () => {
    // `129.999` đi lọt sẽ thành `130.00` ở cột `Decimal(14,2)` — một con số
    // khách phải trả mà không ai gõ vào.
    expect(
      AdminDepartureCreateInputSchema.safeParse({
        ...BASE,
        seatsTotal: 12,
        priceOverride: '129.999',
      }).success,
    ).toBe(false);
  });

  it('giá có TRẦN — tràn cột là 500, mà 500 thì kit đóng dialog và mất cả form', () => {
    const qua = String(DEPARTURE_PRICE_MAX + 1);
    expect(
      AdminDepartureCreateInputSchema.safeParse({ ...BASE, seatsTotal: 12, priceOverride: qua })
        .success,
    ).toBe(false);
    expect(
      AdminDepartureCreateInputSchema.safeParse({
        ...BASE,
        seatsTotal: 12,
        priceOverride: '999999999999.99',
      }).success,
    ).toBe(true);
  });

  it('ngày ngoài dải 1900–2099 bị chặn ngay ở biên', () => {
    // `CalendarDateSchema` dùng chung: một ngày năm 9999 rơi xuống driver
    // Postgres qua phép cộng biên là một `+010000-…` không schema nào bắt.
    expect(
      AdminDepartureCreateInputSchema.safeParse({
        ...BASE,
        startDate: '3000-01-01',
        seatsTotal: 12,
      }).success,
    ).toBe(false);
  });
});

describe('AdminDepartureUpdateInputSchema', () => {
  it('thay TRỌN bốn field sửa được, không phải patch từng phần', () => {
    // Dialog luôn mở với giá trị hiện tại nên gửi đủ là tự nhiên; `undefined`
    // nghĩa là "giữ nguyên" thì service phải đoán, và "xoá giá riêng" lại
    // trùng hình dạng với "không đụng tới giá".
    const full = {
      id: '4f1b1f2e-0000-4000-8000-000000000001',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      seatsTotal: 18,
      priceOverride: null,
      version: '2026-09-20T08:00:00.000Z',
    };

    expect(AdminDepartureUpdateInputSchema.safeParse(full).success).toBe(true);
    const { seatsTotal: _seats, ...missingSeats } = full;
    expect(AdminDepartureUpdateInputSchema.safeParse(missingSeats).success).toBe(false);
  });

  it('BẮT BUỘC có `version` — thiếu token là mở lại đúng cửa ghi đè mù', () => {
    // `FOR UPDATE` tuần tự hoá hai lệnh ghi nhưng không phát hiện được cái cũ:
    // payload mang giá trị từ FORM, không từ hàng vừa khoá. Không token thì
    // tab mở lúc 10:00 ghi đè êm ru thay đổi của tab 10:01.
    const khongVersion = {
      id: '4f1b1f2e-0000-4000-8000-000000000001',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      seatsTotal: 18,
      priceOverride: null,
    };

    expect(AdminDepartureUpdateInputSchema.safeParse(khongVersion).success).toBe(false);
    expect(
      AdminDepartureUpdateInputSchema.safeParse({ ...khongVersion, version: 'hôm qua' }).success,
    ).toBe(false);
  });
});

describe('AdminDepartureSetStatusInputSchema — cửa hậu phải đóng', () => {
  const ID = '4f1b1f2e-0000-4000-8000-000000000001';

  it('nhận OPEN và CLOSED', () => {
    expect(AdminDepartureSetStatusInputSchema.safeParse({ id: ID, status: 'OPEN' }).success).toBe(
      true,
    );
    expect(AdminDepartureSetStatusInputSchema.safeParse({ id: ID, status: 'CLOSED' }).success).toBe(
      true,
    );
  });

  it('TỪ CHỐI CANCELLED — huỷ chuyến là đường riêng có hoàn tiền (F13)', () => {
    // Để lọt là mở một cửa hậu đổi trạng thái sang CANCELLED mà không hoàn
    // một đồng nào cho khách đã trả tiền.
    expect(
      AdminDepartureSetStatusInputSchema.safeParse({ id: ID, status: 'CANCELLED' }).success,
    ).toBe(false);
  });
});

describe('contract admin.departures', () => {
  it('bốn thao tác mounted đúng đường', () => {
    const routes: Array<[{ '~orpc': { route?: { method?: string; path?: string } } }, string]> = [
      [contract.admin.departures.list, 'GET /api/admin/departures'],
      [contract.admin.departures.create, 'POST /api/admin/departures'],
      [contract.admin.departures.update, 'POST /api/admin/departures/{id}'],
      [contract.admin.departures.setStatus, 'POST /api/admin/departures/{id}/status'],
    ];
    for (const [procedure, expected] of routes) {
      const route = procedure['~orpc'].route;
      expect(`${route?.method} ${route?.path}`).toBe(expected);
    }
  });

  it('ba mã từ chối của spec có mặt, đúng chỗ, và là 409 — thế giới đã đổi, không phải input hỏng', () => {
    const update = contract.admin.departures.update['~orpc'].errorMap as Record<
      string,
      { status?: number }
    >;
    const setStatus = contract.admin.departures.setStatus['~orpc'].errorMap as Record<
      string,
      { status?: number }
    >;

    expect(update.DEPARTURE_HAS_BOOKINGS?.status).toBe(409);
    expect(update.SEATS_BELOW_BOOKED?.status).toBe(409);
    expect(setStatus.DEADLINE_PASSED?.status).toBe(409);
    // Cùng họ: ai đó vừa sửa chính chuyến này, thế giới đã đổi dưới chân form.
    expect(update.DEPARTURE_STALE?.status).toBe(409);
  });

  it('mọi lệnh ghi khai NOT_FOUND và từ chối động tới chuyến đã huỷ', () => {
    for (const procedure of [
      contract.admin.departures.update,
      contract.admin.departures.setStatus,
    ]) {
      const errorMap = procedure['~orpc'].errorMap as Record<string, { status?: number }>;
      expect(errorMap.NOT_FOUND?.status).toBe(404);
      // Chuyến đã CANCELLED là bản ghi ĐÓNG: sửa hay mở lại nó là đi vòng
      // quanh luật hoàn tiền đã chạy cho khách của chuyến ấy.
      expect(errorMap.DEPARTURE_CANCELLED?.status).toBe(409);
    }
  });

  it('list chỉ khai NOT_FOUND của tour, không lỗi nghiệp vụ nào khác', () => {
    expect(Object.keys(contract.admin.departures.list['~orpc'].errorMap)).toEqual(['NOT_FOUND']);
  });
});
