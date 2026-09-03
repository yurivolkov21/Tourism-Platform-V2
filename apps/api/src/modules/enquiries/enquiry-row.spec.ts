import { EnquiryStatus } from '../../generated/prisma/enums.js';
import { toEnquiryDetail, toEnquiryRow } from './enquiry-row.js';

/**
 * Mapper THUẦN row Prisma `enquiries` → `EnquiryRow`/`EnquiryDetail` của
 * contract (spec P4c §3-F9). Bốn chỗ có luật: tour join → CẶP title/slug (cả
 * hai cùng có hoặc cùng null), `travelDate` là cột `date` nên ra ISO KHÔNG có
 * giờ, mốc datetime ra ISO UTC, và `adminName` của audit trail đọc qua join
 * (name → email → null) chứ không snapshot như `authorName` của note.
 */

const ID = '0198c000-0000-7000-8000-000000000001';

/** Row Prisma tối thiểu mà mapper cần — đúng shape service `select`. */
function baseRow() {
  return {
    id: ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+84 90 000 0000',
    tour: { title: 'Hoi An Lantern Evening', slug: 'hoi-an-lantern-evening' },
    travelDate: new Date('2026-12-24T00:00:00.000Z'),
    groupSize: 4,
    budgetTier: 'luxury',
    status: EnquiryStatus.CONTACTED,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T08:30:00.000Z'),
    _count: { notes: 3 },
  };
}

describe('toEnquiryRow', () => {
  it('row đầy đủ: tour thành cặp title/slug, travelDate ra NGÀY trần, notesCount từ _count', () => {
    expect(toEnquiryRow(baseRow())).toEqual({
      id: ID,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+84 90 000 0000',
      tourTitle: 'Hoi An Lantern Evening',
      tourSlug: 'hoi-an-lantern-evening',
      travelDate: '2026-12-24',
      groupSize: 4,
      budgetTier: 'luxury',
      status: 'CONTACTED',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T08:30:00.000Z',
      notesCount: 3,
    });
  });

  it('enquiry chung (không tour) → CẢ HAI field tour null, không phải một cái', () => {
    const row = toEnquiryRow({ ...baseRow(), tour: null });
    expect(row.tourTitle).toBeNull();
    expect(row.tourSlug).toBeNull();
  });

  it('field optional của form vắng mặt → null, không bịa chuỗi rỗng hay 0', () => {
    expect(
      toEnquiryRow({
        ...baseRow(),
        phone: null,
        travelDate: null,
        groupSize: null,
        budgetTier: null,
      }),
    ).toMatchObject({ phone: null, travelDate: null, groupSize: null, budgetTier: null });
  });

  it('travelDate là cột DATE: ra "YYYY-MM-DD" theo UTC, không kèm giờ và không lùi một ngày', () => {
    // Prisma đọc `@db.Date` thành Date lúc 00:00 UTC — cắt theo UTC là đúng
    // ngày khách gõ; `toLocaleDateString`/getDate của máy chạy ở múi âm sẽ lùi.
    expect(
      toEnquiryRow({ ...baseRow(), travelDate: new Date('2027-01-01T00:00:00.000Z') }).travelDate,
    ).toBe('2027-01-01');
  });
});

describe('toEnquiryDetail', () => {
  const notes = [
    {
      id: '0198c000-0000-7000-8000-00000000000a',
      authorName: 'Grace Hopper',
      body: 'Called, asked for a quote.',
      createdAt: new Date('2026-09-01T11:00:00.000Z'),
    },
  ];

  const event = (
    admin: { name: string | null; email: string } | null,
    id = '0198c000-0000-7000-8000-00000000000b',
  ) => ({
    id,
    fromStatus: EnquiryStatus.NEW,
    toStatus: EnquiryStatus.CONTACTED,
    admin,
    createdAt: new Date('2026-09-01T10:30:00.000Z'),
  });

  it('gộp message/nationality/interests + hai danh sách đã format', () => {
    const detail = toEnquiryDetail({
      ...baseRow(),
      message: 'We would like a private tour for four.',
      nationality: 'Vietnam',
      interests: ['food', 'photography'],
      notes,
      statusEvents: [event({ name: 'Grace Hopper', email: 'grace@tourism.test' })],
    });

    expect(detail).toMatchObject({
      id: ID,
      message: 'We would like a private tour for four.',
      nationality: 'Vietnam',
      interests: ['food', 'photography'],
      notesCount: 3,
    });
    expect(detail.notes).toEqual([
      {
        id: notes[0]?.id,
        authorName: 'Grace Hopper',
        body: 'Called, asked for a quote.',
        createdAt: '2026-09-01T11:00:00.000Z',
      },
    ]);
    expect(detail.statusEvents[0]).toEqual({
      id: '0198c000-0000-7000-8000-00000000000b',
      fromStatus: 'NEW',
      toStatus: 'CONTACTED',
      adminName: 'Grace Hopper',
      createdAt: '2026-09-01T10:30:00.000Z',
    });
  });

  it('adminName: name → email → null (tài khoản chưa đặt tên vẫn quy được về người)', () => {
    const detail = toEnquiryDetail({
      ...baseRow(),
      message: 'hello there',
      nationality: null,
      interests: [],
      notes: [],
      statusEvents: [
        event({ name: null, email: 'nameless@tourism.test' }),
        event(null, '0198c000-0000-7000-8000-00000000000c'),
      ],
    });
    expect(detail.statusEvents.map((item) => item.adminName)).toEqual([
      'nameless@tourism.test',
      null,
    ]);
  });

  it('interests rỗng là MẢNG rỗng, không null — cột `String[] @default([])` không bao giờ vắng', () => {
    const detail = toEnquiryDetail({
      ...baseRow(),
      message: 'hello there',
      nationality: null,
      interests: [],
      notes: [],
      statusEvents: [],
    });
    expect(detail.interests).toEqual([]);
    expect(detail.notes).toEqual([]);
    expect(detail.statusEvents).toEqual([]);
  });
});
