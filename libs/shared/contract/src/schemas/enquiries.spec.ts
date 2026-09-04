import {
  AdminEnquiriesListQuerySchema,
  AdminEnquiryAddNoteInputSchema,
  AdminEnquirySetStatusInputSchema,
  CreateEnquiryInputSchema,
  ENQUIRY_NOTE_MAX_LENGTH,
  EnquiryDetailSchema,
  EnquiryRowSchema,
  EnquiryStatusSchema,
  OPEN_ENQUIRY_STATUSES,
} from './enquiries.js';
import { AdminEnquiriesStatsSchema, STATS_WINDOW_DAYS } from './stats.js';

/**
 * Ràng buộc độ dài tối thiểu của `name` trên form liên hệ công khai.
 *
 * Vì sao canh ở TẦNG CONTRACT: rule này chỉ sống ở Zod — grep
 * `prisma/migrations/` xác nhận KHÔNG có CHECK độ dài `name` ở DB, nên schema
 * là chỗ DUY NHẤT quan sát được. Int test không đủ: mutation `.min(2)`→`.min(1)`
 * không làm ca int nào đỏ (chúng gửi tên dài).
 *
 * Khôi phục parity với Nexora `@MinLength(2)`
 * (`modules/enquiry/dto/create-enquiry.dto.ts`). v2 từng nới xuống `.min(1)`,
 * nhận cả lead tên 1 ký tự — thụt lùi N1 (đối chiếu 21/07).
 */
describe('CreateEnquiryInputSchema — `name` tối thiểu 2 ký tự', () => {
  const BASE = {
    email: 'a@example.com',
    message: 'Toi muon hoi ve tour nay',
  };

  it('name 1 ký tự → reject (Nexora chặn, v2 phải chặn theo)', () => {
    expect(CreateEnquiryInputSchema.safeParse({ ...BASE, name: 'A' }).success).toBe(false);
  });

  it('name đúng 2 ký tự → chấp nhận (biên dưới hợp lệ)', () => {
    expect(CreateEnquiryInputSchema.safeParse({ ...BASE, name: 'Al' }).success).toBe(true);
  });
});

/**
 * Contract vùng enquiries cho ADMIN (spec P4c §3-F9). Test pin đúng những gì
 * API và admin dựa vào và KHÔNG quan sát được ở tầng nào khác: trần/cận của
 * query (field gõ kiểu THUẦN để ZodSmartCoercion ép được query string), luật
 * `trim()` TRƯỚC `min(1)` của note, và `travelDate` là NGÀY TRẦN chứ không
 * phải mốc có giờ.
 */
const adminRow = {
  id: '0198c000-0000-7000-8000-000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  tourTitle: 'Hoi An Lantern Evening',
  travelDate: '2026-12-24',
  groupSize: 4,
  budgetTier: 'luxury',
  status: 'NEW',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T08:30:00.000Z',
  notesCount: 2,
};

describe('EnquiryStatusSchema', () => {
  it('đúng năm trạng thái, đúng thứ tự schema.prisma — tab lọc admin đọc thẳng từ đây', () => {
    expect([...EnquiryStatusSchema.options]).toEqual(['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']);
    expect(EnquiryStatusSchema.safeParse('ARCHIVED').success).toBe(false);
  });

  it('OPEN_ENQUIRY_STATUSES là tập con ĐANG MỞ — không có WON/LOST (hai kết cục chung cuộc)', () => {
    for (const status of OPEN_ENQUIRY_STATUSES) {
      expect(EnquiryStatusSchema.safeParse(status).success).toBe(true);
    }
    expect([...OPEN_ENQUIRY_STATUSES]).not.toContain('WON');
    expect([...OPEN_ENQUIRY_STATUSES]).not.toContain('LOST');
  });
});

describe('AdminEnquiriesListQuerySchema', () => {
  it('không param nào → page 1, limit 20 (mặc định dùng chung AdminPageQuerySchema)', () => {
    expect(AdminEnquiriesListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('page/limit gõ kiểu THUẦN — chuỗi bị từ chối để ZodSmartCoercion bên API là kẻ ép duy nhất', () => {
    expect(AdminEnquiriesListQuerySchema.safeParse({ page: '2' }).success).toBe(false);
    expect(AdminEnquiriesListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('search trần 120 và không nhận chuỗi rỗng (rỗng = không lọc, không phải lọc chuỗi rỗng)', () => {
    expect(AdminEnquiriesListQuerySchema.safeParse({ search: 'x'.repeat(120) }).success).toBe(true);
    expect(AdminEnquiriesListQuerySchema.safeParse({ search: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(AdminEnquiriesListQuerySchema.safeParse({ search: '' }).success).toBe(false);
  });

  it('tourId phải là uuid — slug tour bị từ chối ngay ở contract', () => {
    expect(
      AdminEnquiriesListQuerySchema.safeParse({ tourId: '0198c000-0000-7000-8000-0000000000aa' })
        .success,
    ).toBe(true);
    expect(
      AdminEnquiriesListQuerySchema.safeParse({ tourId: 'hoi-an-lantern-evening' }).success,
    ).toBe(false);
  });
});

describe('EnquiryRowSchema', () => {
  it('row đầy đủ hợp lệ; mọi field optional của form nhận null (không phải vắng mặt)', () => {
    expect(EnquiryRowSchema.safeParse(adminRow).success).toBe(true);
    expect(
      EnquiryRowSchema.safeParse({
        ...adminRow,
        tourTitle: null,
        travelDate: null,
        groupSize: null,
        budgetTier: null,
      }).success,
    ).toBe(true);
  });

  it('travelDate là NGÀY TRẦN: một mốc có giờ bị từ chối (cột `@db.Date`, không có múi giờ)', () => {
    expect(
      EnquiryRowSchema.safeParse({ ...adminRow, travelDate: '2026-12-24T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('row KHÔNG có phone/tourSlug/message (vòng vá review F9: bảng không có cột nào in chúng)', () => {
    for (const key of ['phone', 'tourSlug', 'message']) {
      expect(EnquiryRowSchema.shape).not.toHaveProperty(key);
    }
    expect(EnquiryDetailSchema.shape).toHaveProperty('phone');
  });
});

describe('EnquiryDetailSchema', () => {
  const detail = {
    ...adminRow,
    phone: '+84 90 000 0000',
    message: 'We would like a private tour for four.',
    nationality: 'United Kingdom',
    interests: ['food'],
    notes: [],
    statusEvents: [],
  };

  it('hai danh sách là BẮT BUỘC (mảng rỗng), không optional — client không phải phòng `undefined`', () => {
    expect(EnquiryDetailSchema.safeParse(detail).success).toBe(true);
    const { notes: _notes, ...withoutNotes } = detail;
    expect(EnquiryDetailSchema.safeParse(withoutNotes).success).toBe(false);
  });

  it('adminName của dòng audit nullable (admin bị xoá → SetNull), authorName của note thì KHÔNG', () => {
    expect(
      EnquiryDetailSchema.safeParse({
        ...detail,
        statusEvents: [
          {
            id: '0198c000-0000-7000-8000-00000000000b',
            fromStatus: 'NEW',
            toStatus: 'WON',
            adminName: null,
            createdAt: '2026-09-01T10:30:00.000Z',
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      EnquiryDetailSchema.safeParse({
        ...detail,
        notes: [
          {
            id: '0198c000-0000-7000-8000-00000000000a',
            authorName: null,
            body: 'hi',
            createdAt: '2026-09-01T11:00:00.000Z',
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('AdminEnquiryAddNoteInputSchema', () => {
  const ID = '0198c000-0000-7000-8000-000000000001';

  it('trim TRƯỚC min(1): note toàn dấu cách là 400, không phải một dòng trống vĩnh viễn trong thread', () => {
    expect(AdminEnquiryAddNoteInputSchema.safeParse({ id: ID, body: '   ' }).success).toBe(false);
    expect(AdminEnquiryAddNoteInputSchema.safeParse({ id: ID, body: '' }).success).toBe(false);
  });

  it('body đi tới service đã TRIM — DB không lưu khoảng trắng thừa của ô nhập', () => {
    expect(AdminEnquiryAddNoteInputSchema.parse({ id: ID, body: '  hello  ' }).body).toBe('hello');
  });

  it('trần đúng ENQUIRY_NOTE_MAX_LENGTH (gương cột VarChar(2000)) — biên đó là HỢP LỆ', () => {
    const at = 'x'.repeat(ENQUIRY_NOTE_MAX_LENGTH);
    expect(AdminEnquiryAddNoteInputSchema.safeParse({ id: ID, body: at }).success).toBe(true);
    expect(AdminEnquiryAddNoteInputSchema.safeParse({ id: ID, body: `${at}x` }).success).toBe(
      false,
    );
  });
});

describe('AdminEnquirySetStatusInputSchema', () => {
  it('KHÔNG có ô note: audit trail ghi ai/lúc nào/từ đâu tới đâu, giải thích thì thuộc về thread note', () => {
    const parsed = AdminEnquirySetStatusInputSchema.parse({
      id: '0198c000-0000-7000-8000-000000000001',
      status: 'WON',
      note: 'should be stripped',
    });
    expect(parsed).not.toHaveProperty('note');
  });
});

describe('AdminEnquiriesStatsSchema', () => {
  const stats = {
    period: {
      windowDays: STATS_WINDOW_DAYS,
      currentFrom: '2026-08-04T10:30:00.000Z',
      currentTo: '2026-09-01T10:30:00.000Z',
      previousFrom: '2026-07-07T10:30:00.000Z',
      generatedAt: '2026-09-01T10:30:00.000Z',
    },
    created: { current: 12, previous: 8 },
    won: { current: 3, previous: 5 },
    open: 7,
  };

  it('created/won là CẶP hai kỳ; open là số ĐƠN — ảnh chụp không có kỳ trước để mà bịa', () => {
    expect(AdminEnquiriesStatsSchema.safeParse(stats).success).toBe(true);
    expect(
      AdminEnquiriesStatsSchema.safeParse({ ...stats, open: { current: 7, previous: 5 } }).success,
    ).toBe(false);
    expect(AdminEnquiriesStatsSchema.safeParse({ ...stats, created: 12 }).success).toBe(false);
  });
});
