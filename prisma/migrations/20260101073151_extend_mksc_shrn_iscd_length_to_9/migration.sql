/*
  Warnings:

  - The primary key for the `krx_stock_master` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `krx_stock_master` DROP PRIMARY KEY,
    MODIFY `mksc_shrn_iscd` CHAR(9) NOT NULL,
    ADD PRIMARY KEY (`market_code`, `mksc_shrn_iscd`);

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
