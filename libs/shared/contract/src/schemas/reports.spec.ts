import { BookingStatusSchema } from './bookings.js';
import {
  AdminMonthlyReportQuerySchema,
  AdminMonthlyReportSchema,
  ReportMonthSchema,
} from './reports.js';

const validReport = {
  month: '2026-09',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-10-01T00:00:00.000Z',
  generatedAt: '2026-09-30T12:00:00.000Z',
  currency: 'USD',
  revenue: '1240.50',
  paidBookings: 8,
  newBookings: 11,
  bookingsByStatus: BookingStatusSchema.options.map((status) => ({ status, count: 0 })),
  refundedTotal: '120.00',
  refunds: 2,
  cancellationsApproved: 1,
  cancellationsDenied: 3,
  reviewsApproved: 5,
  // Cột kết quả kinh doanh (ADR-0033 §1)
  recognizedRevenue: '1000.00',
  cogsVariable: '400.00',
  cogsFixed: '200.00',
  cogsTotal: '600.00',
  grossProfit: '400.00',
  grossMarginPct: 0.4,
  taxRate: 0.1,
  taxAmount: '36.36',
  paymentFees: '30.20',
  netProfit: '333.44',
  departuresRun: 2,
  costDataMissing: 0,
};

describe('ReportMonthSchema', () => {
  it('nhận YYYY-MM và từ chối mọi hình dạng khác', () => {
    expect(ReportMonthSchema.parse('2026-09')).toBe('2026-09');
    expect(ReportMonthSchema.safeParse('2026-9').success).toBe(false);
    expect(ReportMonthSchema.safeParse('2026-13').success).toBe(false);
    expect(ReportMonthSchema.safeParse('2026-00').success).toBe(false);
    expect(ReportMonthSchema.safeParse('2026-09-01').success).toBe(false);
    expect(ReportMonthSchema.safeParse('').success).toBe(false);
  });

  it('năm bị khoá 1900–2099 — hai bẫy legacy của Date.UTC không tới được service', () => {
    // `9999-12` sinh mốc cuối kỳ năm 10000 → `toISOString()` in `+010000-…`
    // → chính output schema của response từ chối → trang lỗi cho một URL gõ
    // tay. `0050-06` thì Date.UTC ánh xạ 50 → 1950: nhãn nói "June 0050",
    // số liệu là tháng 6/1950 (vòng vá review F6).
    expect(ReportMonthSchema.safeParse('9999-12').success).toBe(false);
    expect(ReportMonthSchema.safeParse('0050-06').success).toBe(false);
    expect(ReportMonthSchema.safeParse('1899-12').success).toBe(false);
    expect(ReportMonthSchema.safeParse('2100-01').success).toBe(false);
    expect(ReportMonthSchema.parse('1900-01')).toBe('1900-01');
    expect(ReportMonthSchema.parse('2099-12')).toBe('2099-12');
  });
});

describe('AdminMonthlyReportQuerySchema', () => {
  it('month là BẮT BUỘC — không có tháng mặc định phía server', () => {
    // Cố ý: "tháng hiện tại" là khái niệm của NGƯỜI đang xem (URL-state
    // `?month=`), không phải của đồng hồ server — mặc định ngầm ở đây sẽ đẻ
    // ra hai câu trả lời cho cùng một đường dẫn.
    expect(AdminMonthlyReportQuerySchema.safeParse({}).success).toBe(false);
    expect(AdminMonthlyReportQuerySchema.parse({ month: '2026-09' }).month).toBe('2026-09');
  });
});

describe('AdminMonthlyReportSchema', () => {
  it('nhận một báo cáo đầy đủ', () => {
    expect(AdminMonthlyReportSchema.parse(validReport)).toMatchObject({
      month: '2026-09',
      revenue: '1240.50',
      refundedTotal: '120.00',
    });
  });

  it('tiền là chuỗi thập phân, KHÔNG BAO GIỜ float', () => {
    expect(AdminMonthlyReportSchema.safeParse({ ...validReport, revenue: 1240.5 }).success).toBe(
      false,
    );
    expect(AdminMonthlyReportSchema.safeParse({ ...validReport, refundedTotal: 120 }).success).toBe(
      false,
    );
  });

  it('bookingsByStatus phải phủ ĐỦ mọi trạng thái — kể cả những cái bằng 0', () => {
    // Bảng báo cáo và cột CSV có số hàng CỐ ĐỊNH: thiếu một trạng thái là
    // một hàng biến mất giữa hai tháng, và người đọc không có cách nào biết
    // "0" khác "không có dòng nào".
    const short = validReport.bookingsByStatus.slice(1);
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, bookingsByStatus: short }).success,
    ).toBe(false);
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, bookingsByStatus: [] }).success,
    ).toBe(false);
  });

  it('mọi phép đếm là số nguyên không âm', () => {
    expect(AdminMonthlyReportSchema.safeParse({ ...validReport, paidBookings: -1 }).success).toBe(
      false,
    );
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, reviewsApproved: 1.5 }).success,
    ).toBe(false);
  });
});

/**
 * Cột kết quả kinh doanh (ADR-0033). Bộ này canh đúng ba chỗ mà một schema
 * tiền hay nói sai: dấu trừ, mẫu số 0, và ranh giới giữa "âm được" với "âm là
 * dữ liệu hỏng".
 */
describe('AdminMonthlyReportSchema — kết quả kinh doanh', () => {
  it('nhận lợi nhuận ÂM — tháng lỗ là một tháng hợp lệ', () => {
    // `DecimalStringSchema` là `/^\d+(\.\d+)?$/`, KHÔNG nhận dấu trừ. Dùng
    // nhầm nó cho hai field này là runtime 500 ở tháng đầu tiên lỗ.
    const parsed = AdminMonthlyReportSchema.safeParse({
      ...validReport,
      grossProfit: '-150.00',
      netProfit: '-186.36',
      grossMarginPct: -0.15,
    });

    expect(parsed.success).toBe(true);
  });

  it('doanh thu và giá vốn thì KHÔNG được âm — hai khái niệm, hai schema', () => {
    for (const field of ['recognizedRevenue', 'cogsVariable', 'cogsFixed', 'cogsTotal'] as const) {
      expect(AdminMonthlyReportSchema.safeParse({ ...validReport, [field]: '-1.00' }).success).toBe(
        false,
      );
    }
  });

  it('biên gộp null khi không có chuyến nào chạy', () => {
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, grossMarginPct: null }).success,
    ).toBe(true);
  });

  it('thuế suất không âm, và luôn CÓ MẶT để tờ báo cáo tự khai', () => {
    expect(AdminMonthlyReportSchema.safeParse({ ...validReport, taxRate: -0.1 }).success).toBe(
      false,
    );
    const { taxRate: _omitted, ...withoutRate } = validReport;
    expect(AdminMonthlyReportSchema.safeParse(withoutRate).success).toBe(false);
  });

  it('hai bộ đếm là số nguyên không âm', () => {
    expect(AdminMonthlyReportSchema.safeParse({ ...validReport, departuresRun: -1 }).success).toBe(
      false,
    );
    expect(
      AdminMonthlyReportSchema.safeParse({ ...validReport, costDataMissing: 1.5 }).success,
    ).toBe(false);
  });
});
