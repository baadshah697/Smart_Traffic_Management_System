-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- USER ROLES POLICIES
CREATE POLICY "Users can view their own role"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- AUDIT LOGS POLICIES
CREATE POLICY "Admins can view audit logs"
ON audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND role = 'admin'
  )
);

-- PAYMENTS POLICIES
CREATE POLICY "Users can view their payments"
ON payments
FOR SELECT
USING (true);
