#!/bin/bash
# =============================================================================
# T8 退款联动全链验证脚本（vendure 买单券资金流）
# =============================================================================
# 用法：scp 到服务器后 bash 执行（幂等可重跑，自清理同前缀残留）
#   scp scripts/verify-t8-refund.sh joho:/tmp/ && ssh joho "bash /tmp/verify-t8-refund.sh"
#
# 验证目标（refundSaleOrder commit 后 → onSaleOrderRefunded 联动）：
#   Case A：结算单 PENDING  → 退款 → CANCELLED（取消登记）
#   Case B：结算单 PAID_OUT → 退款 → REVERSED（stub 追偿，reversedAt 落值）
#
# 链路设计（真/假边界）：
#   [真] admin-api refundCouponSaleOrder（退款 API 全链：原子状态机 + 券作废 + 余额返还；
#        service 仅按 channelId 过滤无本人归属校验，admin 调用等价全真链路）
#   [真] admin-api runCouponSettlementCycle（补登 + T+1 提交 + 回执推进，stub 分账）
#   [假] 出售单/券实例/核销流水由 SQL 注入（跳过支付环节；核销流水注入 = 模拟
#        「先核销后退款的竞争窗口」——refundable 检查要求券非 USED，真实时序下
#        已核销券不可退，联动的触发面正是该窗口）
#
# 涉及表：coupon_sale_order / customer_coupon / in_store_bill /
#         coupon_settlement_order / coupon_settlement_reconcile_diff
# 残留标记：remark/remark='T8VFY'、code/couponCode 前缀 'T8VFY-'
# 已知无害残留：退款向测试号余额返还 1 分 ×2（recharge-card 余额流水，不留账面错误）
# =============================================================================
set -u
API=http://localhost:3020
T1=a6fn474hhiqasmyiyrfl                       # t1 渠道 token（admin/shop 均用 vendure-token 头切换渠道）
ADMIN_USER=superadmin
ADMIN_PASS=z123123
PG="docker exec -i 1Panel-postgresql-pIe0 psql -U youshaop -d vendure -v ON_ERROR_STOP=1"
TMP=/tmp/t8vfy
mkdir -p $TMP
FAILS=0

say()  { echo "[$(date +%H:%M:%S)] $*"; }
assert_eq() { if [ "$1" = "$2" ]; then say "PASS: $3"; else say "FAIL: $3 (got '$1' want '$2')"; FAILS=$((FAILS+1)); fi; }
sql() { $PG -tAc "$1" 2>/dev/null || echo "SQL_ERROR"; }
sqlf() { # 多行 SQL 落盘后经 stdin 管道喂容器内 psql（容器无宿主 /tmp 挂载，不能 -f 宿主路径）
  cat > $TMP/$1.sql; $PG < $TMP/$1.sql >/dev/null || { say "FAIL: sql $1"; cat $TMP/$1.sql >&2; FAILS=$((FAILS+1)); }
}
gq() { # gq <file.json> <port: admin> —— GraphQL POST，输出原始 JSON（$1 为含后缀完整文件名）
  local port=$2
  local tok=$ADMIN_TOKEN
  curl -s -X POST "$API/$port-api" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $tok" -H "vendure-token: $T1" --data-binary "@$TMP/$1"
}
login() { # login admin —— token 从响应头取
  local port=$1 user=$2 pass=$3
  curl -s -D $TMP/$port.hdr -o $TMP/$port.login.json -X POST "$API/$port-api" \
    -H 'Content-Type: application/json' -H "vendure-token: $T1" \
    -d "{\"query\":\"mutation { login(username: \\\"$user\\\", password: \\\"$pass\\\") { ...on CurrentUser { id } ...on ErrorResult { errorCode message } } }\"}"
  local tok=$(grep -i '^vendure-auth-token:' $TMP/$port.hdr | tr -d '\r' | awk '{print $2}')
  if [ "$port" = admin ]; then ADMIN_TOKEN=$tok; fi
  [ -n "$tok" ] && say "PASS: $port login" || { say "FAIL: $port login ($(head -c 200 $TMP/$port.login.json))"; FAILS=$((FAILS+1)); }
}

say "=== STEP 0: 登录（admin）==="
login admin "$ADMIN_USER" "$ADMIN_PASS"

say "=== STEP 1: 注入两笔测试数据（PAID 出售单 + UNUSED 券 + 昨日核销流水）==="
sqlf t8vfy_setup <<'SQL'
-- 幂等自清理（重跑安全）
DELETE FROM coupon_settlement_reconcile_diff WHERE "settlementNo" LIKE 'T8VFY-%';
DELETE FROM coupon_settlement_order WHERE "settlementNo" LIKE 'T8VFY-%';
DELETE FROM in_store_bill WHERE "couponCode" LIKE 'T8VFY-%';
DELETE FROM customer_coupon WHERE "code" LIKE 'T8VFY-%';
DELETE FROM coupon_sale_order WHERE "remark" LIKE 'T8VFY-%';
-- Case A / Case B：amount=1 分（退款返还余额无害化）
INSERT INTO coupon_sale_order ("customerId","payMode","templateId","amount","status","paymentMethod","paidAt","remark","channelId")
VALUES (150,'BALANCE',83,1,'PAID','balance',now(),'T8VFY-A',7),
       (150,'BALANCE',83,1,'PAID','balance',now(),'T8VFY-B',7);
INSERT INTO customer_coupon ("customerId","templateId","code","status","issuedBy","issuedAt","saleOrderId")
SELECT 150,83,'T8VFY-C-A','UNUSED','SALE',now(),"id" FROM coupon_sale_order WHERE "remark"='T8VFY-A';
INSERT INTO customer_coupon ("customerId","templateId","code","status","issuedBy","issuedAt","saleOrderId")
SELECT 150,83,'T8VFY-C-B','UNUSED','SALE',now(),"id" FROM coupon_sale_order WHERE "remark"='T8VFY-B';
INSERT INTO in_store_bill ("channelId","customerCouponId","couponCode","couponTemplateId","customerId","discountType","discountValue","originalAmount","discountAmount","finalAmount","operatorId","remark","billedAt")
SELECT 7, cc."id", cc."code", 83, 150, 'AMOUNT', 100, 1, 1, 0, 0, 'T8VFY', now() - interval '1 day'
FROM customer_coupon cc WHERE cc."code" LIKE 'T8VFY-%';
SQL
SA=$(sql "SELECT \"id\" FROM coupon_sale_order WHERE \"remark\"='T8VFY-A'")
SB=$(sql "SELECT \"id\" FROM coupon_sale_order WHERE \"remark\"='T8VFY-B'")
CA=$(sql "SELECT \"id\" FROM customer_coupon WHERE \"code\"='T8VFY-C-A'")
CB=$(sql "SELECT \"id\" FROM customer_coupon WHERE \"code\"='T8VFY-C-B'")
[ -n "$SA" ] && [ -n "$SB" ] && [ -n "$CA" ] && [ -n "$CB" ] && say "PASS: injected sale A=$SA B=$SB coupon A=$CA B=$CB" || { say "FAIL: injection"; exit 1; }

say "=== STEP 2: cycle1 —— backfill 补登 2 单 PENDING（不到期不提交）==="
echo '{"query":"mutation { runCouponSettlementCycle { submitted promoted failed } }"}' > $TMP/cycle.json
gq cycle.json admin
PENDING_N=$(sql "SELECT count(*) FROM coupon_settlement_order WHERE \"settlementNo\" IN ('CSTL-7-$CA','CSTL-7-$CB') AND \"status\"='PENDING'")
assert_eq "$PENDING_N" "2" "backfill 补登 2 单 PENDING"

say "=== STEP 3: Case A 退款（真实 admin-api refundCouponSaleOrder）→ 结算单 CANCELLED ==="
echo "{\"query\":\"mutation { refundCouponSaleOrder(id: \\\"$SA\\\", reason: \\\"T8VFY case A\\\") { id status } }\"}" > $TMP/refundA.json
gq refundA.json admin
REFUNDED_A=$(sql "SELECT \"status\" FROM coupon_sale_order WHERE \"id\"=$SA")
CANCELLED_A=$(sql "SELECT \"status\" FROM coupon_settlement_order WHERE \"customerCouponId\"=$CA")
assert_eq "$REFUNDED_A" "REFUNDED" "Case A 出售单 REFUNDED（退款 API 全链生效）"
assert_eq "$CANCELLED_A" "CANCELLED" "Case A 结算单 PENDING→CANCELLED（T8 取消登记分支）"

say "=== STEP 4: Case B 快进 —— cycle2 提交 SETTLED → cycle3 回执推进 PAID_OUT ==="
sqlf t8vfy_fastfwd <<SQL
UPDATE coupon_settlement_order SET "createdAt"=now()-interval '2 day', "updatedAt"=now()-interval '2 day'
WHERE "customerCouponId"=$CB;
SQL
gq cycle.json admin   # cycle2: submitted=1
gq cycle.json admin   # cycle3: promoted=1
SETTLED_B=$(sql "SELECT \"status\" FROM coupon_settlement_order WHERE \"customerCouponId\"=$CB")
assert_eq "$SETTLED_B" "PAID_OUT" "Case B 快进至 PAID_OUT（T+1 提交 + stub 回执推进）"

say "=== STEP 5: Case B 退款 → 结算单 REVERSED（stub 追偿）==="
echo "{\"query\":\"mutation { refundCouponSaleOrder(id: \\\"$SB\\\", reason: \\\"T8VFY case B\\\") { id status } }\"}" > $TMP/refundB.json
gq refundB.json admin
REVERSED_B=$(sql "SELECT \"status\" FROM coupon_settlement_order WHERE \"customerCouponId\"=$CB")
REV_AT=$(sql "SELECT \"reversedAt\" IS NOT NULL FROM coupon_settlement_order WHERE \"customerCouponId\"=$CB")
REV_REMARK=$(sql "SELECT \"remark\" FROM coupon_settlement_order WHERE \"customerCouponId\"=$CB")
assert_eq "$REVERSED_B" "REVERSED" "Case B 结算单 PAID_OUT→REVERSED（T8 追偿分支）"
assert_eq "$REV_AT" "t" "reversedAt 落值"
case "$REV_REMARK" in *"STUB-REV-"*) say "PASS: 追偿回执备注 ($REV_REMARK)";; *) say "FAIL: 追偿回执备注 got '$REV_REMARK'"; FAILS=$((FAILS+1));; esac

say "=== STEP 6: 清理 + 残留核验 ==="
sqlf t8vfy_cleanup <<'SQL'
DELETE FROM coupon_settlement_reconcile_diff WHERE "settlementNo" LIKE 'T8VFY-%';
DELETE FROM coupon_settlement_order WHERE "settlementNo" LIKE 'T8VFY-%';
DELETE FROM in_store_bill WHERE "couponCode" LIKE 'T8VFY-%';
DELETE FROM customer_coupon WHERE "code" LIKE 'T8VFY-%';
DELETE FROM coupon_sale_order WHERE "remark" LIKE 'T8VFY-%';
SQL
LEFT_N=$(sql "SELECT (SELECT count(*) FROM coupon_sale_order WHERE \"remark\" LIKE 'T8VFY-%') || '|' || (SELECT count(*) FROM customer_coupon WHERE \"code\" LIKE 'T8VFY-%') || '|' || (SELECT count(*) FROM in_store_bill WHERE \"couponCode\" LIKE 'T8VFY-%') || '|' || (SELECT count(*) FROM coupon_settlement_order WHERE \"settlementNo\" LIKE 'T8VFY-%')")
assert_eq "$LEFT_N" "0|0|0|0" "残留核验全零"

say "=========================================="
if [ $FAILS -eq 0 ]; then say "ALL PASS — T8 退款联动全链验证通过（A: PENDING→CANCELLED / B: PAID_OUT→REVERSED）"
else say "FAILED: $FAILS 项断言未过，检查上方 FAIL 行与 pm2 logs vendure 中的 'Settlement refund linkage' 日志"; fi
exit $FAILS
