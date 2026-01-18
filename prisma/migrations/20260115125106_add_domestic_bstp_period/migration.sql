-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `domestic_bstp_period` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bstp_cls_code` CHAR(4) NOT NULL,
    `period_div_code` CHAR(1) NOT NULL,
    `stck_bsop_date` CHAR(8) NOT NULL,
    `bstp_nmix_prpr` VARCHAR(112) NULL,
    `bstp_nmix_oprc` VARCHAR(112) NULL,
    `bstp_nmix_hgpr` VARCHAR(112) NULL,
    `bstp_nmix_lwpr` VARCHAR(112) NULL,
    `acml_vol` VARCHAR(18) NULL,
    `acml_tr_pbmn` VARCHAR(18) NULL,
    `mod_yn` CHAR(1) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `domestic_bstp_period_stck_bsop_date_idx`(`stck_bsop_date`),
    UNIQUE INDEX `domestic_bstp_period_bstp_cls_code_period_div_code_stck_bsop_key`(`bstp_cls_code`, `period_div_code`, `stck_bsop_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
