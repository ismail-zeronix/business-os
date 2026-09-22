-- Newest-first reads across all observations (the Overview "latest observations" list).
-- Measured on a synthetic 600k-row volume: about 300 ms before, about 13 ms after.
CREATE INDEX "price_observations_observed_at_idx" ON "price_observations"("observed_at" DESC);
CREATE INDEX "stock_observations_observed_at_idx" ON "stock_observations"("observed_at" DESC);
