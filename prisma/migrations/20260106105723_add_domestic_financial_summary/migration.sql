-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `domestic_financial_summary` (
    `id` VARCHAR(191) NOT NULL,
    `mksc_shrn_iscd` CHAR(9) NOT NULL,
    `fid_div_cls_code` CHAR(1) NOT NULL,
    `stac_yymm` CHAR(6) NOT NULL,
    `revenue` VARCHAR(18) NULL,
    `operating_income` VARCHAR(182) NULL,
    `net_income` VARCHAR(102) NULL,
    `total_assets` VARCHAR(102) NULL,
    `total_liabilities` VARCHAR(102) NULL,
    `total_equity` VARCHAR(102) NULL,
    `capital_stock` VARCHAR(22) NULL,
    `debt_ratio` VARCHAR(84) NULL,
    `quick_ratio` VARCHAR(84) NULL,
    `retained_earnings_ratio` VARCHAR(84) NULL,
    `roe` VARCHAR(132) NULL,
    `eps` VARCHAR(112) NULL,
    `per` VARCHAR(112) NULL,
    `bps` VARCHAR(112) NULL,
    `pbr` VARCHAR(112) NULL,

    UNIQUE INDEX `domestic_financial_summary_mksc_shrn_iscd_fid_div_cls_code_s_key`(`mksc_shrn_iscd`, `fid_div_cls_code`, `stac_yymm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
