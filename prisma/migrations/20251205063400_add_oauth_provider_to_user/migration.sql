/*
  Warnings:

  - A unique constraint covering the columns `[provider,provider_id]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `provider` VARCHAR(30) NULL,
    ADD COLUMN `provider_id` VARCHAR(255) NULL,
    MODIFY `pw` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_provider_unique` ON `user`(`provider`, `provider_id`);
