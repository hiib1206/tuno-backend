-- AlterTable
ALTER TABLE `stock_domestic_daily` MODIFY `stck_clpr` VARCHAR(10) NULL,
    MODIFY `stck_oprc` VARCHAR(10) NULL,
    MODIFY `stck_hgpr` VARCHAR(10) NULL,
    MODIFY `stck_lwpr` VARCHAR(10) NULL,
    MODIFY `acml_vol` VARCHAR(18) NULL,
    MODIFY `acml_tr_pbmn` VARCHAR(18) NULL,
    MODIFY `flng_cls_code` CHAR(2) NULL,
    MODIFY `prtt_rate` VARCHAR(11) NULL,
    MODIFY `mod_yn` CHAR(1) NULL,
    MODIFY `prdy_vrss_sign` CHAR(1) NULL,
    MODIFY `prdy_vrss` VARCHAR(10) NULL,
    MODIFY `revl_issu_reas` CHAR(2) NULL;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
