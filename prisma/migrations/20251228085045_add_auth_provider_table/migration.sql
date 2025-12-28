/*
  Warnings:

  - You are about to drop the column `provider` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `User_provider_unique` ON `user`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `provider`,
    DROP COLUMN `provider_id`,
    ALTER COLUMN `updated_at` DROP DEFAULT,
    MODIFY `username` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `auth_provider` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `provider_user_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `AuthProvider_provider_idx`(`provider`),
    INDEX `AuthProvider_user_id_idx`(`user_id`),
    UNIQUE INDEX `AuthProvider_user_provider_unique`(`user_id`, `provider`),
    UNIQUE INDEX `AuthProvider_provider_user_unique`(`provider`, `provider_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_provider` ADD CONSTRAINT `auth_provider_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
