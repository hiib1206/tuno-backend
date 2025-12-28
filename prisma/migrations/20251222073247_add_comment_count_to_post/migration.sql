-- AlterTable
ALTER TABLE `post` ADD COLUMN `comment_count` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
