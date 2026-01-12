-- AlterTable
ALTER TABLE `krx_stock_master` ADD COLUMN `stck_lstn_date` CHAR(8) NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
