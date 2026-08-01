-- AlterTable
ALTER TABLE `ReturnRequest` ADD COLUMN `restockingFee` DECIMAL(65, 30) NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ShopSettings` ADD COLUMN `autoApproveThreshold` DECIMAL(65, 30) NULL DEFAULT 0,
    ADD COLUMN `restockingFeePercent` DECIMAL(65, 30) NULL DEFAULT 0,
    ADD COLUMN `returnReasons` VARCHAR(191) NULL DEFAULT 'Wrong size,Defective,Not as described,Changed mind,Other';
