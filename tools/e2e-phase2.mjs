#!/usr/bin/env node
// 阶段2「就近履约」端到端验证（读取向，缺数据则 SKIP 不报错）
// 验证设计文档「本地电商就近履约-阶段2设计.md」第九节四个闭环：
//   1) variant   : variantNearbyStock 逐仓库存 + 距离升序 + 服务城市过滤
//   2) ledger    : 订单发货 → stockLedger(order:out) 可按单号追溯
//   3) afterSales: 售后退货 Received/Refunded → stockLedger(afterSales:in) 库存回补
//   4) move      : 移库 Completed → stockLedger(stockMove) 成对流水（out+in 互指）
//   5) pickup    : 自提订单 → pickupClaimed 核销状态盘点（信息性）
//
// 用法:
//   node tools/e2e-phase2.mjs                       # 全部检查
//   node tools/e2e-phase2.mjs --check variant       # 只跑某项
//   node tools/e2e-phase2.mjs http://127.0.0.1:13020/shop-api http://127.0.0.1:13020/admin-api
// 退出码: 0=全部通过(含SKIP)  1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";
const CHANNEL_TOKEN = "shop-a-token";
const COORDS = { lat: 43.8256, lng: 125.3235 }; // 默认长春坐标（与测试门店一致）

const only = (() => {
  const i = process.argv.indexOf("--check");
  return i >= 0 ? process.argv[i + 1] : null;
})();

let passed = 0, failed = 0, skipped = 0;

function result(name, ok, detail) {
  const tag = ok === true ? "PASS" : ok === false ? "FAIL" : "SKIP";
  if (ok === true) passed++; else if (ok === false) failed++; else skipped++;
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`);
}

// ---- GraphQL helpers ----
async function shopGql(query, variables = {}) {
  const res = await fetch(SHOP, {
    method: "POST",
    headers: { "Content-Type": "application/json", "vendure-channel-token": CHANNEL_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({ http: res.status }));
  if (body.errors) console.log("[shop-err]", body.errors.map(e => e.message).join(" | "));
  return body;
}
async function adminGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(ADMIN, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({ http: res.status }));
  const h = res.headers.get("vendure-auth-token");
  if (h && body.data) body.data.__authToken = h;
  if (body.errors) console.log("[admin-err]", body.errors.map(e => e.message).join(" | "));
  return body;
}
async function adminLogin() {
  const attempts = [
    ["superadmin", "superadmin"],
    ["superadmin@china.test", "superadmin"],
    ["superadmin", "admin123"],
    ["superadmin@china.test", "admin123"],
  ];
  for (const [u, p] of attempts) {
    const r = await adminGql(`mutation{login(username:"${u}",password:"${p}"){... on CurrentUser{identifier}... on InvalidCredentialsError{message}}}`);
    if (r.data?.__authToken) return r.data.__authToken;
  }
  return null;
}

// ---- 检查1: variantNearbyStock 逐仓库存 + 距离排序 + 城市过滤 ----
async function checkVariantNearbyStock() {
  const list = await shopGql(`query($opts: ProductListOptions){ products(options:$opts){ totalItems items { id name variants { id sku name } } } }`, { opts: { take: 50 } });
  const items = list.data?.products?.items || [];
  const product = items[0];
  if (!product) return result("variant.variantNearbyStock 基础查询", null, "无商品数据");
  const variantId = product.variants?.[0]?.id;
  const r = await shopGql(
    `query($pid: ID!, $vid: ID, $lat: Float, $lng: Float, $city: String){
       variantNearbyStock(productId: $pid, variantId: $vid, lat: $lat, lng: $lng, city: $city){
         distanceKm location { id name lat lng serviceCities } variants { variantId sku stockOnHand stockAllocated stockAvailable } } }`,
    { pid: product.id, vid: variantId, lat: COORDS.lat, lng: COORDS.lng, city: "长春市" },
  );
  const rows = r.data?.variantNearbyStock;
  if (!rows) return result("variant.逐仓查询", null, "查询无返回（Shop API 可能未部署）");
  const ok = rows.length > 0 && rows.every(x => x.location?.id && Array.isArray(x.variants) && x.variants.length > 0);
  result("variant.逐仓库存+距离", ok, ok ? `${rows.length} 个仓库, 首个距 ${rows[0].distanceKm}km` : JSON.stringify(rows).slice(0, 200));
  const sorted = rows.every((x, i) => i === 0 || (rows[i - 1].distanceKm ?? 1e9) <= (x.distanceKm ?? 1e9));
  result("variant.距离升序", sorted, sorted ? "" : "存在乱序");
  const calcOk = rows.every(x => x.variants.every(v => v.stockAvailable === v.stockOnHand - v.stockAllocated));
  result("variant.可售口径(onHand-allocated)", calcOk, "");
  // 服务城市过滤：指定 city=长春市 时，非服务该城市的仓应被剔除（除非 serviceCities 为空）
  const nonServing = rows.filter(x => Array.isArray(x.location.serviceCities) && x.location.serviceCities.length > 0 && !x.location.serviceCities.includes("长春市"));
  result("variant.服务城市过滤", nonServing.length === 0, nonServing.length ? `仍有 ${nonServing.length} 个不服务城市仓` : "");
}

// ---- 检查2: 订单发货 → ledger order:out ----
async function checkOrderLedger(token) {
  const q = await adminGql(`query($opts: OrderListOptions){ orders(options:$opts){ totalItems items { id code state } } }`, { opts: { take: 50, sort: { createdAt: 'DESC' } } }, token);
  const orders = q.data?.orders?.items || [];
  let checked = 0;
  for (const o of orders) {
    const l = await adminGql(`query($bc: String){ stockLedger(bizCode: $bc, pageSize: 20){ totalItems items { code bizType direction quantity stockLocationId reason createdAt } } }`, { bc: o.code }, token);
    const entries = l.data?.stockLedger?.items || [];
    if (!entries.length) continue;
    checked++;
    const out = entries.find(e => e.bizType === "order" && e.direction === "out");
    result(`ledger.${o.code}`, !!out, out ? `direction=out qty=${out.quantity} @loc#${out.stockLocationId}` : "有账本但无 order:out");
  }
  if (!checked) result("ledger.订单→账本", null, "近期订单均无账本流水（未发货订单可忽略）");
}

// ---- 检查3: 售后退货 → ledger afterSales:in（bizCode 格式为 AS<id>） ----
async function checkAfterSalesLedger(token) {
  // Admin 类型为 AfterSalesRequestAdmin（无 code 字段）；账本 bizCode 由 service 写为 `AS${id}`
  const q = await adminGql(`query { afterSalesRequests { totalItems items { id state receivedQuantity orderLineId } } }`, {}, token);
  const reqs = q.data?.afterSalesRequests?.items || [];
  const received = reqs.filter(x => ["Received", "Refunded"].includes(x.state));
  if (!received.length) return result("afterSales.回补账本", null, `无已收货/已退款的售后单（共 ${reqs.length} 单）`);
  let okAll = true;
  for (const rq of received) {
    const l = await adminGql(`query($bc: String){ stockLedger(bizCode: $bc, pageSize: 20){ totalItems items { code bizType direction quantity stockLocationId reason } } }`, { bc: `AS${rq.id}` }, token);
    const entries = l.data?.stockLedger?.items || [];
    const back = entries.find(e => e.bizType === "afterSales" && e.direction === "in");
    const ok = !!back;
    if (!ok) okAll = false;
    result(`afterSales.AS${rq.id}(${rq.state})`, ok, back ? `afterSales:in qty=${back.quantity} @loc#${back.stockLocationId} reason=${back.reason}` : "未找到回补流水");
  }
  result("afterSales.回补闭环", okAll, okAll ? `${received.length} 单均回补` : "");
}

// ---- 检查4: 移库 Completed → ledger stockMove 成对 ----
async function checkStockMoveLedger(token) {
  const q = await adminGql(`query($state: String){ stockMoveOrders(state: $state, pageSize: 50){ totalItems items { id code state sourceLocationId targetLocationId } } }`, { state: "Completed" }, token);
  const moves = q.data?.stockMoveOrders?.items || [];
  if (!moves.length) return result("move.移库账本", null, "无 Completed 移库单");
  let okAll = true;
  for (const m of moves) {
    const l = await adminGql(`query($bc: String){ stockLedger(bizCode: $bc, pageSize: 50){ totalItems items { code bizType direction quantity stockLocationId otherLocationId } } }`, { bc: m.code }, token);
    const entries = l.data?.stockLedger?.items || [];
    const outs = entries.filter(e => e.bizType === "stockMove" && e.direction === "out");
    const ins = entries.filter(e => e.bizType === "stockMove" && e.direction === "in");
    const paired = outs.length > 0 && ins.length > 0;
    if (!paired) okAll = false;
    result(`move.${m.code}`, paired, paired ? `out=${outs.length}条 in=${ins.length}条 (src#${m.sourceLocationId}→dst#${m.targetLocationId})` : `out=${outs.length} in=${ins.length} 未成对`);
  }
  result("move.移库账本成对", okAll, okAll ? "" : "");
}

// ---- 检查5: 自提订单 pickupClaimed 状态盘点（信息性） ----
async function checkPickup(token) {
  const q = await adminGql(`query { orders(options:{ take: 200 }){ totalItems items { id code state customFields { deliveryType pickupClaimed } } } }`, {}, token);
  const orders = q.data?.orders?.items || [];
  const pickups = orders.filter(o => o.customFields?.deliveryType === "pickup");
  if (!pickups.length) return result("pickup.自提订单", null, "无自提订单");
  const claimed = pickups.filter(o => o.customFields?.pickupClaimed === true);
  result("pickup.自提核销状态", pickups.length > 0, `${pickups.length} 单自提，已核销 ${claimed.length} 单`);
}

(async () => {
  console.log(`== 阶段2 就近履约验证 == SHOP=${SHOP}`);
  console.log(`    ADMIN=${ADMIN}`);
  const token = await adminLogin();
  if (!token) { console.log("Admin 登录失败（尝试 superadmin/superadmin 等）"); process.exit(1); }

  if (!only || only === "variant") await checkVariantNearbyStock();
  if (!only || only === "ledger") await checkOrderLedger(token);
  if (!only || only === "afterSales") await checkAfterSalesLedger(token);
  if (!only || only === "move") await checkStockMoveLedger(token);
  if (!only || only === "pickup") await checkPickup(token);

  console.log(`\n== 结果: PASS=${passed} FAIL=${failed} SKIP=${skipped} ==`);
  process.exit(failed ? 1 : 0);
})();
