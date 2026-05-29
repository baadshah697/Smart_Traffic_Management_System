-- 1. Function to log violation status changes
CREATE OR REPLACE FUNCTION log_violation_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, payload)
    VALUES (
      auth.uid(), 
      'UPDATE_STATUS_' || NEW.status, 
      'violations', 
      NEW.id, 
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger for violation status changes
CREATE TRIGGER on_violation_status_change
  AFTER UPDATE ON violations
  FOR EACH ROW
  EXECUTE FUNCTION log_violation_changes();


-- 3. Function to mark challan as paid
CREATE OR REPLACE FUNCTION handle_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE e_challans 
  SET status = 'paid' 
  WHERE id = NEW.challan_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger for payment completion
CREATE TRIGGER on_payment_completed
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_success();
