// 阶段38 电商直播服务 集成实测（MVP 冒烟）
// 流程: admin 登录 → 建直播间(scheduled) → 开播(start → live) → shop 进房(enter wsTicket) → shop 列表可见(liveRooms)
//       收尾: admin deleteLiveRoom 删除测试直播间
// 前置: dev-server 已运行（postgres）; 注: 此脚本不实际连接 live-ws-server，仅验证 SDK 返回的 wsUrl/wsTicket
// Usage: node tools/e2e-live-stream.mjs
const { default: fetch } = await import('node-fetch');
const { execSync } = await import('node:child_process');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';
const ROOM_NAME = `E2E 带货直播间 ${Date.now()}`;

async function call(endpoint, query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    const authToken = res.headers.get('vendure-auth-token');
    if (body.errors && !body.data) {
        throw Object.assign(new Error(body.errors.map(e => e.message).join('; ')), { body });
    }
    return { data: body.data, authToken, body };
}
const adminGql = (q, v = {}, t = '') => call(ADMIN_API, q, v, t);
const shopGql = (q, v = {}, t = '') => call(SHOP_API, q, v, t);

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

async function main() {
    // 预清理上次残留测试数据（幂等）
    try { execSync('node tools/clean-live-stream.mjs --commit', { stdio: 'inherit', cwd: process.cwd() }); }
    catch (_) { /* 清理失败不阻断主流程 */ }

    console.log('=== 阶段38 电商直播服务 集成实测 ===\n');

    // 1. admin 登录
    const login = await adminGql(`mutation Login($u:String!,$p:String!){ login(username:$u,password:$p){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { u: 'superadmin@china.test', p: 'superadmin' });
    const adminToken = login.authToken;
    assert(adminToken, '后台 superadmin 登录成功');
    if (!adminToken) process.exit(1);

    // 2. 建直播间（初始状态 scheduled）
    const created = await adminGql(`mutation($i:CreateLiveRoomInput!){ createLiveRoom(input:$i){ id name status playUrl } }`, { i: { name: ROOM_NAME, type: 'product', scheduledStartAt: '2026-08-22T08:00:00Z' } }, adminToken);
    const roomId = created.data?.createLiveRoom?.id;
    assert(roomId, `创建直播间成功（roomId=${roomId}）`);
    assert(created.data?.createLiveRoom?.status === 'scheduled', `初始状态 scheduled（实际=${created.data?.createLiveRoom?.status}）`);
    if (!roomId) process.exit(1);

    // 3. 开播 → 生成拉流地址
    const started = await adminGql(`mutation($id:ID!){ startLiveRoom(id:$id){ status playUrl pushUrl } }`, { id: roomId }, adminToken);
    assert(started.data?.startLiveRoom?.status === 'live', `开播后状态 live（实际=${started.data?.startLiveRoom?.status}）`);
    assert(!!started.data?.startLiveRoom?.playUrl, `开播后生成 playUrl（${started.data?.startLiveRoom?.playUrl}）`);

    // 4. shop 进房 → wsTicket / wsUrl
    const enter = await shopGql(`mutation($rid:ID!){ enterLiveRoom(roomId:$rid){ roomId playUrl pushUrl wsUrl wsTicket } }`, { rid: roomId });
    assert(!!enter.data?.enterLiveRoom?.wsTicket, '进房返回 wsTicket');
    assert(!!enter.data?.enterLiveRoom?.wsUrl, `进房返回 wsUrl（${enter.data?.enterLiveRoom?.wsUrl}）`);
    assert(!!enter.data?.enterLiveRoom?.playUrl, '进房返回可播放 playUrl');

    // 5. shop 直播中列表可见
    const list = await shopGql(`query($s:String){ liveRooms(status:$s){ id name status } }`, { s: 'live' });
    assert(list.data?.liveRooms?.some(r => r.id === roomId), '直播中列表包含该房间');

    // 6. 收尾：删除测试直播间
    const del = await adminGql(`mutation($id:ID!){ deleteLiveRoom(id:$id) }`, { id: roomId }, adminToken);
    assert(del.data?.deleteLiveRoom === true, `收尾删除直播间（deleteLiveRoom=${del.data?.deleteLiveRoom}）`);

    console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('ERROR:', e.message); console.error(e.body); process.exit(1); });