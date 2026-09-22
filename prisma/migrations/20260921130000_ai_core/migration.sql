-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI', 'GEMINI');

-- CreateEnum
CREATE TYPE "AiExecutionStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_provider_settings" (
    "id" UUID NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_provider_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_executions" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "intent" TEXT NOT NULL,
    "status" "AiExecutionStatus" NOT NULL,
    "error_code" TEXT,
    "provider" "AiProvider",
    "model" TEXT,
    "prompt_version" TEXT,
    "entity_type" TEXT,
    "entity_id" UUID,
    "input_summary" TEXT NOT NULL,
    "output_summary" TEXT,
    "confidence_score" DECIMAL(3,2),
    "tool_calls" INTEGER NOT NULL DEFAULT 0,
    "provider_calls" INTEGER NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "repair_attempted" BOOLEAN NOT NULL DEFAULT false,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_settings_provider_key" ON "ai_provider_settings"("provider");

-- CreateIndex
CREATE INDEX "ai_executions_created_at_idx" ON "ai_executions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_executions_actor_id_created_at_idx" ON "ai_executions"("actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "ai_provider_settings" ADD CONSTRAINT "ai_provider_settings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints -----------------------------------------------------------
ALTER TABLE ai_provider_settings
  ADD CONSTRAINT ai_provider_settings_model_present CHECK (btrim(model) <> ''),
  ADD CONSTRAINT ai_provider_settings_key_format CHECK (api_key_encrypted LIKE 'v1:%');

ALTER TABLE ai_executions
  ADD CONSTRAINT ai_executions_intent_present CHECK (btrim(intent) <> ''),
  ADD CONSTRAINT ai_executions_error_iff_failed CHECK ((status = 'FAILED') = (error_code IS NOT NULL)),
  ADD CONSTRAINT ai_executions_model_with_provider CHECK (model IS NULL OR provider IS NOT NULL),
  ADD CONSTRAINT ai_executions_entity_pair CHECK ((entity_type IS NULL) = (entity_id IS NULL)),
  ADD CONSTRAINT ai_executions_input_summary_length CHECK (char_length(input_summary) <= 500),
  ADD CONSTRAINT ai_executions_confidence_range CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  ADD CONSTRAINT ai_executions_counts_not_negative CHECK (
    tool_calls >= 0 AND provider_calls >= 0 AND evidence_count >= 0 AND latency_ms >= 0
    AND (input_tokens IS NULL OR input_tokens >= 0) AND (output_tokens IS NULL OR output_tokens >= 0));

-- At most one active provider ------------------------------------------------
CREATE UNIQUE INDEX ai_provider_settings_one_active ON ai_provider_settings (is_active) WHERE is_active;

-- The execution log is append-only (reuses forbid_mutation() from the first migration) -----------------
CREATE TRIGGER ai_executions_append_only
  BEFORE UPDATE OR DELETE ON ai_executions FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
