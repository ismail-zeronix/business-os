-- AlterTable
ALTER TABLE "ai_executions" ADD COLUMN     "cache_read_tokens" INTEGER,
ADD COLUMN     "cache_write_tokens" INTEGER;

-- CHECK constraints -----------------------------------------------------------
ALTER TABLE ai_executions
  ADD CONSTRAINT ai_executions_cache_tokens_not_negative CHECK (
    (cache_read_tokens IS NULL OR cache_read_tokens >= 0) AND (cache_write_tokens IS NULL OR cache_write_tokens >= 0));
