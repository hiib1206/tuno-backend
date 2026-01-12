/*
  Warnings:

  - You are about to drop the `kospi_master` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- DropTable
DROP TABLE `kospi_master`;

-- CreateTable
CREATE TABLE `krx_stock_master` (
    `market_code` CHAR(2) NOT NULL,
    `mksc_shrn_iscd` CHAR(6) NOT NULL,
    `stnd_iscd` CHAR(12) NOT NULL,
    `hts_kor_isnm` VARCHAR(50) NOT NULL,
    `scrt_grp_cls_code` CHAR(2) NOT NULL,
    `avls_scal_cls_code` CHAR(1) NOT NULL,
    `bstp_larg_div_code` CHAR(4) NOT NULL,
    `bstp_medm_div_code` CHAR(4) NOT NULL,
    `bstp_smal_div_code` CHAR(4) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `krx_stock_master_stnd_iscd_key`(`stnd_iscd`),
    PRIMARY KEY (`market_code`, `mksc_shrn_iscd`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
