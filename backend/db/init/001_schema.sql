CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'operator',
  is_active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username);

CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  original_filename varchar(255) NOT NULL,
  storage_path varchar(500) NOT NULL,
  format varchar(10) NOT NULL,
  size_bytes integer NOT NULL,
  width integer NULL,
  height integer NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  store_name varchar(255) NULL,
  store_code varchar(50) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_images_user_id ON images (user_id);
CREATE INDEX IF NOT EXISTS ix_images_created_at ON images (created_at);

CREATE TABLE IF NOT EXISTS processing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid NOT NULL REFERENCES images (id) ON DELETE CASCADE,
  status varchar(50) NOT NULL DEFAULT 'pending',
  results jsonb NULL,
  processed_at timestamptz NULL,
  processing_time_ms integer NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_processing_results_image_id ON processing_results (image_id);
CREATE INDEX IF NOT EXISTS ix_processing_results_created_at ON processing_results (created_at);
CREATE INDEX IF NOT EXISTS ix_processing_results_status ON processing_results (status);

