-- AlterTable
ALTER TABLE `krx_stock_master` ADD COLUMN `etpr_undt_objt_co_yn` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `prst_cls_code` CHAR(1) NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
