-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE FULLTEXT INDEX `post_title_content_idx` ON `post`(`title`, `content`);
