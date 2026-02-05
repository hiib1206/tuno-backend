/*
  Warnings:

  - You are about to alter the column `role` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `Enum(EnumId(0))`.

*/
-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('FREE', 'PRO', 'ADMIN') NOT NULL DEFAULT 'FREE',
    ALTER COLUMN `updated_at` DROP DEFAULT;
