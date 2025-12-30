/*
  Warnings:

  - You are about to drop the `email_verification_code` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `email_verification_code` DROP FOREIGN KEY `email_verification_code_user_id_fkey`;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- DropTable
DROP TABLE `email_verification_code`;
