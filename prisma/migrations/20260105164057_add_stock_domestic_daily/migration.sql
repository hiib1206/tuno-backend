-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `stock_domestic_daily` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mksc_shrn_iscd` VARCHAR(9) NOT NULL,
    `stck_bsop_date` CHAR(8) NOT NULL,
    `stck_clpr` VARCHAR(10) NOT NULL,
    `stck_oprc` VARCHAR(10) NOT NULL,
    `stck_hgpr` VARCHAR(10) NOT NULL,
    `stck_lwpr` VARCHAR(10) NOT NULL,
    `acml_vol` VARCHAR(18) NOT NULL,
    `acml_tr_pbmn` VARCHAR(18) NOT NULL,
    `flng_cls_code` CHAR(2) NOT NULL,
    `prtt_rate` VARCHAR(11) NOT NULL,
    `mod_yn` CHAR(1) NOT NULL,
    `prdy_vrss_sign` CHAR(1) NOT NULL,
    `prdy_vrss` VARCHAR(10) NOT NULL,
    `revl_issu_reas` CHAR(2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_domestic_daily_mksc_shrn_iscd_stck_bsop_date_key`(`mksc_shrn_iscd`, `stck_bsop_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
