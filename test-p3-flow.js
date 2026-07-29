const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };

let stepCounter = 0;
const results = [];
function log(msg) { console.log(`[Step ${++stepCounter}] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); results.push({ ok: true, msg }); }
function fail(msg, err) { console.error(`  ✗ ${msg}`); if (err) console.error('    ', err?.message ?? err); results.push({ ok: false, msg, err: err?.message ?? String(err) }); }

async function gql(query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(ADMIN_API, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const body = await res.json();
    if (body.errors) { const err = new Error(body.errors.map(e => e.message).join('; ')); err.body = body; throw err; }
    const headerToken = res.headers.get('vendure-auth-token');
    if (headerToken) body.data.__authToken = headerToken;
    return body.data;
}

async function login(username, password) {
    const data = await gql(`mutation Login($u: String!, $p: String!) { login(username: $u, password: $p) { ... on CurrentUser { identifier } ... on InvalidCredentialsError { message } } }`, { u: username, p: password });
    if (!data.__authToken) throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== 运营 P3 会员管理 + 消息群发 E2E 验收 ===\n');

    const adminToken = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
    log('超管登录'); ok('admin token acquired');

    // 1. 权限验证
    log('验证 operations-staff 权限');
    const rolesData = await gql(`query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { permissions } } }`, {}, adminToken);
    const perms = rolesData.roles.items[0].permissions;
    if (perms.includes('ManageMember')) ok('ManageMember 已同步'); else fail('ManageMember 缺失（需重启 dev-server）');
    if (perms.includes('ManageMessage')) ok('ManageMessage 已同步'); else fail('ManageMessage 缺失（需重启 dev-server）');

    // 2. 等级配置读取
    log('等级配置读取');
    const lc = await gql(`query { levelConfig { level1Threshold level1Name level2Threshold level2Name pointsEarnRatio pointsEarnOnShipping } }`, {}, adminToken);
    ok(`LV1: ${lc.levelConfig.level1Name} (${lc.levelConfig.level1Threshold}), ratio=${lc.levelConfig.pointsEarnRatio}`);

    // 3. 等级配置更新
    log('等级配置更新');
    const updated = await gql(`mutation UpdateLevelConfig($input: UpdateLevelConfigInput!) { updateLevelConfig(input: $input) { level1Name level2Threshold } }`, { input: { level1Name: '测试普通', level2Threshold: 1200 } }, adminToken);
    ok(`更新后: LV1=${updated.updateLevelConfig.level1Name}, LV2阈值=${updated.updateLevelConfig.level2Threshold}`);

    // 恢复
    await gql(`mutation UpdateLevelConfig($input: UpdateLevelConfigInput!) { updateLevelConfig(input: $input) { level1Name } }`, { input: { level1Name: '普通会员', level2Threshold: 1000 } }, adminToken);

    // 4. 会员列表
    log('会员列表查询');
    const members = await gql(`query Members($options: JSON) { members(options: $options) { items { customerId emailAddress level levelName points growthValue } totalItems } }`, { options: { take: 10 } }, adminToken);
    ok(`会员总数: ${members.members.totalItems}`);
    if (members.members.items.length > 0) {
        const firstMember = members.members.items[0];
        ok(`第一个会员: ${firstMember.emailAddress}, LV${firstMember.level} ${firstMember.levelName}`);
        const testCustomerId = firstMember.customerId;

        // 5. 会员详情
        log('会员详情查询');
        const info = await gql(`query MemberInfo($id: ID!) { memberInfo(customerId: $id) { customerId level levelName growthValue points nextLevelThreshold nextLevelName } }`, { id: testCustomerId }, adminToken);
        ok(`详情: LV${info.memberInfo.level} ${info.memberInfo.levelName}, 积分=${info.memberInfo.points}`);

        // 6. 调整积分
        log('调整积分');
        try {
            const beforePoints = info.memberInfo.points;
            const adj = await gql(`mutation AdjustPoints($id: ID!, $amount: Int!, $remark: String) { adjustPoints(customerId: $id, amount: $amount, remark: $remark) { points } }`, { id: testCustomerId, amount: 100, remark: 'E2E测试' }, adminToken);
            ok(`积分: ${beforePoints} -> ${adj.adjustPoints.points} (+100)`);
            // 回滚
            await gql(`mutation AdjustPoints($id: ID!, $amount: Int!, $remark: String) { adjustPoints(customerId: $id, amount: $amount, remark: $remark) { points } }`, { id: testCustomerId, amount: -100, remark: 'E2E回滚' }, adminToken);
        } catch (e) { fail('调整积分失败（现有代码事务问题）', e); }

        // 7. 调整成长值
        log('调整成长值');
        try {
            const adjG = await gql(`mutation AdjustGrowth($id: ID!, $amount: Int!, $source: String) { adjustMemberGrowth(customerId: $id, amount: $amount, source: $source) { growthValue } }`, { id: testCustomerId, amount: 500, source: 'E2E测试' }, adminToken);
            ok(`成长值调整为: ${adjG.adjustMemberGrowth.growthValue}`);
        } catch (e) { fail('调整成长值失败（现有代码事务问题）', e); }

        // 8. 积分历史
        log('积分历史查询');
        try {
            const hist = await gql(`query PointsHistory($id: ID!, $options: PointsHistoryListOptions) { pointsHistory(customerId: $id, options: $options) { items { type amount remark createdAt } totalItems } }`, { id: testCustomerId, options: { take: 5 } }, adminToken);
            ok(`历史记录数: ${hist.pointsHistory.totalItems}`);
        } catch (e) { fail('积分历史查询失败', e); }
    }

    // 9. 消息 CRUD
    log('消息 CRUD - 创建');
    let messageId;
    try {
        const created = await gql(`mutation CreateMessage($input: CreateMessageInput!) { createMessage(input: $input) { id title status } }`, { input: { title: 'E2E测试消息', body: '测试正文', deliveryChannel: 'inapp', audienceType: 'all' } }, adminToken);
        messageId = created.createMessage.id;
        ok(`消息创建: id=${messageId}, status=${created.createMessage.status}`);
    } catch (e) { fail('消息创建失败', e); throw e; }

    log('消息 CRUD - 查询');
    const msgDetail = await gql(`query Message($id: ID!) { message(id: $id) { id title body deliveryChannel audienceType status } }`, { id: messageId }, adminToken);
    ok(`消息查询: title=${msgDetail.message.title}`);

    log('消息 CRUD - 更新');
    const msgUpdated = await gql(`mutation UpdateMessage($id: ID!, $input: UpdateMessageInput!) { updateMessage(id: $id, input: $input) { title } }`, { id: messageId, input: { title: 'E2E测试消息-改' } }, adminToken);
    ok(`消息更新: title=${msgUpdated.updateMessage.title}`);

    // 10. 消息发送
    log('消息发送流程');
    try {
        const sent = await gql(`mutation SendMessage($id: ID!) { sendMessage(id: $id) { id status totalTarget } }`, { id: messageId }, adminToken);
        ok(`发送触发: status=${sent.sendMessage.status}, target=${sent.sendMessage.totalTarget}`);

        // 等待 JobQueue 处理
        await new Promise(r => setTimeout(r, 3000));

        const stats = await gql(`query Stats($id: ID!) { messageDeliveryStats(id: $id) { totalTarget totalSent totalFailed totalRead } }`, { id: messageId }, adminToken);
        ok(`投递统计: target=${stats.messageDeliveryStats.totalTarget}, sent=${stats.messageDeliveryStats.totalSent}, failed=${stats.messageDeliveryStats.totalFailed}`);
    } catch (e) { fail('消息发送失败', e); }

    // 清理
    log('数据清理');
    try { await gql(`mutation DeleteMessage($id: ID!) { deleteMessage(id: $id) }`, { id: messageId }, adminToken); ok('消息已删除'); } catch (e) { fail('消息删除失败', e); }

    console.log('\n=== Results: ' + results.filter(r => r.ok).length + ' passed, ' + results.filter(r => !r.ok).length + ' failed ===');
    if (results.some(r => !r.ok)) process.exit(1);
}

main().catch(e => { console.error('验收失败:', e.message); process.exit(1); });
