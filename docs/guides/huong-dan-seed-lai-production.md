# Hướng dẫn seed lại dữ liệu production (lượt 2)

Dành cho Yuri, chạy trên PC bằng Git Bash. Làm theo đúng thứ tự; mỗi bước có
**Kết quả mong đợi** để đối chiếu. Lệch ở đâu thì dừng ở đó và xem mục
[Khi có sự cố](#khi-có-sự-cố).

- **Khi nào:** trước buổi test tay cuối, để buổi test chạy trên dữ liệu mới. Sau
  buổi test không seed lại nữa: dữ liệu đã test giữ nguyên cho buổi thuyết trình
  thử và buổi bảo vệ (Yuri chốt 26/10). Chọn giờ vắng.
- **Đã chạy:** 26/10/2026, 09:12–09:16 UTC, H = 26/10: `seed:verify` trên prod 0 vi
  phạm trên 119 bất biến, snapshot ở `docs/snapshots/2026-10-26/` (entry CHANGELOG
  cùng ngày). Đây là lượt cuối; hướng dẫn giữ lại làm bản ghi cách chạy.
- **Mất bao lâu:** khoảng 30–45 phút kể cả chuẩn bị. Từ lúc xoá tới khi seed xong
  và ISR sinh lại trang (khoảng 5–10 phút), site mất lịch khởi hành và sao đánh giá.
- **Thiết kế và lý do:** [spec seed 14/09](../specs/2026-09-14-seed-khung-2026-design.md)
  §8.3 (cách chạy lượt 1) và §8.5 (lượt 2, điều chỉnh 26/10).

## Lượt này giữ gì, làm mới gì

| Giữ nguyên | Làm mới |
| --- | --- |
| Tour (cả tour tạo tay) và các bảng con, điểm đến, danh mục | Mọi tài khoản: khách thật, Staff, **cả Owner** |
| 9 bài blog, giữ nguyên uuid | Đơn, thanh toán, hoàn tiền, yêu cầu huỷ, chuyến khởi hành |
| Ảnh: `media_assets`, khe ảnh của site, hàng dọn ảnh | Đánh giá, enquiry, subscriber, chat AI |
| Danh sách chặn gửi mail (`email_suppressions`) | Hàng đợi mail (`outbox`), nhật ký admin |

Seed sinh lại 120 khách giả cùng đơn, đánh giá, enquiry và subscriber quanh mốc
H = ngày chạy. Seed cũng **ghi đè nội dung 29 tour seed** về bản fixture (cột của
`tours`, năm bảng con và giá vốn): sửa tay trên 29 tour ấy sẽ mất.

**Owner giữ email cũ nhưng là tài khoản mới** (Yuri chọn 26/10): uuid mới, chưa có
mật khẩu, không avatar, không số điện thoại. Mật khẩu cũ và đăng nhập Google cũ
không còn. `ADMIN_EMAILS` trên Render không phải đổi.

## 1. Trước khi chạy (lúc còn đăng nhập admin)

Bước reset xoá mọi phiên, nên những việc cần admin phải làm trước.

1. Vào admin, trang **Outbox**: không còn mail nào `PENDING`. Bước reset xoá trắng
   hàng đợi, mail còn chờ sẽ không bao giờ đi. Hàng đợi chạy mỗi phút: có mail chờ
   thì đợi nó đi hết.
2. **Gỡ bán** (unpublish) mọi tour thử: `test-01` và tour tạo trong các lần thử tay trước đó.
   `seed:verify` báo lỗi tour đang bán mà không có đánh giá. Chưa xoá được vì còn
   booking; xoá ở mục 8.
3. Ghi lại email của những người cần cấp lại quyền Staff, và các tài khoản khách
   dùng hộp thư thật để demo. Tất cả sẽ phải đăng ký lại. Enquiry hay subscriber
   THẬT (giáo viên, người ngoài) cũng bị xoá: bản `backups/<ngày>/` ở mục 4 vẫn giữ
   trọn, muốn có file dễ đọc thì tải Excel ở trang **Subscribers** trước.
4. Kéo `main` mới nhất về máy (code làm mới Owner nằm ở đó), rồi sinh lại Prisma
   client và build các thư viện mà seed dùng:

   ```bash
   cd /c/Devs/Projects/Tourism-Platform-V2
   git switch main && git pull --ff-only
   pnpm install
   pnpm --filter @tourism/api exec prisma generate
   pnpm turbo run build --filter='@tourism/api^...'
   ```

## 2. Tập dượt trên Docker (khuyên làm, khoảng 5 phút)

Thử seed với đúng mốc H của hôm nay trên Postgres Docker, để lỗi về ngày lộ ra
trước khi đụng prod. Mở một cửa sổ Git Bash **riêng** cho bước này và **không bao
giờ** export chuỗi Supabase trong cửa sổ ấy: không có `DATABASE_URL` thì Prisma
nối Docker, có thì `migrate reset` sẽ reset nhầm prod.

```bash
cd /c/Devs/Projects/Tourism-Platform-V2/apps/api
docker compose up -d
export SEED_HOM_NAY="$(date -u +%F)"
pnpm prisma migrate reset
pnpm db:seed
pnpm seed:verify
```

**Kết quả mong đợi:** seed in `[seed] done.`; `seed:verify` kết thúc bằng
`✓ 0 vi phạm trên 119 bất biến.`, kèm một dòng ⚠ `DB chưa có ảnh tour nào`. Dòng ⚠
này bình thường vì DB Docker không có ảnh, và không tính là vi phạm. Xong thì
**đóng cửa sổ này**.

## 3. Mở cửa sổ prod

Một cửa sổ Git Bash mới, dùng suốt lượt chạy. Trong cửa sổ này không chạy lệnh
Docker hay `prisma migrate` nào.

```bash
cd /c/Devs/Projects/Tourism-Platform-V2/apps/api
# tr -d '\r': .env.production sửa trên Windows có thể mang CRLF.
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2- | tr -d '\r')"
export ADMIN_EMAILS="$(grep '^ADMIN_EMAILS=' .env.production | cut -d= -f2- | tr -d '\r')"
export SEED_CUSTOMER_PASSWORD="$(grep '^SEED_CUSTOMER_PASSWORD=' .env.production | cut -d= -f2- | tr -d '\r')"
export SEED_HOM_NAY="$(date -u +%F)"
echo "${DATABASE_URL##*@}"
```

**Kết quả mong đợi:** dòng cuối in `…pooler.supabase.com:5432/postgres`. Cổng phải là
**5432** (session pooler); thấy 6543 thì dừng, đó là transaction pooler bị cấm.

## 4. Chụp snapshot

```bash
pnpm snapshot:export
```

**Kết quả mong đợi:** dòng `keep-list.json → làm mới Owner tour….online@gmail.com (1 ADMIN lúc xuất)`.
Script tạo hai thư mục:

- `docs/snapshots/<ngày>/`: bản đồ ảnh và danh sách id, không có dữ liệu cá nhân,
  sẽ được commit (mục 9).
- `backups/<ngày>/`: trọn mọi bảng, **có dữ liệu cá nhân**, git bỏ qua. Đây là bản
  duy nhất còn giữ dữ liệu trước reset: giữ trên máy tới hết buổi bảo vệ, không
  commit, không gửi đi đâu.

## 5. Chạy khô, rồi chạy thật

```bash
pnpm data:reset
```

**Kết quả mong đợi** của lượt chạy khô (chưa xoá gì):

- `Nối tới  : …pooler.supabase.com  ⚠ PRODUCTION`
- `Owner mới: cùng email, id …`. Không có dòng này nghĩa là máy chưa kéo `main`
  mới: quay lại mục 1 bước 4.
- `✓ Cổng phân loại`, `✓ Cổng admin`, `✓ Cổng admin prod: keep-list trùng ADMIN_EMAILS[0]`.
- Khối **LÀM MỚI OWNER**: `9  posts.author_id → Owner mới`.
- `Ảnh mồ côi hiện tại: 0`.

Số dòng ở **KẾ HOẠCH XOÁ** khớp với những gì đã làm trên prod thì chạy thật:

```bash
pnpm data:reset -- --apply --toi-biet-day-la-production
```

**Kết quả mong đợi:** `✓ COMMIT — 0 ảnh mồ côi, … Owner đã làm mới.` Ghi lại id ở dòng
`users: Owner mới cùng email (id …)` để đối chiếu ở mục 6. Từ lúc này mọi người
đều bị đăng xuất khỏi web, admin và app.

## 6. Seed và nghiệm thu

```bash
pnpm db:seed -- --toi-biet-day-la-production
pnpm seed:verify
```

**Kết quả mong đợi:**

- Seed in `[seed] admin: đã upsert (id …)` với **đúng id Owner mới** ở mục 5, rồi
  `[seed] done.`
- `seed:verify` báo `✓ 0 vi phạm trên 119 bất biến.`, trong đó có dòng
  `số tài khoản ADMIN khác 1`. Prod có ảnh nên không có dòng ⚠ về ảnh như lúc tập
  dượt.

## 7. Owner đặt mật khẩu

Trang đăng nhập admin chỉ nhận mật khẩu, mà Owner mới chưa có.

1. Mở `https://www.nexora-travel.agency` trước cho API thức dậy (Render gói free ngủ
   khi vắng).
2. Mở `https://admin.nexora-travel.agency/login`, bấm **Forgot password?**. Link mở
   trang quên mật khẩu của web.
3. Nhập email Owner. Mail đặt lại mật khẩu tới trong khoảng một phút; link trong mail
   sống 30 phút.
4. Bấm link, đặt mật khẩu mới, rồi quay lại admin đăng nhập.

**Kết quả mong đợi:** vào được admin, trang Users chỉ có Owner và 120 khách giả.

## 8. Dựng lại người dùng thật

- **Staff:** người đó đăng ký lại trên web và xác minh email bằng mã OTP. Owner vào
  admin, trang **Users**, mở người đó, bấm **Grant staff access**.
- **Khách demo dùng hộp thư thật:** đăng ký lại trên web.
- **App mobile:** mọi máy đăng nhập lại.
- **Tour thử** đã gỡ bán ở mục 1: xoá qua admin (giờ chúng hết booking).

## 9. Kiểm site và ghi lại

1. Mở trang chủ, một trang tour, blog và vài trang admin. Mỗi trang mở **hai lần**:
   lần đầu có thể còn bản cũ (stale-while-revalidate).
2. `docs/snapshots/<ngày>/` cần vào repo cùng entry CHANGELOG của lượt này, như lượt
   15/09 và 18/09: commit thư mục ấy, rồi báo coordinator các con số đã in (số dòng
   xoá, số dòng seed, kết quả `seed:verify`) để ghi entry. Đừng dán email vào thread.

Lưu ý khi demo trên dữ liệu seed (spec §9): booking seed mang mã thanh toán giả.
Đừng huỷ chuyến đang có booking seed đã trả tiền, đừng tự huỷ trong hạn hay hoàn
tiền goodwill trên booking seed, vì cổng thanh toán sẽ báo lỗi. Muốn demo hoàn tiền
thì đặt một đơn mới bằng thẻ test 4242. Seed không sinh giao dịch từ ngày H trở đi,
nên các thẻ "7 ngày" trên dashboard vơi dần và cạn sau khoảng một tuần.

## Khi có sự cố

| Thấy gì | Nghĩa là | Làm gì |
| --- | --- | --- |
| `✖ DỪNG: admin trong keep-list không trùng ADMIN_EMAILS[0]` | Chưa export `ADMIN_EMAILS` từ `.env.production`, hoặc keep-list chọn nhầm admin | Chạy lại các lệnh `export` ở mục 3, rồi `pnpm snapshot:export`, rồi chạy khô lại |
| `✖ DỪNG: không tìm thấy Owner … của keep-list` | Đã có một lượt `--apply` COMMIT: Owner cũ đã được thay | Chạy lại `pnpm snapshot:export` trước. Bản sao lưu lần này vào `backups/<ngày>-2/`, bản trước reset vẫn nguyên |
| `✖ DỪNG: … bảng chưa được phân loại` | Code có bảng mới mà script chưa biết | Dừng, nhờ một thread xử lý |
| `✖ ROLLBACK: …` | Một bất biến vỡ; chưa dòng nào bị xoá | Dừng, gửi nguyên đoạn in ra cho một thread |
| Seed dừng ở `sàn booking đã đi` hoặc `sàn review` | Chưa dòng nào bị ghi | `export SEED_HOM_NAY=<ngày hôm qua, YYYY-MM-DD>` rồi chạy lại hai lệnh của mục 6 |
| Seed từ chối vì admin hoặc vì thế hệ H | Chốt chặn đúng việc của nó | Làm theo thông điệp, không tìm cách vượt |
| Không thấy mail đặt lại mật khẩu | API đang ngủ, mail vào spam, hoặc bị chặn gửi | Xem thư mục spam, đợi 1–2 phút, gửi lại. Vẫn không có thì chạy truy vấn đọc bên dưới ở SQL Editor của Supabase: cột `link` là đúng đường link trong mail, mở nó trong 30 phút là đặt được mật khẩu. Link này là chìa khoá vào tài khoản Owner: không dán vào thread hay gửi cho ai |

Chạy lại lệnh nào thì vẫn trong cửa sổ prod, dùng lại đúng `SEED_HOM_NAY` đã export,
không gõ lại `date` (trừ trường hợp seed dừng ở "sàn" như trên).

```sql
select status, last_error, created_at, payload->>'url' as link
from outbox
where type = 'PASSWORD_RESET'
order by created_at desc
limit 1;
```
