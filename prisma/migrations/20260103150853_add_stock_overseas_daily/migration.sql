-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `stock_overseas_daily` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `excd` VARCHAR(4) NOT NULL,
    `symb` VARCHAR(16) NOT NULL,
    `xymd` CHAR(8) NOT NULL,
    `clos` VARCHAR(12) NOT NULL,
    `sign` CHAR(1) NULL,
    `diff` VARCHAR(12) NULL,
    `rate` VARCHAR(12) NULL,
    `open` VARCHAR(12) NOT NULL,
    `high` VARCHAR(12) NOT NULL,
    `low` VARCHAR(12) NOT NULL,
    `tvol` VARCHAR(14) NOT NULL,
    `tamt` VARCHAR(14) NOT NULL,
    `pbid` VARCHAR(12) NULL,
    `vbid` VARCHAR(10) NULL,
    `pask` VARCHAR(12) NULL,
    `vask` VARCHAR(10) NULL,
    `rsym` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_overseas_daily_excd_symb_xymd_key`(`excd`, `symb`, `xymd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
