-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `foreign_stock_master` (
    `ncod` CHAR(2) NOT NULL,
    `exid` CHAR(3) NOT NULL,
    `symb` VARCHAR(16) NOT NULL,
    `excd` CHAR(3) NOT NULL,
    `exnm` VARCHAR(16) NOT NULL,
    `rsym` VARCHAR(16) NOT NULL,
    `knam` VARCHAR(64) NOT NULL,
    `enam` VARCHAR(64) NOT NULL,
    `stis` CHAR(1) NOT NULL,
    `etyp` CHAR(3) NULL,
    `isdr` CHAR(1) NOT NULL,
    `icod` CHAR(4) NOT NULL,
    `sjong` CHAR(1) NOT NULL,

    PRIMARY KEY (`ncod`, `exid`, `symb`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
