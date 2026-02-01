-- AlterTable: Add ticker column
ALTER TABLE `ai_inference_history` ADD COLUMN `ticker` VARCHAR(16) NULL;

-- CreateIndex
CREATE INDEX `ai_inference_history_user_id_ticker_deleted_at_requested_at_idx` ON `ai_inference_history`(`user_id`, `ticker`, `deleted_at`, `requested_at` DESC);
