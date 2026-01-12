/*
  Warnings:

  - The primary key for the `domestic_financial_summary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `domestic_financial_summary` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- AlterTable
ALTER TABLE `domestic_financial_summary` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
