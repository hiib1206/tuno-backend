-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `pw` VARCHAR(255) NOT NULL,
    `nick` VARCHAR(30) NOT NULL,
    `address` VARCHAR(255) NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `is_active` ENUM('Y', 'N') NOT NULL DEFAULT 'Y',

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_nick_key`(`nick`),
    INDEX `User_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
