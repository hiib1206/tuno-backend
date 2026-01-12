/*
  Warnings:

  - You are about to drop the column `pbr` on the `domestic_financial_summary` table. All the data in the column will be lost.
  - You are about to drop the column `per` on the `domestic_financial_summary` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `domestic_financial_summary` DROP COLUMN `pbr`,
    DROP COLUMN `per`;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
