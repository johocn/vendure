/* e2e: COD 到店自提单 → 生成核销码(仅授权) → 防漏收(collect=false 拒) → claim(collect=true) → collected 持久化 → C端可读
 * 买主 split-e2e-a@joho.cn, 收银 zhao@163.com, 渠道 t1 */
const ADMIN = 'https://e.joho.cn/admin-api';
const SHOP = 'https://e.joho.cn/shop-api';
const BUYER = { email: 'split-e2e-a@joho.cn', password: 'Test#Split123' };
const CASHIER = { email: 'zhao@163.com', password: '23123' };
const CH = 'a6fn474hhiqasmyiyrfl'; // t1
const VARIANT_ID = 6; // SPK-BT-01 石墨黑（按既有脚本）
const SHIP_ID = 1; // store-pickup

async function gql(url, query, variables = {}, auth, ch) {
  const h = { 'Content-Type': 'application/json' };
  if (auth) h.Authorization = 'Bearer ' + auth;
  if (ch) h['vendure-token'] = ch;
  const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ query, variables }) });
  const j = await res.json();
  if (j.errors) {
    const e = new Error('GraphQL: ' + j.errors.map(x=>x.message).join('; '));
    e.data = j.data; throw e;
  }
  return j.data;
}
async function login(url, u, p, ch) {
  const r = await gql(url, `mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id identifier } ...on InvalidCredentialsError{ message } } }`, {u,p}, null, ch);
  const c = r.login;
  if (!c?.id) throw new Error('登录失败: ' + JSON.stringify(c));
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json', ...(ch?{'vendure-token':ch}:{})}, body: JSON.stringify({query:`mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ...on CurrentUser{ id identifier } } }`, variables:{u,p}}) });
  return { auth: res.headers.get('vendure-auth-token'), c };
}
(async () => {
  // A. 买家下 COD 自提单
  const shop = await login(SHOP, BUYER.email, BUYER.password, CH);
  console.log('[A] 买家登录:', shop.c.identifier);
  // 清空/重置遗留活跃订单（旧失败单可能卡在 ArrangingPayment）
  try {
    const ao = await gql(SHOP, `query{ activeOrder{ id state } }`, {}, shop.auth, CH);
    if (ao.activeOrder?.id) {
      if (ao.activeOrder.state === 'ArrangingPayment' || ao.activeOrder.state === 'Draft') {
        await gql(SHOP, `mutation{ transitionOrderToState(state:"AddingItems"){ ...on Order{ id state } ...on ErrorResult{ message } } }`, {}, shop.auth, CH).catch(()=>{});
      }
      await gql(SHOP, `mutation{ removeAllOrderLines{ ...on Order{ id } } }`, {}, shop.auth, CH).catch(()=>{});
      console.log('[A] 已重置遗留购物车: state=', ao.activeOrder.state);
    }
  } catch {}
  let r = await gql(SHOP, `mutation{ addItemToOrder(productVariantId:"${VARIANT_ID}",quantity:1){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
  if (r.addItemToOrder?.errorCode) throw new Error('加购失败:' + JSON.stringify(r.addItemToOrder));
  await gql(SHOP, `mutation{ setOrderCustomFields(input:{ customFields:{ deliveryType:"pickup" } }){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
  await gql(SHOP, `mutation{ setOrderShippingAddress(input:{ fullName:"自提测试" streetLine1:"门店自提地址" postalCode:"100000" city:"北京" countryCode:"CN" }){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
  const elig = await gql(SHOP, `query{ eligibleShippingMethods{ id code name } }`, {}, shop.auth, CH);
  if (!elig.eligibleShippingMethods.some(s=>Number(s.id)===SHIP_ID)) throw new Error('store-pickup 不可选: ' + elig.eligibleShippingMethods.map(s=>s.code).join(','));
  await gql(SHOP, `mutation{ setOrderShippingMethod(shippingMethodId:"${SHIP_ID}"){ ...on Order{ id } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
  let tr = await gql(SHOP, `mutation{ transitionOrderToState(state:"ArrangingPayment"){ ...on Order{ id state } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
  const orderId = tr.transitionOrderToState?.id;
  if (!orderId) throw new Error('转 ArrangingPayment 失败');
  // 探测可选支付方式
  const pm = await gql(SHOP, `query{ eligiblePaymentMethods{ id code name } }`, {}, shop.auth, CH);
  console.log('[A] 可选支付:', pm.eligiblePaymentMethods.map(p=>p.code).join(', '));
  // 用固定聚合码收款（到店收银）付款 → Authorized
  r = await gql(SHOP, `mutation{ addPaymentToOrder(input:{ method:"fixed-aggregate-collection" metadata:{ fixedAggregateCode:"POS-FILL-001" } }){ ...on Order{ id state totalWithTax } ...on ErrorResult{ errorCode message } } }`, {}, shop.auth, CH);
  if (r.addPaymentToOrder?.errorCode) throw new Error('到店收银付款失败:' + JSON.stringify(r.addPaymentToOrder));
  console.log('[A] COD付款后 state=', r.addPaymentToOrder.state, '应付分=', r.addPaymentToOrder.totalWithTax);

  // B. 取核销码（COD 仅 Authorized 也应生成码）
  const code = await gql(SHOP, `query{ myPickupCode(orderId:"${orderId}"){ id code status } }`, {}, shop.auth, CH);
  if (!code.myPickupCode?.code) throw new Error('COD单未生成核销码');
  console.log('[B] COD单核销码已生成:', code.myPickupCode.code, 'status=', code.myPickupCode.status);

  // C. 收银登录 + 备货 Shipped（到店自提：下单后店员备货，付款待提货当刻确认）
  const adm = await login(ADMIN, CASHIER.email, CASHIER.password, CH);
  console.log('[C] 收银登录:', adm.c.identifier);
  // 建履约(备货)并转 Shipped
  const od = await gql(ADMIN, `query{ order(id:"${orderId}"){ id state lines{ id quantity } } }`, {}, adm.auth, CH);
  const lines = od.order.lines.map(l=>`{ orderLineId:"${l.id}", quantity:${l.quantity} }`).join(' ');
  r = await gql(ADMIN, `mutation{ addFulfillmentToOrder(input:{ lines:[${lines}] handler:{ code:"manual-fulfillment" arguments:[ {name:"method",value:"到店自提"} {name:"trackingCode",value:"PICKUP"} ] } }){ ...on Fulfillment{ id state } ...on ErrorResult{ errorCode message } } }`, {}, adm.auth, CH);
  if (r.addFulfillmentToOrder?.errorCode) throw new Error('建履约失败:' + JSON.stringify(r.addFulfillmentToOrder));
  const fid = r.addFulfillmentToOrder.id;
  await gql(ADMIN, `mutation{ transitionFulfillmentToState(id:"${fid}", state:"Shipped"){ ...on Fulfillment{ state } } }`, {}, adm.auth, CH);
  console.log('[C] 已备货 Shipped');

  // C1: 不确认收款 → 应被拒
  let reject = false;
  try { await gql(ADMIN, `mutation{ claimPickupByShop(code:"${code.myPickupCode.code}", collect:false){ id } }`, {}, adm.auth, CH); }
  catch(e){ reject=true; console.log('[C1] collect=false 被拒（预期）:', e.message.split(';')[0]); }
  if (!reject) throw new Error('COD单 collect=false 未被拒，防漏收失效');
  // C2: 确认收款 → 应核销成功
  r = await gql(ADMIN, `mutation{ claimPickupByShop(code:"${code.myPickupCode.code}", collect:true){ id orderId orderCode code status paymentType collected claimedAt } }`, {}, adm.auth, CH);
  const claim = r.claimPickupByShop;
  console.log('[C2] claim(collect=true):', JSON.stringify(claim));
  if (claim.status !== 'redeemed' || claim.collected !== true) throw new Error('核销未判定为已收款');

  // D. C端回读 collected 字段
  r = await gql(SHOP, `query{ activeOrder{ id } }`, {}, shop.auth, CH);
  const o = await gql(SHOP, `query{ orderByCode(code:"${claim.orderCode}"){ id state code customFields{ deliveryType collected paymentType } payments{ method state } } }`, {}, shop.auth, CH);
  const oc = o.orderByCode;
  console.log('[D] C端订单收款状态: collected=', oc.customFields?.collected, 'paymentType=', oc.customFields?.paymentType, 'state=', oc.state, 'payMethod=', oc.payments?.[0]?.method);
  console.log('\n===== 结论 =====');
  console.log(JSON.stringify({
    orderId, orderCode: claim.orderCode, redemptionCode: code.myPickupCode.code,
    status: claim.status, collected: oc.customFields?.collected, paymentType: oc.customFields?.paymentType,
    antiLeak: reject===true,
  }, null, 2));
})().catch(e=>{ console.error('run error:', e.message); if(e.data) console.error('data=', JSON.stringify(e.data)); process.exit(2); });