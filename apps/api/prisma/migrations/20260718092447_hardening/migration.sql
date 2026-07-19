-- ─────────────────────────────────────────────────────────────────────────────
-- Tourism v2 — DDL hardening mà schema của Prisma không diễn tả được.
-- Port từ Nexora `prisma/hardening.sql` + các audit delta (H1/H2, khoảng trống RLS).
--
-- CÁCH APPLY: file này phải nằm thành migration RIÊNG, apply SAU các schema
-- migration. Khi đã có schema migration đầu tiên:
--   pnpm prisma migrate dev --create-only --name hardening_v2
--   → dán file này vào migration.sql được sinh ra, rồi `migrate dev`.
-- Giữ file này là source of truth; migration là bản đã apply.
--
-- Ghi chú so với Nexora:
--   * citext: extension giờ do schema sở hữu
--     (`datasource … extensions = [citext]`), nên không ALTER COLUMN ở đây — schema
--     migration tạo users.email / subscribers.email thẳng thành citext.
--     CREATE EXTENSION bên dưới là no-op cho chắc ăn.
--   * MỚI: CHECK + RLS cho refunds; RLS trên cancellation_requests (Nexora bỏ
--     sót — file của nó có trước model) và trên mọi bảng thêm về sau.
--   * Audit H2 (nhất quán status↔refund: bookings.status thuộc
--     REFUNDED/PARTIALLY_REFUNDED ⇒ ít nhất một row refunds): một CHECK thường
--     không tham chiếu được bảng khác — cần constraint trigger. CHƯA làm
--     ở đây; quyết định với lead trước khi vào P2 money-path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── citext: email unique case-insensitive (ADR-0008) ─────────────────────────
CREATE EXTENSION IF NOT EXISTS citext;

-- ── CHECK constraint (giá trị có biên) ───────────────────────────────────────
ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE tour_departures
  ADD CONSTRAINT departures_seats_nonneg CHECK (seats_total >= 0 AND seats_booked >= 0),
  ADD CONSTRAINT departures_seats_within_total CHECK (seats_booked <= seats_total);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_amount_nonneg CHECK (total_amount >= 0),
  ADD CONSTRAINT bookings_unit_price_nonneg CHECK (unit_price >= 0),
  ADD CONSTRAINT bookings_adults_min CHECK (num_adults >= 1),
  ADD CONSTRAINT bookings_children_nonneg CHECK (num_children >= 0);

ALTER TABLE tours
  ADD CONSTRAINT tours_base_price_nonneg CHECK (base_price >= 0),
  ADD CONSTRAINT tours_duration_min CHECK (duration_days >= 1),
  ADD CONSTRAINT tours_group_min CHECK (max_group_size >= 1);

-- Refund ledger (audit H1): số tiền phải dương ngặt — một row bằng 0/âm sẽ làm
-- hỏng booking status suy ra từ SUM(refunds).
ALTER TABLE refunds
  ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0);

-- ── Row-Level Security: bật trên mọi bảng (defense-in-depth) ─────────────────
-- API kết nối bằng role sở hữu bảng, vốn bypass RLS — mấy dòng này là backstop
-- nếu một ngày xuất hiện đường direct/anon. Mặc định deny (không policy nào).
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_destinations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_itinerary_days   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_departures       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_faqs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_media_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tag_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tours            ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox                ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_garbage         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages         ENABLE ROW LEVEL SECURITY;
