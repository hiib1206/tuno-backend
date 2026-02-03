-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `stock_comment` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ticker` VARCHAR(9) NOT NULL,
    `exchange` VARCHAR(4) NOT NULL,
    `content` TEXT NOT NULL,
    `opinion` ENUM('BUY', 'SELL', 'NEUTRAL') NOT NULL,
    `author_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `stock_comment_ticker_deleted_at_created_at_idx`(`ticker`, `deleted_at`, `created_at`),
    INDEX `stock_comment_author_id_deleted_at_created_at_idx`(`author_id`, `deleted_at`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_comment` ADD CONSTRAINT `stock_comment_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
