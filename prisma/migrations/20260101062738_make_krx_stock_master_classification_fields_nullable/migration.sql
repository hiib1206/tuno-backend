-- AlterTable
ALTER TABLE `krx_stock_master` MODIFY `avls_scal_cls_code` CHAR(1) NULL,
    MODIFY `bstp_larg_div_code` CHAR(4) NULL,
    MODIFY `bstp_medm_div_code` CHAR(4) NULL,
    MODIFY `bstp_smal_div_code` CHAR(4) NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
