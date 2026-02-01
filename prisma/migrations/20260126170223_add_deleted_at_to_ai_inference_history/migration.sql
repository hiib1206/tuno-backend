-- DropForeignKey
ALTER TABLE `ai_inference_history` DROP FOREIGN KEY `ai_inference_history_user_id_fkey`;

-- DropIndex
DROP INDEX `ai_inference_history_user_id_model_type_requested_at_idx` ON `ai_inference_history`;

-- AlterTable
ALTER TABLE `ai_inference_history` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `ai_inference_history_user_id_model_type_deleted_at_requested_idx` ON `ai_inference_history`(`user_id`, `model_type`, `deleted_at`, `requested_at` DESC);
