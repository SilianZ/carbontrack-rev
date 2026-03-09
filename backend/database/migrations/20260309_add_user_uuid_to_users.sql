ALTER TABLE `users`
    ADD COLUMN `uuid` CHAR(36) NULL DEFAULT NULL AFTER `id`;

UPDATE `users`
SET `uuid` = LOWER(CONCAT(
    SUBSTR(MD5(CONCAT('carbontrack-user-', `id`)), 1, 8), '-',
    SUBSTR(MD5(CONCAT('carbontrack-user-', `id`)), 9, 4), '-',
    '4', SUBSTR(MD5(CONCAT('carbontrack-user-', `id`)), 14, 3), '-',
    '8', SUBSTR(MD5(CONCAT('carbontrack-user-', `id`)), 18, 3), '-',
    SUBSTR(MD5(CONCAT('carbontrack-user-', `id`)), 21, 12)
))
WHERE `uuid` IS NULL OR `uuid` = '';

ALTER TABLE `users`
    ADD UNIQUE KEY `idx_users_uuid_unique` (`uuid`);

ALTER TABLE `users`
    MODIFY `uuid` CHAR(36) NOT NULL;
