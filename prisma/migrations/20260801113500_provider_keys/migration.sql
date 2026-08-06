-- AlterTable
ALTER TABLE `ShopSettings` ADD COLUMN `easypostApiKey` VARCHAR(191) NULL,
    ADD COLUMN `resendApiKey` VARCHAR(191) NULL,
    ADD COLUMN `sendgridApiKey` VARCHAR(191) NULL,
    ADD COLUMN `shippoApiKey` VARCHAR(191) NULL,
    ADD COLUMN `twilioAccountSid` VARCHAR(191) NULL,
    ADD COLUMN `twilioAuthToken` VARCHAR(191) NULL,
    ADD COLUMN `twilioPhoneNumber` VARCHAR(191) NULL;

