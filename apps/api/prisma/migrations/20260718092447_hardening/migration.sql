-- ─────────────────────────────────────────────────────────────────────────────
-- Tourism v2 — hardening DDL that Prisma's schema can't express.
-- Ported from Nexora `prisma/hardening.sql` + audit deltas (H1/H2, RLS gaps).
--
-- HOW TO APPLY: this file must land as its OWN migration, applied AFTER the
-- schema migrations. Once the first schema migration exists:
--   pnpm prisma migrate dev --create-only --name hardening_v2
--   → paste this file into the generated migration.sql, then `migrate dev`.
-- Keep this file as the source of truth; the migration is the applied copy.
--
-- Notes vs Nexora:
--   * citext: the extension is owned by the schema now
--     (`datasource … extensions = [citext]`), so no ALTER COLUMN here — the
--     schema migration creates users.email / subscribers.email as citext
--     directly. CREATE EXTENSION below is a belt-and-braces no-op.
--   * NEW: refunds CHECKs + RLS; RLS on cancellation_requests (missed by
--     Nexora — its file predates the model) and on every table added since.
--   * Audit H2 (status↔refund consistency: bookings.status in
--     REFUNDED/PARTIALLY_REFUNDED ⇒ at least one refunds row): a plain CHECK
--     cannot reference another table — needs a constraint trigger. NOT
--     implemented here; decide with the lead before P2 money-path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── citext: case-insensitive unique email (ADR-0008) ─────────────────────────
CREATE EXTENSION IF NOT EXISTS citext;

-- ── CHECK constraints (bounded values) ───────────────────────────────────────
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

-- Refund ledger (audit H1): amounts are strictly positive — a zero/negative
-- row would corrupt the SUM(refunds)-derived booking status.
ALTER TABLE refunds
  ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0);

-- ── Row-Level Security: enable on every table (defense-in-depth) ─────────────
-- The API connects as the table-owning role, which bypasses RLS — these are a
-- backstop if a direct/anon path ever appears. Default deny (no policies).
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
