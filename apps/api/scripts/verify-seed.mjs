/**
 * Nghiệm thu dữ liệu seed trên DB thật — spec
 * `docs/specs/2026-09-14-seed-khung-2026-design.md` §7.
 *
 *   SEED_HOM_NAY=2026-09-20 pnpm --filter @tourism/api seed:verify
 *
 * CHỈ ĐỌC: không có câu INSERT/UPDATE/DELETE nào. Mỗi bất biến là một câu đếm vi phạm;
 * còn vi phạm thì exit 1. Chạy NGAY sau khi seed — dữ liệu thật phát sinh về sau
 * (booking thử, đăng nhập của khách) làm lệch các bất biến khung ngày.
 * Một số bất biến gọi thẳng hàm luật của `@tourism/contract` thay vì chép lại luật bằng SQL —
 * hai bản luật là hai chỗ để sai. Vì vậy `seed:verify` cần contract đã build
 * (`pnpm --filter @tourism/contract build`), y như `db:seed`.
 */
import { isWithinDeadline, refundOnCancel } from '@tourism/contract';
import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const homNay = process.env.SEED_HOM_NAY?.trim() ?? '';
if (!/^2026-\d{2}-\d{2}$/.test(homNay)) {
  console.error('✖ Thiếu SEED_HOM_NAY (YYYY-MM-DD) — phải trùng giá trị đã dùng khi seed.');
  process.exit(1);
}
const H = `${homNay} 00:00:00`;

/** Bảng mà seed ghi dòng — kiểm theo khung [01/01/2026, H]. Bảng giữ lại chỉ kiểm nằm trong năm 2026 (spec §7). */
const BANG_SEED = [
  'users',
  'accounts',
  'tour_departures',
  'bookings',
  'payment_events',
  'refunds',
  'cancellation_requests',
  'reviews',
  'review_moderation_events',
  'enquiries',
  'enquiry_notes',
  'enquiry_status_events',
  'subscribers',
];
/** Cột ngày lịch được phép tới 31/12/2026. */
const COT_NGAY_LICH = new Set([
  'start_date',
  'end_date',
  'departure_start_date',
  'departure_end_date',
  'travel_date',
]);
/** Hai bảng tài khoản chỉ kiểm dòng của khách giả — admin giữ lại mang mốc thật. */
const LOC_BANG = {
  users: `email like '%@example.com'`,
  accounts: `user_id in (select id from users where email like '%@example.com')`,
};
/** Dòng GIỮ LẠI của hai bảng tài khoản (admin thật) — chỉ kiểm nằm trong năm 2026. */
const LOC_BANG_GIU_LAI = {
  users: `email not like '%@example.com'`,
  accounts: `user_id not in (select id from users where email like '%@example.com')`,
};
/**
 * Bảng giữ lại được miễn kiểm năm: `tour_categories` giữ mốc 2025 có chủ đích (spec Q8);
 * phiên, token xác minh và lịch sử migration không phải dữ liệu nội dung.
 */
const BO_QUA_GIU_LAI = ['tour_categories', 'sessions', 'verifications', '_prisma_migrations'];
/** Điều kiện "nằm ngoài năm 2026" của một cột. */
const ngoaiNam2026 = (ten) =>
  `("${ten}" < '2026-01-01'::timestamp or "${ten}" >= '2027-01-01'::timestamp)`;

/** [tên, câu SQL trả cột `n`, có dùng tham số H ($1) không]. */
const BAT_BIEN = [
  // ── Tiền đề: có đủ khách giả, để các bất biến lọc theo `@example.com` không xanh vì rỗng ──
  [
    'số khách giả lệch 120 (spec §4.1)',
    `select abs(count(*) - 120)::int as n from users where email like '%@example.com'`,
    false,
  ],
  // User chốt 14/09: giữ đúng một tài khoản admin — seed không bao giờ được sinh admin thứ hai.
  [
    'số tài khoản ADMIN khác 1',
    `select abs(count(*) - 1)::int as n from users where role = 'ADMIN'`,
    false,
  ],
  // ── 14 bất biến nghiệm thu của đợt 10/09 ──
  [
    'booking đã trả thiếu cost_per_person',
    `select count(*)::int as n from bookings where paid_at is not null and cost_per_person is null`,
    false,
  ],
  [
    'total_amount lệch đơn giá × ghế',
    `select count(*)::int as n from bookings where total_amount <> round(unit_price * (num_adults + num_children), 2)`,
    false,
  ],
  [
    'huỷ trước khi trả tiền',
    `select count(*)::int as n from bookings where cancelled_at is not null and paid_at is not null and cancelled_at < paid_at`,
    false,
  ],
  [
    'trả tiền từ ngày khởi hành trở đi',
    `select count(*)::int as n from bookings where paid_at is not null and paid_at >= departure_start_date`,
    false,
  ],
  [
    'trả tiền từ H trở đi',
    `select count(*)::int as n from bookings where paid_at >= $1::timestamp`,
    true,
  ],
  [
    'booking trùng khách và chuyến',
    `select count(*)::int as n from (select user_id, departure_id from bookings group by 1, 2 having count(*) > 1) x`,
    false,
  ],
  [
    'khách chồng lịch (booking đã trả)',
    `select count(*)::int as n from bookings a join bookings b on a.user_id = b.user_id and a.id < b.id where a.paid_at is not null and b.paid_at is not null and a.departure_start_date <= b.departure_end_date and b.departure_start_date <= a.departure_end_date`,
    false,
  ],
  [
    'overbooking',
    `select count(*)::int as n from tour_departures where seats_booked > seats_total`,
    false,
  ],
  [
    'ghế lệch booking PAID',
    `select count(*)::int as n from tour_departures d left join (select departure_id, sum(num_adults + num_children)::int as ghe from bookings where status = 'PAID' group by 1) b on b.departure_id = d.id where d.seats_booked <> coalesce(b.ghe, 0)`,
    false,
  ],
  [
    'chuyến khởi hành trước H còn OPEN',
    `select count(*)::int as n from tour_departures where status = 'OPEN' and start_date < $1::date`,
    true,
  ],
  [
    'review CURATED còn lại',
    `select count(*)::int as n from reviews where source = 'CURATED'`,
    false,
  ],
  [
    'review thiếu user hoặc booking',
    `select count(*)::int as n from reviews where user_id is null or booking_id is null`,
    false,
  ],
  [
    'review viết trước khi chuyến xong',
    `select count(*)::int as n from reviews r join bookings b on b.id = r.booking_id where r.created_at <= b.departure_end_date`,
    false,
  ],
  [
    'tour đang bán không có rating',
    `select count(*)::int as n from tours where is_published and rating_avg is null`,
    false,
  ],
  // Cùng công thức bước 6b của seed.ts: đếm và trung bình review đã duyệt, không lọc `source`.
  [
    'rating tour lệch review đã duyệt',
    `select count(*)::int as n from tours t where t.rating_count <> (select count(*) from reviews r where r.tour_id = t.id and r.is_approved) or t.rating_avg is distinct from (select avg(r.rating)::numeric(2,1) from reviews r where r.tour_id = t.id and r.is_approved)`,
    false,
  ],
  // ── Hình dạng huỷ và hoàn (spec §4.4) ──
  ['booking PENDING', `select count(*)::int as n from bookings where status = 'PENDING'`, false],
  [
    'CANCELLED đã trả không có đúng một yêu cầu huỷ REFUNDED',
    `select count(*)::int as n from bookings b where b.status = 'CANCELLED' and b.paid_at is not null and (select count(*) from cancellation_requests c where c.booking_id = b.id and c.status = 'REFUNDED') <> 1`,
    false,
  ],
  [
    'REFUNDED có yêu cầu huỷ hoặc cancelled_at',
    `select count(*)::int as n from bookings b where b.status = 'REFUNDED' and (b.cancelled_at is not null or exists (select 1 from cancellation_requests c where c.booking_id = b.id))`,
    false,
  ],
  [
    'giỏ bỏ dở có refund hoặc payment event',
    `select count(*)::int as n from bookings b where b.status = 'CANCELLED' and b.paid_at is null and (exists (select 1 from refunds r where r.booking_id = b.id) or exists (select 1 from payment_events e where e.booking_id = b.id))`,
    false,
  ],
  [
    'tổng hoàn vượt tổng tiền',
    `select count(*)::int as n from bookings b where (select coalesce(sum(amount), 0) from refunds r where r.booking_id = b.id) > b.total_amount`,
    false,
  ],
  [
    'refund không có đúng một payment event hoàn',
    `select count(*)::int as n from refunds r where (select count(*) from payment_events e where e.booking_id = r.booking_id and e.amount = r.amount and e.processed_at = r.created_at and e.type in ('charge.refunded', 'PAYMENT.CAPTURE.REFUNDED')) <> 1`,
    false,
  ],
  [
    'yêu cầu REQUESTED đã có người quyết',
    `select count(*)::int as n from cancellation_requests where status = 'REQUESTED' and (decided_at is not null or decided_by is not null)`,
    false,
  ],
  [
    'yêu cầu DENIED/REQUESTED trỏ booking không còn PAID',
    `select count(*)::int as n from cancellation_requests c join bookings b on b.id = c.booking_id where c.status in ('DENIED', 'REQUESTED') and b.status <> 'PAID'`,
    false,
  ],
  [
    'booking REFUNDED có tổng refund khác tổng tiền',
    `select count(*)::int as n from bookings b where b.status = 'REFUNDED' and (select coalesce(sum(r.amount), 0) from refunds r where r.booking_id = b.id) <> b.total_amount`,
    false,
  ],
  [
    'yêu cầu DENIED/REFUNDED thiếu người hoặc mốc quyết',
    `select count(*)::int as n from cancellation_requests where status in ('DENIED', 'REFUNDED') and (decided_at is null or decided_by is null)`,
    false,
  ],
  // ── Enquiries và subscribers (spec §5) ──
  [
    'chuỗi trạng thái enquiry đứt',
    `with e as (select s.from_status, s.to_status, lag(s.to_status) over (partition by s.enquiry_id order by s.created_at, s.id) as truoc, row_number() over (partition by s.enquiry_id order by s.created_at, s.id) as thu_tu from enquiry_status_events s) select count(*)::int as n from e where (thu_tu = 1 and from_status <> 'NEW') or (thu_tu > 1 and from_status <> truoc) or from_status = to_status`,
    false,
  ],
  [
    'enquiry lệch sự kiện cuối',
    `select count(*)::int as n from enquiries q left join lateral (select s.to_status, s.created_at from enquiry_status_events s where s.enquiry_id = q.id order by s.created_at desc, s.id desc limit 1) l on true where coalesce(l.to_status::text, 'NEW') <> q.status::text or q.updated_at <> coalesce(l.created_at, q.created_at)`,
    false,
  ],
  [
    'ghi chú enquiry trước lúc tạo',
    `select count(*)::int as n from enquiry_notes n join enquiries q on q.id = n.enquiry_id where n.created_at < q.created_at`,
    false,
  ],
  [
    'enquiry đã ẩn danh',
    `select count(*)::int as n from enquiries where anonymized_at is not null`,
    false,
  ],
  [
    'subscriber sai hình dạng double opt-in',
    `select count(*)::int as n from subscribers where welcome_sent_at is null or source is not null or confirmed_at < created_at or (unsubscribed_at is not null and unsubscribed_at < coalesce(confirmed_at, welcome_sent_at))`,
    false,
  ],
  [
    'subscriber lệch updated_at (phải là mốc mới nhất)',
    `select count(*)::int as n from subscribers where updated_at <> greatest(created_at, welcome_sent_at, confirmed_at, unsubscribed_at)`,
    false,
  ],
  // ── Luật một hạn chót (ADR-0041, spec 2026-09-15 §7) ──
  [
    'yêu cầu huỷ còn REQUESTED hoặc DENIED (luồng duyệt đã gỡ)',
    `select count(*)::int as n from cancellation_requests where status in ('REQUESTED', 'DENIED')`,
    false,
  ],
  [
    'dòng hoàn lúc khách tự huỷ lại có admin_id',
    `select count(*)::int as n from refunds r join bookings b on b.id = r.booking_id where b.status = 'CANCELLED' and b.paid_at is not null and r.admin_id is not null`,
    false,
  ],
  [
    'yêu cầu huỷ có người quyết không phải chính khách',
    `select count(*)::int as n from cancellation_requests where decided_by is distinct from user_id`,
    false,
  ],
  // ── Tác dụng phụ ──
  [
    'outbox còn dòng PENDING (mail sẽ bị gửi thật)',
    `select count(*)::int as n from outbox where status = 'PENDING'`,
    false,
  ],
];

/**
 * Mốc "hôm nay" dạng `Date` để đưa vào hàm luật: 05:00 UTC = 12:00 trưa giờ Việt Nam của H,
 * nên `vietnamToday(MOC_H)` đúng bằng `homNay` bất kể máy chạy ở múi nào.
 */
const MOC_H = new Date(`${homNay}T05:00:00.000Z`);
/**
 * Lấy mốc và ngày ra dạng CHỮ. Cột `timestamp without time zone` giữ giờ UTC, nhưng node-pg
 * dựng `Date` từ nó theo giờ MÁY — đọc thẳng là lệch đúng offset của máy (ở đây UTC+7), đủ để
 * một mốc sát nửa đêm nhảy sang ngày khác và bất biến báo sai.
 */
const utc = (cot) => `to_char(${cot}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const ngayIso = (cot) => `to_char(${cot}, 'YYYY-MM-DD')`;

/**
 * Bất biến cần LUẬT: `sql` trả về NHIỀU dòng, `dem(rows)` đếm vi phạm bằng chính hàm của
 * contract; `dungMoc` (mặc định false) quyết có truyền tham số H ($1) vào câu SQL không.
 */
const BAT_BIEN_LUAT = [
  {
    ten: 'booking trả tiền sau hạn chót của chuyến',
    sql: `select b.id, ${utc('b.paid_at')} as paid_at, ${ngayIso('b.departure_start_date')} as bat_dau, ${ngayIso('b.departure_end_date')} as ket_thuc
          from bookings b where b.paid_at is not null`,
    dem: (rows) =>
      rows.filter((r) => !isWithinDeadline(new Date(r.paid_at), r.bat_dau, r.ket_thuc)).length,
  },
  {
    ten: 'lần huỷ của khách hoàn sai luật (trong hạn = phần còn lại một dòng, quá hạn = không dòng nào)',
    sql: `select c.id, ${utc('c.created_at')} as huy_luc, ${ngayIso('b.departure_start_date')} as bat_dau,
            ${ngayIso('b.departure_end_date')} as ket_thuc, b.total_amount::text as tong,
            (select coalesce(sum(r.amount), 0) from refunds r where r.booking_id = b.id)::text as da_hoan,
            (select count(*) from refunds r where r.booking_id = b.id)::int as so_dong
          from cancellation_requests c join bookings b on b.id = c.booking_id
          where c.status = 'REFUNDED' and b.status = 'CANCELLED' and b.paid_at is not null`,
    dem: (rows) =>
      rows.filter((r) => {
        // Booking đã huỷ trong seed chưa từng được hoàn phần nào trước đó, nên phần còn lại
        // là toàn bộ `total_amount`; một hàm phủ cả hai nhánh, không rẽ if theo ngày.
        const can = refundOnCancel({
          now: new Date(r.huy_luc),
          startDate: r.bat_dau,
          endDate: r.ket_thuc,
          totalAmount: r.tong,
          refundedTotal: '0.00',
        });
        return Number(r.da_hoan) !== Number(can) || r.so_dong !== (Number(can) > 0 ? 1 : 0);
      }).length,
  },
  {
    ten: 'thiếu booking đã trả trên chuyến đã qua hạn chót mà chưa khởi hành (demo §11)',
    sql: `select ${ngayIso('d.start_date')} as bat_dau, ${ngayIso('d.end_date')} as ket_thuc,
            (select count(*) from bookings b where b.departure_id = d.id and b.status = 'PAID')::int as so_booking
          from tour_departures d where d.status = 'OPEN' and d.start_date > $1::date`,
    dungMoc: true,
    dem: (rows) =>
      rows
        .filter((r) => !isWithinDeadline(MOC_H, r.bat_dau, r.ket_thuc))
        .reduce((tong, r) => tong + r.so_booking, 0) >= 3
        ? 0
        : 1,
  },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
// Phòng thủ thêm một lớp khi chạy trên prod: cả phiên chỉ đọc. Dùng lệnh SET chứ không dùng tham
// số khởi động `options`, vì session pooler của Supabase có thể không nhận tham số đó.
await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
console.log(`Nối tới: ${new URL(url).host} · H = ${homNay}\n`);

const kiemTra = [];

// ── Khung ngày: quét information_schema để cột thêm về sau cũng tự được kiểm ──
const { rows: cot } = await client.query(
  `select table_name, column_name from information_schema.columns
   where table_schema = 'public' and table_name = any($1)
     and data_type in ('timestamp without time zone', 'timestamp with time zone', 'date')
   order by table_name, column_name`,
  [BANG_SEED],
);
for (const { table_name: bang, column_name: ten } of cot) {
  // Hạn phiên và hạn token không phải mốc của dữ liệu seed.
  if (ten.endsWith('_expires_at')) continue;
  let vuotTran = `"${ten}" >= $1::timestamp`;
  let dungMoc = true;
  if (COT_NGAY_LICH.has(ten)) {
    vuotTran = `"${ten}" > '2026-12-31'::date`;
    dungMoc = false;
  } else if (bang === 'tour_departures' && ten === 'updated_at') {
    // Bước đặt lại ghế và tính giá vốn ghi `now()` lúc chạy seed.
    vuotTran = `"${ten}" > now()`;
    dungMoc = false;
  }
  const loc = LOC_BANG[bang] ? ` and ${LOC_BANG[bang]}` : '';
  kiemTra.push({
    ten: `khung ngày ${bang}.${ten}`,
    sql: `select count(*)::int as n from "${bang}" where "${ten}" is not null and ("${ten}" < '2026-01-01'::timestamp or ${vuotTran})${loc}`,
    dungMoc,
  });
  if (LOC_BANG_GIU_LAI[bang]) {
    kiemTra.push({
      ten: `năm 2026 (dòng giữ lại) ${bang}.${ten}`,
      sql: `select count(*)::int as n from "${bang}" where "${ten}" is not null and ${ngoaiNam2026(ten)} and ${LOC_BANG_GIU_LAI[bang]}`,
      dungMoc: false,
    });
  }
}

// ── Bảng giữ lại (tours, destinations, blog, media, site slots…): chỉ kiểm nằm trong năm 2026 ──
const { rows: cotGiuLai } = await client.query(
  `select table_name, column_name from information_schema.columns
   where table_schema = 'public' and not (table_name = any($1)) and not (table_name = any($2))
     and data_type in ('timestamp without time zone', 'timestamp with time zone', 'date')
   order by table_name, column_name`,
  [BANG_SEED, BO_QUA_GIU_LAI],
);
for (const { table_name: bang, column_name: ten } of cotGiuLai) {
  if (ten.endsWith('_expires_at')) continue;
  kiemTra.push({
    ten: `năm 2026 (bảng giữ lại) ${bang}.${ten}`,
    sql: `select count(*)::int as n from "${bang}" where "${ten}" is not null and ${ngoaiNam2026(ten)}`,
    dungMoc: false,
  });
}

for (const [ten, sql, dungMoc] of BAT_BIEN) kiemTra.push({ ten, sql, dungMoc });
for (const bb of BAT_BIEN_LUAT) kiemTra.push({ ...bb, dungMoc: bb.dungMoc ?? false });

let tongViPham = 0;
for (const { ten, sql, dungMoc, dem } of kiemTra) {
  const { rows } = await client.query(sql, dungMoc ? [H] : []);
  // Bất biến thường trả đúng một dòng có cột `n`; bất biến cần luật trả nhiều dòng và tự đếm.
  const n = dem ? dem(rows) : (rows[0]?.n ?? 0);
  tongViPham += n;
  console.log(`${n === 0 ? '✓' : '✖'} ${String(n).padStart(5)}  ${ten}`);
}
await client.end();

console.log(
  `\n${tongViPham === 0 ? '✓ 0 vi phạm' : `✖ ${tongViPham} vi phạm`} trên ${kiemTra.length} bất biến.`,
);
process.exitCode = tongViPham === 0 ? 0 : 1;
