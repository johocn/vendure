import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    createTestEnvironment,
    registerInitializer,
    SqljsInitializer,
    testConfig,
} from '@vendure/testing';
import { mergeConfig, TransactionalConnection } from '@vendure/core';
import path from 'path';
import gql from 'graphql-tag';

import { CampusJianghuPlugin } from '../src/index';
import { initialData } from '../../../e2e-common/e2e-initial-data';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

const ADMIN_API = '/admin-api';

describe('CampusJianghuPlugin · 运营后台 admin-api 真实链路', () => {
    const config = mergeConfig(testConfig, {
        // 插件 requireCustomer 读取 customer.customFields.riderStatus，e2e 需定义这些自定义字段
        customFields: {
            Customer: [
                { name: 'riderStatus', type: 'string', nullable: true },
                { name: 'jianghuNickname', type: 'string', nullable: true },
                { name: 'riderCampus', type: 'string', nullable: true },
                { name: 'riderCredit', type: 'int', nullable: true },
            ],
        },
        plugins: [CampusJianghuPlugin],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);
    let port = 0;
    let connection!: TransactionalConnection;
    const ds = () => connection.rawConnection;

    const JH_CREATE_EVENT = gql`
        mutation jianghuCreateEvent($input: JianghuEventInput!) {
            jianghuCreateEvent(input: $input) {
                id name total collected rewardPoolRep
            }
        }`;
    const JH_AUDIT_CLUE = gql`
        mutation jianghuAuditClue($id: ID!, $approve: Boolean!) {
            jianghuAuditClue(id: $id, approve: $approve) {
                id eventId nickname content status
            }
        }`;
    const CREATE_ROLE = gql`
        mutation ($input: CreateRoleInput!) { createRole(input: $input) { id code } }`;
    const CREATE_ADMIN = gql`
        mutation ($input: CreateAdministratorInput!) { createAdministrator(input: $input) { id } }`;
    const JH_CREATE_EVENT_STR = `mutation jianghuCreateEvent($input: JianghuEventInput!) {
        jianghuCreateEvent(input: $input) { id }
    }`;
    const CREATE_CUSTOMER = gql`
        mutation ($input: CreateCustomerInput!, $password: String) {
            createCustomer(input: $input, password: $password) {
                ... on Customer { id }
            }
        }`;
    const UPDATE_CUSTOMER = gql`
        mutation ($input: UpdateCustomerInput!) {
            updateCustomer(input: $input) {
                ... on Customer { id customFields { riderStatus } }
            }
        }`;
    const JH_COLLECT_CLUE = gql`
        mutation jianghuCollectClue($input: ClueInput!) {
            jianghuCollectClue(input: $input) {
                id collected total
                clues { id content status }
                myClues { id status }
            }
        }`;
    const JH_LIST_CLUES = gql`
        query jianghuListClues($status: String) {
            jianghuListClues(status: $status) { id eventId content status nickname }
        }`;

    beforeAll(async () => {
        await server.init({ initialData });
        await adminClient.asSuperAdmin();
        port = (server.app.getHttpServer().address() as any).port;
        connection = server.app.get(TransactionalConnection);
    }, 120_000);

    afterAll(async () => {
        await server.destroy();
    });

    const adminUrl = () => `http://localhost:${port}${ADMIN_API}`;

    async function anonQuery(query: string, variables: any) {
        const res = await fetch(adminUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables }),
        });
        return (await res.json()) as any;
    }

    it('① 匿名调用 jianghuCreateEvent 被权限门禁拒绝', async () => {
        const res = await anonQuery(JH_CREATE_EVENT_STR, { input: { name: 'x', desc: 'y' } });
        expect(res.errors).toBeTruthy();
    });

    it('② 创建「江湖运营」角色并授予 CampusJianghu 权限', async () => {
        const res = await adminClient.query(CREATE_ROLE, {
            input: { code: 'JianghuOps', description: '江湖运营', permissions: ['CampusJianghu'] },
        });
        expect(res.errors).toBeFalsy();
        expect(res.createRole?.id).toBeTruthy();
    });

    it('③ 创建运营管理员 jh-ops 并绑定该角色', async () => {
        const roles = await adminClient.query(gql`
            query { roles { items { id code } } }
        `) as any;
        const roleId = roles.roles.items.find((r: any) => r.code === 'JianghuOps').id;
        const res = await adminClient.query(CREATE_ADMIN, {
            input: {
                firstName: 'jh',
                lastName: 'ops',
                emailAddress: 'jh-ops@test.com',
                password: 'jh-ops-123',
                roleIds: [roleId],
            },
        });
        expect(res.errors).toBeFalsy();
        expect(res.createAdministrator?.id).toBeTruthy();
    });

    it('④ 运营 Bearer token 调 jianghuCreateEvent 成功发布事件', async () => {
        await adminClient.asUserWithCredentials('jh-ops@test.com', 'jh-ops-123');
        const res = await adminClient.query(JH_CREATE_EVENT, {
            input: { name: '联调测试事件', desc: 'mock desc', total: 3, rewardPoolRep: 300 },
        });
        expect(res.errors).toBeFalsy();
        expect(res.jianghuCreateEvent?.id).toBeTruthy();
    });

    it('④b 玩家提交线索进入 PENDING：不上墙、不计数；运营审核通过才 SHOWN+1', async () => {
        // 造一个已认证传信者（riderStatus=APPROVED）
        // createCustomer 需高权限，先切回 superadmin；审核前再切回 jh-ops（运营角色）
        await adminClient.asSuperAdmin();
        const email = 'clue-submitter@test.com';
        const created = (await adminClient.query(CREATE_CUSTOMER, {
            input: { emailAddress: email, firstName: '线索', lastName: '侠' },
            password: 'clue-123',
        })) as any;
        const custId = created.createCustomer.id;
        await adminClient.query(UPDATE_CUSTOMER, {
            input: { id: custId, customFields: { riderStatus: 'APPROVED' } },
        });
        await adminClient.asUserWithCredentials('jh-ops@test.com', 'jh-ops-123');
        await shopClient.asUserWithCredentials(email, 'clue-123');

        const before = (await ds().query('SELECT collected FROM jianghu_event'))[0].collected;
        const res = (await shopClient.query(JH_COLLECT_CLUE, {
            input: { content: '待审线索内容', sourceNote: '待审来源' },
        })) as any;

        // 公共线索墙仅含 SHOWN（不含刚提交的 PENDING）
        expect(res.jianghuCollectClue.clues.every((c: any) => c.status === 'SHOWN')).toBe(true);
        // 进度未变
        const after = (await ds().query('SELECT collected FROM jianghu_event'))[0].collected;
        expect(after).toBe(before);
        // 库中存在一条 PENDING 线索
        const pending = (await ds().query("SELECT id, status FROM jianghu_clue WHERE content = '待审线索内容'"))[0];
        expect(pending.status).toBe('PENDING');

        // 运营审核通过
        const aud = await adminClient.query(JH_AUDIT_CLUE, { id: pending.id, approve: true });
        expect(aud.jianghuAuditClue.status).toBe('SHOWN');
        const finalCollected = (await ds().query('SELECT collected FROM jianghu_event'))[0].collected;
        expect(finalCollected).toBe(before + 1);
    });

    it('⑤ jianghuAuditClue(approve=true) 保持 SHOWN 且 collected 不变', async () => {
        const rawEventId = (await ds().query('SELECT id FROM jianghu_event'))[0].id;
        await ds().query('UPDATE jianghu_event SET collected = 1 WHERE id = ?', [rawEventId]);
        const clueRepo = ds().getRepository('JianghuClue');
        const clue = await clueRepo.save(
            clueRepo.create({
                eventId: String(rawEventId),
                customerId: '1',
                nickname: '测试传信者',
                content: '食堂三楼新菜单',
                sourceNote: '图书馆公告栏',
                campusCode: 'C1',
                status: 'SHOWN',
                likes: 0,
            } as any),
        );
        const res = await adminClient.query(JH_AUDIT_CLUE, { id: clue.id, approve: true });
        expect(res.errors).toBeFalsy();
        expect(res.jianghuAuditClue.status).toBe('SHOWN');
        const collected = (await ds().query('SELECT collected FROM jianghu_event WHERE id = ?', [rawEventId]))[0].collected;
        expect(collected).toBe(1);
    });

    it('⑥ jianghuAuditClue(approve=false) 下线 REJECTED 且 collected 回滚为 0', async () => {
        const rawEventId = (await ds().query('SELECT id FROM jianghu_event'))[0].id;
        await ds().query('UPDATE jianghu_event SET collected = 1 WHERE id = ?', [rawEventId]);
        const clueRepo = ds().getRepository('JianghuClue');
        const clue = await clueRepo.save(
            clueRepo.create({
                eventId: String(rawEventId),
                customerId: '2',
                nickname: '测试传信者2',
                content: '另一条线索',
                sourceNote: '食堂公告',
                campusCode: 'C1',
                status: 'SHOWN',
                likes: 0,
            } as any),
        );
        const res = await adminClient.query(JH_AUDIT_CLUE, { id: clue.id, approve: false });
        expect(res.errors).toBeFalsy();
        expect(res.jianghuAuditClue.status).toBe('REJECTED');
        const collected = (await ds().query('SELECT collected FROM jianghu_event WHERE id = ?', [rawEventId]))[0].collected;
        expect(collected).toBe(0);
    });

    it('⑧ 运营 jianghuListClues 仅返回当前事件线索且含 PENDING（审核 UI 数据通路）', async () => {
        // 以玩家再提交一条待审线索（perPersonLimit=2，当前仅提交过 1 条，仍可提交）
        await shopClient.asUserWithCredentials('clue-submitter@test.com', 'clue-123');
        await shopClient.query(JH_COLLECT_CLUE, {
            input: { content: '审核列表可见的待审线索', sourceNote: '列表来源' },
        });
        // 运营拉取待审列表（admin 专属，按 eventCurrent 过滤），应能看到这条
        await adminClient.asUserWithCredentials('jh-ops@test.com', 'jh-ops-123');
        const res = (await adminClient.query(JH_LIST_CLUES, { status: 'PENDING' })) as any;
        expect(res.errors).toBeFalsy();
        expect(res.jianghuListClues.some((c: any) => c.content === '审核列表可见的待审线索')).toBe(true);
        // 全部列表也包含它
        const all = (await adminClient.query(JH_LIST_CLUES, {})) as any;
        expect(all.jianghuListClues.some((c: any) => c.content === '审核列表可见的待审线索')).toBe(true);
    });

    const JH_EVENT_CONTENT = gql`
        query jianghuEventContent {
            jianghuEventContent { title desc bannerImage rewardText active }
        }`;

    it('⑦ jianghuEventContent 未配置/不可达时优雅返回 null（前端回退内联文案）', async () => {
        // 默认未配置 Strapi 文案源 → null
        let res = (await shopClient.query(JH_EVENT_CONTENT)) as any;
        expect(res.errors).toBeFalsy();
        expect(res.jianghuEventContent).toBeNull();

        // 配置了不可达的 Strapi 源（127.0.0.1:9 无服务）→ 仍优雅返回 null，不抛错、不阻断玩法
        CampusJianghuPlugin.init({ contentApi: { baseUrl: 'http://127.0.0.1:9/api' } });
        res = (await shopClient.query(JH_EVENT_CONTENT)) as any;
        expect(res.errors).toBeFalsy();
        expect(res.jianghuEventContent).toBeNull();
    });
});
