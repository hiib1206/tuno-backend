-- AlterTable
ALTER TABLE `krx_stock_master` ADD COLUMN `nxt_in_master` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
