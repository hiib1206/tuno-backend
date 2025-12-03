-- AlterTable
ALTER TABLE `user` ADD COLUMN `profile_image_updated_at` DATETIME(3) NULL,
    MODIFY `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `kospi_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mksc_shrn_iscd` VARCHAR(9) NOT NULL,
    `stnd_iscd` VARCHAR(12) NOT NULL,
    `hts_kor_isnm` VARCHAR(50) NOT NULL,
    `scrt_grp_cls_code` VARCHAR(2) NULL,
    `avls_scal_cls_code` VARCHAR(1) NULL,
    `bstp_larg_div_code` VARCHAR(4) NULL,
    `bstp_medm_div_code` VARCHAR(4) NULL,
    `bstp_smal_div_code` VARCHAR(4) NULL,
    `created_at` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mksc_shrn_iscd`(`mksc_shrn_iscd`),
    UNIQUE INDEX `stnd_iscd`(`stnd_iscd`),
    UNIQUE INDEX `hts_kor_isnm`(`hts_kor_isnm`),
    INDEX `idx_bstp_larg_div_code`(`bstp_larg_div_code`),
    INDEX `idx_scrt_grp_cls_code`(`scrt_grp_cls_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
