-- DropIndex
DROP INDEX `media_url_key` ON `media`;

-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;
