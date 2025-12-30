-- AlterTable
ALTER TABLE `email_verification_code` MODIFY `user_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
