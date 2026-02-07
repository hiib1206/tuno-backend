/*
  Warnings:

  - You are about to drop the column `is_active` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `User_is_active_idx` ON `user`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `is_active`,
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `User_deleted_at_idx` ON `user`(`deleted_at`);
