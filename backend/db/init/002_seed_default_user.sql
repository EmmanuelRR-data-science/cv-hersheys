INSERT INTO users (username, password_hash, role, is_active, failed_login_attempts, locked_until)
VALUES (
  'hersheys',
  '$2b$12$TL8UQbaGfMLwmAvZwoA4AObCrFsxDYkrCDlvY6vLsrXm1kJqs8Hp.',
  'analyst',
  true,
  0,
  NULL
)
ON CONFLICT (username) DO NOTHING;

