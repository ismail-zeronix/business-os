-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskLinkType" AS ENUM ('ENQUIRY', 'CUSTOMER', 'EMAIL');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "due_at" TIMESTAMPTZ(3),
    "assigned_to_id" UUID,
    "created_by_id" UUID NOT NULL,
    "linked_type" "TaskLinkType",
    "linked_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_status_due_at_idx" ON "tasks"("status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_id_status_idx" ON "tasks"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "tasks_linked_type_linked_id_idx" ON "tasks"("linked_type", "linked_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written guards (Prisma cannot express CHECK constraints): a linked task names both a type and an id or
-- neither, completed/cancelled bookkeeping is internally consistent, a cancelled task always has a reason, and
-- status agrees with exactly one of the two timestamp pairs.
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_link_both_or_neither" CHECK (("linked_type" IS NULL) = ("linked_id" IS NULL)),
  ADD CONSTRAINT "tasks_completed_consistent" CHECK (("completed_at" IS NULL) = ("completed_by_id" IS NULL)),
  ADD CONSTRAINT "tasks_cancelled_consistent" CHECK (("cancelled_at" IS NULL) = ("cancelled_by_id" IS NULL)),
  ADD CONSTRAINT "tasks_cancelled_reason_required" CHECK ("cancelled_at" IS NULL OR "cancelled_reason" IS NOT NULL),
  ADD CONSTRAINT "tasks_status_matches_timestamps" CHECK (
    ("status" = 'OPEN'      AND "completed_at" IS NULL     AND "cancelled_at" IS NULL) OR
    ("status" = 'DONE'      AND "completed_at" IS NOT NULL AND "cancelled_at" IS NULL) OR
    ("status" = 'CANCELLED' AND "completed_at" IS NULL     AND "cancelled_at" IS NOT NULL)
  );
