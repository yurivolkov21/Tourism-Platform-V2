# Bề mặt Supabase: Data API và Auth (đã đóng 09/09/2026)

> Đo và chốt **09/09/2026**, sau khi Supabase gửi mail cảnh báo `rls_disabled_in_public`.
> Đọc file này TRƯỚC KHI bật lại bất cứ thứ gì trong Supabase dashboard, và trước khi
> tin một dòng Security Advisor nào — quá nửa số cảnh báo ở đó là cố ý.

## Trạng thái hiện tại

| Thứ | Trạng thái | Đo bằng |
| --- | --- | --- |
| Data API (PostgREST + GraphQL) | **TẮT** | `/rest/v1/tours` → 404 `PGRST205` |
| Exposed schemas | `pgrst_no_exposed_schemas` (rỗng) | `pg_roles.rolconfig` của `authenticator` |
| RLS trên `public` | 36/36 bảng bật, **0 policy** = deny-all | `pg_class.relrowsecurity`, `pg_policies` |
| Supabase Auth (GoTrue) | mọi provider `false`, `auth.users` = 0 dòng | `/auth/v1/settings` |
| App dùng Data API? | **Không** — 0 gói `@supabase/*` trong lockfile | nối DB bằng Prisma qua session pooler 5432 |

Supabase với dự án này chỉ là **Postgres có hosting**, không hơn.

## Vì sao đóng

Mặc định Supabase cấp cho `anon` và `authenticated` **đủ 7 quyền** (kể cả DELETE,
TRUNCATE) trên **mọi** bảng trong `public`, và mở chúng ra Internet qua PostgREST.
Thứ duy nhất đứng giữa là RLS. Ngày 03/09 và 05/09 hai bảng mới
(`enquiry_status_events`, `tour_cost_items`) ra đời **không có RLS** vì migration
hardening 18/07 chỉ bật cho những bảng đã biết lúc đó — advisor bắt được ngày 06/09,
migration `20260906150000_w2_rls_backstop_new_tables` vá ngày 07/09.

Đóng Data API biến "bảng thứ N+1 quên RLS" từ **lỗ hổng** thành **không có gì**.

## Bốn lớp chắn, và chúng độc lập ra sao

1. **Data API tắt** ở Integrations → Data API.
2. **`pgrst.db_schemas` trỏ vào schema rỗng.** Ghi ở cấp ROLE (`ALTER ROLE authenticator SET`)
   nên sống qua restart PostgREST; không phải setting của một phiên.
3. **RLS deny-all**: 36/36 bảng bật RLS với 0 policy. Đã kiểm cả ba lối xuyên RLS —
   `public` có **0 view, 0 matview, 0 hàm SECURITY DEFINER**, và `anon`/`authenticated`
   đều `rolbypassrls = false`.
4. **App không dùng**: 0 gói `@supabase/*` trong `pnpm-lock.yaml` và 18 `package.json`,
   0 biến `SUPABASE` trong 11 file `.env*`.

Lớp 1 và 2 tháo được bằng một cú click; lớp 3 và 4 thì không. Đừng nhầm bốn lớp này là
bốn lần an toàn — chúng là bốn thứ khác nhau phải cùng đúng.

## Bề mặt CÒN MỞ — biết để canh

Tắt Data API **không** đóng hết Supabase:

- **Realtime** là bề mặt duy nhất còn nhận anon key thật sự. WebSocket mở được, và
  `phx_join` vào `realtime:public:tours` được **chấp nhận**. Hôm nay không rò một dòng
  nào vì ba điều kiện cùng đúng: publication `supabase_realtime` **không chứa bảng nào**,
  `postgres_changes` chỉ stream thay đổi (không có snapshot ban đầu), và RLS deny-all ở
  dưới. Thêm một bảng vào publication — một cú click trong dashboard — là mất chốt thứ
  nhất. Kênh broadcast/presence vẫn dùng được như một relay miễn phí.
- **Storage** trả `200 []` chứ không phải 401: API đang nghe và nhận anon key bình thường.
  Không lộ gì vì `storage.buckets` = 0 dòng. Ngày nào tạo bucket mà quên policy là hở ngay.
- **GoTrue không tắt được.** Supabase không cho tắt hẳn service Auth; nó vẫn sống và vẫn
  lộ ra Internet (`/auth/v1/health` → 200). Ta chỉ tắt được từng provider.
- **Grant tồn dư**: `anon` và `authenticated` vẫn giữ đủ 7 quyền trên cả 36 bảng, **không
  bảng nào bật FORCE RLS**, và 48 function trong `public` đều `EXECUTE` được.

**Luật rút ra: bật lại Data API là một quyết định bảo mật cần ADR, không phải một cú gạt
trong UI.** Bật lại là quay về đúng trạng thái mà chỉ RLS đứng giữa `anon` và toàn bộ dữ liệu.

## Thứ tự hoàn tác — sai thứ tự là gãy

Vì đã chạy tay `ALTER ROLE authenticator SET pgrst.db_schemas`, **UI Dashboard không còn
quản lý Exposed schemas nữa** (docs Supabase nói thẳng điều này). Muốn quay lại:

```sql
alter role authenticator reset pgrst.db_schemas;
notify pgrst, 'reload config';
```

rồi mới bật Data API + đặt Exposed schemas trong Dashboard, và **chỉ sau đó** mới được
`drop schema pgrst_no_exposed_schemas`. Drop một schema còn nằm trong `db_schemas` thì
PostgREST không build được schema cache và trả `PGRST002` — đúng kiểu "lệch pha không ai
canh" mà CLAUDE.md §15 nói tới.

## Cách kiểm chứng lại

Project có **HAI khóa publishable đang bật**: khóa `anon` legacy (JWT) và khóa kiểu mới
`sb_publishable_…`. Kiểm mà chỉ thử một khóa là kết luận hẹp hơn cái mình tưởng.

```bash
# thay <KEY> lần lượt bằng CẢ HAI khóa (Settings → API Keys)
curl -s -w '\nHTTP %{http_code}\n' 'https://nodcpmpqxgnekhjftrcf.supabase.co/rest/v1/tours?select=id&limit=1' -H 'apikey: <KEY>'
```

Kỳ vọng: `404 PGRST205` nhắc tới `pgrst_no_exposed_schemas`. Thêm `-H 'Accept-Profile: public'`
phải ra `406 PGRST106`. `/graphql/v1` cũng `406`. `/auth/v1/settings` phải cho mọi provider
`false`.

Ba cái bẫy khi đọc kết quả:

- **Phải có phép đối chứng.** 404 chỉ có nghĩa khi biết dữ liệu vẫn còn trong DB
  (`select count(*) from tours` → 29 dòng ngày 09/09). Không có đối chứng thì "404" cũng
  có thể chỉ là bảng rỗng, và cả bài nghiệm thu thành vô nghĩa.
- **`/rest/v1/` root trả thông báo KHÁC nhau cho hai loại khóa**: legacy nhận
  *"Only the `service_role` API key can be used"*, publishable nhận *"Only secret API keys
  can be used"*. Nhớ một chuỗi rồi tưởng hành vi đã đổi.
- **`/signup` trả 404; đường đăng ký thật của web là `/register`.** Nhắm nhầm là tự tạo
  báo động giả.

## Bẫy đo lường đã cắn — đừng cắn lại

- **`curl` KHÔNG kiểm được Realtime.** Nó bắt tay upgrade qua HTTP/2 nên Cloudflare ném
  `500 error code: 1101` cả ba lần thử — nhìn vào là tưởng Realtime đã đóng. Mở WebSocket
  thật bằng Node thì kết nối OPEN ngay. Kết quả curl ở đây là **âm tính giả**.
- **Mở WebSocket thật lại là GHI, không phải đọc.** Nó đánh thức tenant Realtime, và tenant
  tự chạy DDL trên chính DB prod: tạo partition cho `realtime.messages`, tạo publication
  `supabase_realtime_messages_publication`, tạo một **logical replication slot**. Slot tự
  biến mất khi tenant ngủ lại (đo lại sau ~15 phút: `pg_replication_slots` rỗng), publication
  thì ở lại. Kèm theo đó, event trigger `pgrst_ddl_watch` bắn `NOTIFY pgrst` — nhìn rời rạc
  rất dễ tưởng có ai đó đang cào lại cấu hình. **Không dùng phép đo này trong session thi
  công** (CLAUDE.md §15).
- **Dấu vết audit của Supabase Auth không nằm trong Postgres.** Bảng
  `auth.audit_log_entries` trống trơn (0 dòng); bản ghi `user_deleted` nằm ở luồng log nền
  tảng `auth_audit_logs`, lấy bằng `query_logs`. Tìm sai chỗ rồi kết luận "không có dấu vết"
  là sai.
- **Tên schema có hai biến thể.** Docs Supabase đặt tiêu đề là `pg_pgrst_no_exposed_schemas`
  nhưng đoạn workaround lại tạo `pgrst_no_exposed_schemas`. Tên đang chạy là bản **không có**
  `pg_`. Grep log thì tìm cả hai.

## Cố ý bỏ qua — đừng điều tra lại

Advisor sau khi đóng: **0 error, 7 warning, 36 + 31 suggestion**. Tất cả đều đã xét:

| Cảnh báo | Vì sao bỏ qua |
| --- | --- |
| `rls_enabled_no_policy` ×36 | Cố ý. RLS bật với 0 policy = Postgres từ chối **mọi** lệnh cho role không `bypassrls`. Advisor không phân biệt "quên viết policy" với "cố tình khoá sạch" |
| `function_search_path_mutable` ×5 (`pgboss.*`) | `anon` không có USAGE trên schema `pgboss`; còn là code thư viện pg-boss, sửa tay là tạo drift khi nâng cấp |
| `function_search_path_mutable` (`public.refunds_sum_within_total`) | SECURITY INVOKER, là trigger function, RPC trả 404. Muốn khai thác phải CREATE được object trong `public` mà `anon`/`authenticated` đều không có quyền đó. **Còn treo**: vá một dòng kèm migration kế tiếp |
| `extension_in_public` (`citext`) | 4 cột email đang dùng (`users`, `enquiries`, `subscribers`, `email_suppressions`). Dời schema đụng `datasource extensions = [citext]` của Prisma; trước freeze 15/10 thì cost > benefit |
| `auth_leaked_password_protection` | **Đã tự rút** sau khi tắt provider Email (8 warning → 7). Nếu bật lại Email thì lint quay lại — và tính năng đó là **Pro Plan trở lên**, project đang Free nên không bật được |
| 20× `unused_index` (performance) | Site gần như không có traffic; thống kê nói "chưa ai dùng" chứ không phải "vô dụng". Xoá index dựa trên prod vắng khách là bẫy kinh điển |
| 11× `unindexed_foreign_keys` | 3 của `pgboss`, 7 là cột actor admin. Chỉ `cancellation_requests.user_id` đáng cân nhắc khi làm P4e/P4f |

## Mốc 30/10/2026

Changelog Supabase 28/04/2026: bảng mới trong `public` sẽ **thôi được tự động expose** ra
Data API, hiệu lực **30/10/2026** — rơi sau freeze 15/10 của dự án. Với ta là no-op vì Data
API đã tắt. Ghi lại để nếu dashboard hiện banner trong tuần bảo vệ thì biết đó là gì.
