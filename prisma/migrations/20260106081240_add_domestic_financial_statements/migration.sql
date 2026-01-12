-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `domestic_income_statement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mksc_shrn_iscd` CHAR(9) NOT NULL,
    `fid_div_cls_code` CHAR(1) NOT NULL,
    `stac_yymm` CHAR(6) NOT NULL,
    `sale_account` VARCHAR(18) NULL,
    `sale_cost` VARCHAR(182) NULL,
    `sale_totl_prfi` VARCHAR(182) NULL,
    `depr_cost` VARCHAR(182) NULL,
    `sell_mang` VARCHAR(182) NULL,
    `bsop_prti` VARCHAR(182) NULL,
    `bsop_non_ernn` VARCHAR(182) NULL,
    `bsop_non_expn` VARCHAR(182) NULL,
    `op_prfi` VARCHAR(182) NULL,
    `spec_prfi` VARCHAR(182) NULL,
    `spec_loss` VARCHAR(182) NULL,
    `thtr_ntin` VARCHAR(102) NULL,

    UNIQUE INDEX `domestic_income_statement_mksc_shrn_iscd_fid_div_cls_code_st_key`(`mksc_shrn_iscd`, `fid_div_cls_code`, `stac_yymm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domestic_balance_sheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mksc_shrn_iscd` CHAR(9) NOT NULL,
    `fid_div_cls_code` CHAR(1) NOT NULL,
    `stac_yymm` CHAR(6) NOT NULL,
    `cras` VARCHAR(112) NULL,
    `fxas` VARCHAR(112) NULL,
    `total_aset` VARCHAR(102) NULL,
    `flow_lblt` VARCHAR(112) NULL,
    `fix_lblt` VARCHAR(112) NULL,
    `total_lblt` VARCHAR(102) NULL,
    `cpfn` VARCHAR(22) NULL,
    `cfp_surp` VARCHAR(182) NULL,
    `prfi_surp` VARCHAR(182) NULL,
    `total_cptl` VARCHAR(102) NULL,

    UNIQUE INDEX `domestic_balance_sheet_mksc_shrn_iscd_fid_div_cls_code_stac__key`(`mksc_shrn_iscd`, `fid_div_cls_code`, `stac_yymm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domestic_stability_ratio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mksc_shrn_iscd` CHAR(9) NOT NULL,
    `fid_div_cls_code` CHAR(1) NOT NULL,
    `stac_yymm` CHAR(6) NOT NULL,
    `lblt_rate` VARCHAR(84) NULL,
    `bram_depn` VARCHAR(92) NULL,
    `crnt_rate` VARCHAR(84) NULL,
    `quck_rate` VARCHAR(84) NULL,

    UNIQUE INDEX `domestic_stability_ratio_mksc_shrn_iscd_fid_div_cls_code_sta_key`(`mksc_shrn_iscd`, `fid_div_cls_code`, `stac_yymm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domestic_financial_ratio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mksc_shrn_iscd` CHAR(9) NOT NULL,
    `fid_div_cls_code` CHAR(2) NOT NULL,
    `stac_yymm` CHAR(6) NOT NULL,
    `grs` VARCHAR(124) NULL,
    `bsop_prfi_inrt` VARCHAR(124) NULL,
    `ntin_inrt` VARCHAR(124) NULL,
    `roe_val` VARCHAR(132) NULL,
    `eps` VARCHAR(112) NULL,
    `sps` VARCHAR(18) NULL,
    `bps` VARCHAR(112) NULL,
    `rsrv_rate` VARCHAR(84) NULL,
    `lblt_rate` VARCHAR(84) NULL,

    UNIQUE INDEX `domestic_financial_ratio_mksc_shrn_iscd_fid_div_cls_code_sta_key`(`mksc_shrn_iscd`, `fid_div_cls_code`, `stac_yymm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
