-- AlterTable
ALTER TABLE `ai_inference_history` MODIFY `model_type` ENUM('SNAPBACK', 'QUANT_SIGNAL') NOT NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
