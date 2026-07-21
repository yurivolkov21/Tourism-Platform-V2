-- BK-R1 (ADR-0009): SUM(refunds) mỗi booking không được vượt total_amount.
-- Lưới cứng ở tầng DB — dù code tương lai quên advisory lock, ledger vẫn không
-- thể vượt total. Cùng khuôn hardening.sql (invariant nằm ngoài Prisma schema).

CREATE OR REPLACE FUNCTION refunds_sum_within_total() RETURNS trigger AS $$
DECLARE
  booking_total numeric(14,2);
  refunded_sum  numeric(14,2);
BEGIN
  SELECT total_amount INTO booking_total FROM bookings WHERE id = NEW.booking_id;
  SELECT COALESCE(SUM(amount), 0) INTO refunded_sum FROM refunds WHERE booking_id = NEW.booking_id;
  IF refunded_sum + NEW.amount > booking_total THEN
    RAISE EXCEPTION 'refunds SUM % + % exceeds booking total % (booking %)',
      refunded_sum, NEW.amount, booking_total, NEW.booking_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refunds_sum_within_total
  BEFORE INSERT ON refunds
  FOR EACH ROW EXECUTE FUNCTION refunds_sum_within_total();
