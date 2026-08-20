#!/usr/bin/env node
// 阶段3 Task5「同城配送抽象网关」端到端验证
//
// 前置（dev server 运行中）：
//   - DeliveryGatewayPlugin 已注册（MockProvider code=mock）
//   - MySQL synchronize 自动建 DeliveryOrder 表
//
// 验证同城配送闭环（DeliveryProvider 抽象 + Mock 配送商 + DeliveryOrder 状态机）：
//   1) admin createDelivery(orderId=1, providerCode=mock, pickup/dropoff/items)
//      → 返回 DeliveryOrderAdmin：status=pending、fee>0
//   2) deliveryOrders(orderId) 查询确认能查到该单
//   3) 依次 mockDeliveryEvent: accepted → pickup → delivered，每步断言状态流转成功
//      且 deliveredAt 非空
//   4) 非法流转：对已 delivered 的单再发 accepted → 断言状态仍为 delivered（被忽略）
//   5) 再建一单并 mockDeliveryEvent cancelled → 断言 cancelledAt 与 reason 留痕
//
// 用法:
//   node tools/e2e-phase3-city.mjs                          # 默认 127.0.0.1:3000
//   node tools/e2e-phase3-city.mjs <shop-api> <admin-api>
// 退出码: 0=通过(含SKIP)  1=存在FAIL
const SHOP = process.argv[2] || "http://127.0.0.1:3000/shop-api";
const ADMIN = process.argv[3] || "http://127.0.0.1:3000/admin-api";

let passed = 0, failed = 0, skipped = 0;
function result(name, ok, detail) {
  const tag = ok === true ? "PASS" : ok === false ? "FAIL" : "SKIP";
  if (ok === true) passed++; else if (ok === false) failed++; else skipped++;
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`);
}

async function shopGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(SHOP, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({ http: res.status, raw: "parse-fail" }));
  const h = res.headers.get("vendure-auth-token");
  if (h && body.data) body.data.__sessionToken = h;
  if (body.errors) console.log("[shop-err]", body.errors.map(e => e.message).join(" | "));
  return body;
}
async function adminGql(query, variables = {}, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(ADMIN, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({ http: res.status, raw: "parse-fail" }));
  const h = res.headers.get("vendure-auth-token");
  if (h && body.data) body.data.__authToken = h;
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

const PICKUP = { name: "门店A(二道区)", address: "二道区测试门店", lat: 43.8502, lng: 125.4232, phone: "0431-10086" };
const DROPOFF = { name: "收货人", address: "朝阳区测试街道1号", lat: 43.8600, lng: 125.4332, phone: "13800000000" };
const ITEMS = [{ name: "矿泉水", quantity: 1 }];

async function createDelivery(token, { orderId = "1", packageId = "P1", remark = "同城配送验证" } = {}) {
  const r = await adminGql(
    `mutation($input: DeliveryCreateInput!){ createDelivery(input: $input){ id code orderId status fee providerCode thirdPartyNo } }`,
    {
      input: {
        orderId,
        packageId,
        providerCode: "mock",
        pickup: PICKUP,
        dropoff: DROPOFF,
        items: ITEMS,
        remark,
      },
    },
    token,
  );
  return r.data?.createDelivery;
}
async function deliveryOrders(token, orderId) {
  const r = await adminGql(
    `query($orderId: ID!){ deliveryOrders(orderId: $orderId){ id code orderId status fee providerCode acceptedAt pickupAt deliveredAt cancelledAt reason } }`,
    { orderId },
    token,
  );
  return r.data?.deliveryOrders || [];
}
async function mockEvent(token, deliveryOrderNo, status, extra = {}) {
  const r = await adminGql(
    `mutation($deliveryOrderNo: String!, $status: String!, $reason: String){ mockDeliveryEvent(deliveryOrderNo: $deliveryOrderNo, status: $status, reason: $reason) }`,
    { deliveryOrderNo, status, reason: extra.reason ?? null },
    token,
  );
  return r;
}

(async () => {
  console.log(`== 阶段3 同城配送网关 e2e == SHOP=${SHOP} ADMIN=${ADMIN}`);
  const adminToken = await adminLogin();
  if (!adminToken) { console.log("Admin 登录失败"); process.exit(1); }

  const ORDER_ID = "1";

  // ---- 1. 建单：createDelivery → pending + fee>0 ----
  const d1 = await createDelivery(adminToken, { orderId: ORDER_ID, packageId: "P1" });
  const t1 = !!d1 && d1.status === "pending" && Number(d1.fee) > 0 && d1.providerCode === "mock";
  result("t1.createDelivery 返回 pending 且 fee>0", t1, d1 ? `code=${d1.code} status=${d1.status} fee=${d1.fee} provider=${d1.providerCode}` : "返回为空");
  if (!d1?.code) { result("前置.拿到配送单号", false, "无 code，终止"); console.log(`\n== 结果: PASS=${passed} FAIL=${failed} SKIP=${skipped} ==`); process.exit(1); }
  const no1 = d1.code;

  // ---- 2. deliveryOrders(orderId) 能查到 ----
  const list1 = await deliveryOrders(adminToken, ORDER_ID);
  const t2 = list1.some(x => x.code === no1);
  result("t2.deliveryOrders 查到该单", t2, `共 ${list1.length} 条，含 ${no1}`);

  // ---- 3. 状态流转 accepted → pickup → delivered ----
  let t3a = null, t3b = null, t3c = null;
  // accepted
  await mockEvent(adminToken, no1, "accepted");
  const la = await deliveryOrders(adminToken, ORDER_ID);
  const da = la.find(x => x.code === no1);
  t3a = da?.status === "accepted" && !!da.acceptedAt;
  result("t3a.accepted 流转成功", t3a, da ? `status=${da.status} acceptedAt=${da.acceptedAt}` : "未查到");
  // pickup
  await mockEvent(adminToken, no1, "pickup");
  const lp = await deliveryOrders(adminToken, ORDER_ID);
  const dp = lp.find(x => x.code === no1);
  t3b = dp?.status === "pickup" && !!dp.pickupAt;
  result("t3b.pickup 流转成功", t3b, dp ? `status=${dp.status} pickupAt=${dp.pickupAt}` : "未查到");
  // delivered
  await mockEvent(adminToken, no1, "delivered");
  const ld = await deliveryOrders(adminToken, ORDER_ID);
  const dd = ld.find(x => x.code === no1);
  t3c = dd?.status === "delivered" && !!dd.deliveredAt;
  result("t3c.delivered 流转成功且 deliveredAt 非空", t3c, dd ? `status=${dd.status} deliveredAt=${dd.deliveredAt}` : "未查到");

  // ---- 4. 非法流转：delivered → accepted 被忽略 ----
  await mockEvent(adminToken, no1, "accepted");
  const li = await deliveryOrders(adminToken, ORDER_ID);
  const di = li.find(x => x.code === no1);
  const t4 = di?.status === "delivered";
  result("t4.delivered→accepted 非法流转被忽略", t4, di ? `status 仍=${di.status}` : "未查到");

  // ---- 5. 取消留痕：再建一单 → cancelled → cancelledAt + reason ----
  const d2 = await createDelivery(adminToken, { orderId: ORDER_ID, packageId: "P2", remark: "取消验证" });
  result("t5.再建一单", !!d2, d2 ? `code=${d2.code} status=${d2.status}` : "返回为空");
  if (d2?.code) {
    const r5 = await mockEvent(adminToken, d2.code, "cancelled", { reason: "顾客主动取消" });
    const lc = await deliveryOrders(adminToken, ORDER_ID);
    const dc = lc.find(x => x.code === d2.code);
    const t5 = !!dc && dc.status === "cancelled" && !!dc.cancelledAt && dc.reason === "顾客主动取消";
    result("t5.cancelled 留痕 cancelledAt+reason", t5, dc ? `status=${dc.status} cancelledAt=${dc.cancelledAt} reason=${dc.reason}` : `mockEvent errors=${JSON.stringify(r5.errors?.map(e => e.message))}`);
  } else {
    result("t5.cancelled 留痕 cancelledAt+reason", null, "建单失败，跳过");
  }

  console.log(`\n== 结果: PASS=${passed} FAIL=${failed} SKIP=${skipped} ==`);
  console.log("== 请到 dev server 日志核对: 同城配送 Provider 注册 / 配送单 TDS... -> accepted|pickup|delivered|cancelled ==");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
