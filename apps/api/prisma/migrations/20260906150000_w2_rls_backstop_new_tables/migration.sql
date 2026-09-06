-- W2 (audit 05/09 cụm 6 — Thấp): hai bảng sinh SAU đợt hardening 18/07
-- (tour_cost_items ~05/09 theo ADR-0033, enquiry_status_events P4c) lọt lưới
-- RLS backstop mà mọi bảng khác đã có. Cùng tinh thần migration hardening:
-- default deny, KHÔNG policy — API nối bằng role chủ bảng nên bypass RLS;
-- đây là lưới cho đường anon/direct nếu một ngày nó xuất hiện (Supabase có
-- sẵn anon key). Từ nay scripts/check-rls.sh canh trong CI để bảng mới không
-- lọt lần ba.
ALTER TABLE enquiry_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_cost_items       ENABLE ROW LEVEL SECURITY;
