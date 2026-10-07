-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "assigned_to_id" UUID;

-- CreateIndex
CREATE INDEX "email_messages_assigned_to_id_idx" ON "email_messages"("assigned_to_id");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
