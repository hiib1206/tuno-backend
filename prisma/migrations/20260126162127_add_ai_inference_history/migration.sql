-- AlterTable
ALTER TABLE `user` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `ai_inference_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `model_type` ENUM('SNAPBACK') NOT NULL,
    `model_version` VARCHAR(20) NULL,
    `request_params` JSON NOT NULL,
    `response_data` JSON NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `latency_ms` INTEGER NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `ai_inference_history_user_id_model_type_requested_at_idx`(`user_id`, `model_type`, `requested_at` DESC),
    INDEX `ai_inference_history_model_type_requested_at_idx`(`model_type`, `requested_at` DESC),
    INDEX `ai_inference_history_status_model_type_idx`(`status`, `model_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_inference_history` ADD CONSTRAINT `ai_inference_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
