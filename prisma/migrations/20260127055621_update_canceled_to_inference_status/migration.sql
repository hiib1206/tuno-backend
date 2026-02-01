/*
  Warnings:

  - The values [CANCELLED] on the enum `ai_inference_history_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `ai_inference_history` MODIFY `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
