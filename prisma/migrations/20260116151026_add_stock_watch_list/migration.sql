-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `stock_watch_list` (
    `user_id` INTEGER NOT NULL,
    `exchange` VARCHAR(10) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_watch_list_user_id_sort_order_idx`(`user_id`, `sort_order`),
    PRIMARY KEY (`user_id`, `exchange`, `code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_watch_list` ADD CONSTRAINT `stock_watch_list_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
