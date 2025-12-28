/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `media` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `media_url_key` ON `media`(`url`);
