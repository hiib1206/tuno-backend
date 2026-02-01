-- AlterTable
ALTER TABLE `ai_inference_history` ADD COLUMN `exchange` VARCHAR(4) NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
