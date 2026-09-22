-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_login_at" TIMESTAMPTZ(3),
ADD COLUMN     "locked_until" TIMESTAMPTZ(3),
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STAFF';

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraint -----------------------------------------------------------
ALTER TABLE users ADD CONSTRAINT users_failed_login_count_nonneg CHECK (failed_login_count >= 0);

-- There is always at least one active admin -----------------------------------
-- An UPDATE that would demote or deactivate the last active admin is refused, so nobody can lock everyone out (screens check it too).
CREATE FUNCTION guard_last_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'ADMIN' AND OLD.status = 'ACTIVE' AND (NEW.role <> 'ADMIN' OR NEW.status <> 'ACTIVE') THEN
    IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id <> OLD.id AND u.role = 'ADMIN' AND u.status = 'ACTIVE') THEN
      RAISE EXCEPTION 'the last active admin cannot be demoted or deactivated' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER users_last_admin_guard
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION guard_last_admin();
