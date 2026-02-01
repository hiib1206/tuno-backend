-- AddForeignKey
ALTER TABLE `ai_inference_history` ADD CONSTRAINT `ai_inference_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
