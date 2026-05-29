CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE violations
    SET status = 'paid'
    WHERE id = NEW.violation_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_success_trigger
AFTER UPDATE ON payments
FOR EACH ROW
WHEN (NEW.payment_status = 'paid')
EXECUTE FUNCTION update_payment_status();
