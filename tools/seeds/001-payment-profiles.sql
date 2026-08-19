-- dbtool 种子示例：幂等插入支付档案（若 code 已存在则跳过）
-- 通过 dbtool_seed_log 表保证整个脚本只执行一次；
-- 这里额外用 WHERE NOT EXISTS 提供双保险，避免重复数据。

INSERT INTO payment_profile ("createdAt", "updatedAt", name, description, code, "isGlobal", "ownerChannelId")
SELECT now(), now(), '蛋糕货到付款', '蛋糕类商品货到付款', 'cake-cod-profile', false, 1
WHERE NOT EXISTS (SELECT 1 FROM payment_profile WHERE code = 'cake-cod-profile');

INSERT INTO payment_profile ("createdAt", "updatedAt", name, description, code, "isGlobal", "ownerChannelId")
SELECT now(), now(), '蔬果在线支付', '蔬菜水果在线微信支付', 'veg-wechatpay-profile', false, 1
WHERE NOT EXISTS (SELECT 1 FROM payment_profile WHERE code = 'veg-wechatpay-profile');