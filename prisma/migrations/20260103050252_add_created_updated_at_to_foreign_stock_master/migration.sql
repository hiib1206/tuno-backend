/*
  Warnings:

  - Added the required column `updated_at` to the `foreign_stock_master` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `foreign_stock_master` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
