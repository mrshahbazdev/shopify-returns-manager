-- AlterTable
ALTER TABLE `ExchangeRequest` ADD COLUMN `carrier` VARCHAR(191) NULL,
    ADD COLUMN `exchangeOrderId` VARCHAR(191) NULL,
    ADD COLUMN `receivedDate` DATETIME(3) NULL,
    ADD COLUMN `rmaNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `shipDate` DATETIME(3) NULL,
    ADD COLUMN `trackingNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ReturnRequest` ADD COLUMN `carrier` VARCHAR(191) NULL,
    ADD COLUMN `exchangeOrderId` VARCHAR(191) NULL,
    ADD COLUMN `receivedDate` DATETIME(3) NULL,
    ADD COLUMN `refundError` VARCHAR(191) NULL,
    ADD COLUMN `refundStatus` ENUM('PENDING', 'ISSUED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `rmaNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `shipDate` DATETIME(3) NULL,
    ADD COLUMN `trackingNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ShopSettings` ADD COLUMN `autoApproveEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `autoRejectReasons` VARCHAR(191) NULL,
    ADD COLUMN `emailFrom` VARCHAR(191) NULL,
    ADD COLUMN `emailProvider` VARCHAR(191) NULL DEFAULT 'none',
    ADD COLUMN `shippingLabelProvider` VARCHAR(191) NULL DEFAULT 'none',
    ADD COLUMN `smsFrom` VARCHAR(191) NULL,
    ADD COLUMN `smsProvider` VARCHAR(191) NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE `ShippingLabel` (
    `id` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NULL,
    `exchangeRequestId` VARCHAR(191) NULL,
    `carrier` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NULL,
    `trackingNumber` VARCHAR(191) NOT NULL,
    `labelUrl` VARCHAR(191) NULL,
    `cost` DECIMAL(65, 30) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'created',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationLog` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL', 'SMS') NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `error` VARCHAR(191) NULL,
    `event` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NULL,
    `exchangeRequestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL', 'SMS') NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationTemplate_shop_event_channel_key`(`shop`, `event`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ExchangeRequest_shop_rmaNumber_key` ON `ExchangeRequest`(`shop`, `rmaNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `ReturnRequest_shop_rmaNumber_key` ON `ReturnRequest`(`shop`, `rmaNumber`);

-- AddForeignKey
ALTER TABLE `ShippingLabel` ADD CONSTRAINT `ShippingLabel_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `ReturnRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingLabel` ADD CONSTRAINT `ShippingLabel_exchangeRequestId_fkey` FOREIGN KEY (`exchangeRequestId`) REFERENCES `ExchangeRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `ReturnRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_exchangeRequestId_fkey` FOREIGN KEY (`exchangeRequestId`) REFERENCES `ExchangeRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

