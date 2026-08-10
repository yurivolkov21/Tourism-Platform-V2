/**
 * Tạo một tài khoản demo có sẵn dữ liệu để XEM khu account — chỉ tạo dữ liệu,
 * không tự bấm gì.
 *
 * Vì sao cần: seed KHÔNG tạo credential Better Auth (không có row `Account`),
 * nên `customer@tourism.test` trong DB không đăng nhập được; còn đăng ký tay
 * thì tài khoản rỗng, cả 5 màn chỉ hiện trạng thái trống.
 *
 * Chạy (API phải đang chạy ở cổng 3001):
 *   pnpm --filter @tourism/api demo:account
 *
 * Booking được ép trạng thái/ngày THẲNG vào DB để phủ đủ các nhánh giao diện.
 * Việc đó bỏ qua luồng thanh toán thật — chấp nhận được vì đây là dữ liệu để
 * ngắm giao diện, không phải để nghiệm thu money-path.
 */
import pg from 'pg';

const API = 'http://localhost:3001';
const WEB = 'http://localhost:3000';
const PASSWORD = 'DemoAccount!2026';
const EMAIL = `demo-${Date.now()}@tourism.test`;

const headers = { 'Content-Type': 'application/json', Origin: WEB };
const die = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

// ─── 0. API sống chưa ───
const health = await fetch(`${API}/api/health`).catch(() => null);
if (!health?.ok) die(`API chưa chạy ở ${API}. Mở terminal khác: pnpm --filter @tourism/api dev`);

// ─── 1. Tài khoản ───
const signup = await fetch(`${API}/api/auth/sign-up/email`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'Demo Traveller', email: EMAIL, password: PASSWORD }),
});
if (!signup.ok) die(`đăng ký hỏng (${signup.status}): ${(await signup.text()).slice(0, 200)}`);
const cookie = (signup.headers.getSetCookie?.() ?? [])
  .join(';')
  .match(/better-auth\.session_token=[^;]+/)?.[0];
if (!cookie) die('không lấy được cookie phiên');

// ─── 2. Bốn booking, mỗi cái phủ một nhánh giao diện khác nhau ───
const tours = await (await fetch(`${API}/api/tours?limit=10`)).json();
const made = [];
for (const tour of tours.items) {
  const detail = await (await fetch(`${API}/api/tours/${tour.slug}`)).json();
  const departure = detail.departures?.[0];
  if (!departure) continue;
  const res = await fetch(`${API}/api/bookings`, {
    method: 'POST',
    headers: { ...headers, Cookie: cookie },
    body: JSON.stringify({
      departureId: departure.id,
      numAdults: 2,
      numChildren: 1,
      contactName: 'Demo Traveller',
      contactEmail: EMAIL,
      paymentProvider: 'STRIPE',
    }),
  });
  if (res.ok) made.push({ code: (await res.json()).code, title: tour.title });
  if (made.length >= 4) break;
}
if (made.length < 4) die(`chỉ đặt được ${made.length}/4 chỗ — kiểm lại dữ liệu tour`);

// ─── 3. Hai tour đã lưu ───
for (const tour of tours.items.slice(0, 2)) {
  await fetch(`${API}/api/wishlist`, {
    method: 'POST',
    headers: { ...headers, Cookie: cookie },
    body: JSON.stringify({ tourId: tour.id, wished: true }),
  });
}

// ─── 4. Ép trạng thái/ngày để phủ đủ nhánh ───
// `bookings` giữ SNAPSHOT ngày riêng (schema.prisma) — sửa `tour_departures`
// KHÔNG ảnh hưởng booking đã tạo. Phải sửa đúng bảng này.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const [onRoad, upcoming, past, pending] = made;
await db.query(`update bookings set status='PAID', paid_at=now() where code = any($1)`, [
  [onRoad.code, upcoming.code, past.code],
]);
await db.query(
  `update bookings set departure_start_date=current_date-2, departure_end_date=current_date+1 where code=$1`,
  [onRoad.code],
);
await db.query(
  `update bookings set departure_start_date=current_date+40, departure_end_date=current_date+45 where code=$1`,
  [upcoming.code],
);
await db.query(
  `update bookings set departure_start_date=current_date-20, departure_end_date=current_date-18 where code=$1`,
  [past.code],
);
await db.end();

// ─── 5. In ra cho người dùng ───
const line = '─'.repeat(66);
console.log(`\n${line}`);
console.log('  ĐĂNG NHẬP');
console.log(`    ${WEB}/login`);
console.log(`    email    ${EMAIL}`);
console.log(`    mật khẩu ${PASSWORD}`);
console.log(`\n  DỮ LIỆU ĐÃ TẠO`);
console.log(
  `    ${onRoad.code}  PAID · đang đi        → nhóm "On the road now", có gợi ý ngày kết thúc`,
);
console.log(
  `    ${upcoming.code}  PAID · còn 40 ngày    → thẻ "chuyến kế tiếp"; xin huỷ được (có ô lý do)`,
);
console.log(`    ${past.code}  PAID · đã đi xong     → viết đánh giá được`);
console.log(`    ${pending.code}  PENDING · chưa trả    → pill "Awaiting payment", có nút Pay now`);
console.log(`    2 tour đã lưu`);
console.log(`\n  NĂM MÀN ĐỂ XEM  (thử CẢ hai chế độ sáng/tối — nút ở navbar)`);
console.log(`    ${WEB}/account`);
console.log(`    ${WEB}/account/bookings`);
console.log(`    ${WEB}/account/bookings/${upcoming.code}`);
console.log(`    ${WEB}/account/bookings/${past.code}   ← form đánh giá ở đây`);
console.log(`    ${WEB}/account/saved`);
console.log(`    ${WEB}/account/profile`);
console.log(`${line}\n`);
