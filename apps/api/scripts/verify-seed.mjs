/**
 * Nghiệm thu dữ liệu seed trên DB thật — spec
 * `docs/specs/2026-09-14-seed-khung-2026-design.md` §7.
 *
 *   SEED_HOM_NAY=2026-09-20 pnpm --filter @tourism/api seed:verify
 *
 * CHỈ ĐỌC: không có câu INSERT/UPDATE/DELETE nào. Mỗi bất biến là một câu đếm vi phạm;
 * còn vi phạm thì exit 1. Chạy NGAY sau khi seed — dữ liệu thật phát sinh về sau
 * (booking thử, đăng nhập của khách) làm lệch các bất biến khung ngày.
 */
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
  // ── Tác dụng phụ ──
  [
    'outbox còn dòng PENDING (mail sẽ bị gửi thật)',
    `select count(*)::int as n from outbox where status = 'PENDING'`,
    false,
  ],
];

const client = new pg.Client({ connectionString: url });
await client.connect();
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

let tongViPham = 0;
for (const { ten, sql, dungMoc } of kiemTra) {
  const { rows } = await client.query(sql, dungMoc ? [H] : []);
  const n = rows[0]?.n ?? 0;
  tongViPham += n;
  console.log(`${n === 0 ? '✓' : '✖'} ${String(n).padStart(5)}  ${ten}`);
}
await client.end();

console.log(
  `\n${tongViPham === 0 ? '✓ 0 vi phạm' : `✖ ${tongViPham} vi phạm`} trên ${kiemTra.length} bất biến.`,
);
process.exitCode = tongViPham === 0 ? 0 : 1;
