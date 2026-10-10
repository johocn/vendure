import path from 'node:path';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import {
  configureDefaultOrderProcess,
  DefaultLogger,
  LogLevel,
} from '@vendure/core';
import gql from 'graphql-tag';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { VcashPosPlugin } from '../src/plugin';
// 引用 member-level-plugin 编译产物（避免 @vendure/core 双实例加载冲突）
import { MemberLevelPlugin } from '../../../../vendure/packages/member-level-plugin/lib/index';

// 绝对路径：相对 '__data__' 会落在 cwd（包根）而非 e2e/，陈旧库会导致 populateInitialData 被跳过
registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

const posOrderProcess = configureDefaultOrderProcess({
  arrangingPaymentRequiresCustomer: false,
  arrangingPaymentRequiresShipping: false,
});

// ===== GraphQL Operations =====

const GET_PRODUCTS = gql`
  query GetProducts {
    products {
      items {
        id
        name
        variants { id sku name price }
      }
    }
  }
`;

const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($input: CreateCustomerInput!, $password: String) {
    createCustomer(input: $input, password: $password) {
      ... on Customer { id emailAddress }
    }
  }
`;

const ADJUST_GROWTH = gql`
  mutation AdjustGrowth($customerId: ID!, $amount: Int!, $source: String) {
    adjustMemberGrowth(customerId: $customerId, amount: $amount, source: $source) {
      customerId level levelName growthValue points
    }
  }
`;

const SAVE_TIERS = gql`
  mutation SaveTiers($input: [MemberTierInput!]!) {
    saveTiers(input: $input) {
      id tierLevel threshold name
    }
  }
`;

const CREATE_MEMBER_PRICE_RULE = gql`
  mutation CreateMemberPriceRule($input: CreateMemberPriceRuleInput!) {
    createMemberPriceRule(input: $input) {
      id scope categoryId memberLevel discountPercent active priority
    }
  }
`;

const MY_MEMBER_PRICE = gql`
  query MyMemberPrice($productIds: [ID!]!) {
    myMemberPrice(productIds: $productIds) {
      productId
      applied
      discountPercent
    }
  }
`;

describe('C 端 myMemberPrice 会员价展示查询', () => {
  const { server, adminClient, shopClient } = createTestEnvironment({
    ...testConfig,
    logger: new DefaultLogger({ level: LogLevel.Error }),
    orderOptions: { process: [posOrderProcess] },
    plugins: [
      MemberLevelPlugin.init({
        defaultPointsEarnRatio: 1,
        defaultPointsEarnOnShipping: false,
      }),
      VcashPosPlugin,
    ],
  });

  const LV2_EMAIL = 'member-price-shop-lv2@test.com';
  const LV1_EMAIL = 'member-price-shop-lv1@test.com';
  let productIds: string[];

  beforeAll(async () => {
    await server.init({
      initialData: {
        defaultLanguage: 'en',
        defaultZone: 'Asia',
        roles: [],
        countries: [{ code: 'CN', name: '中国', zone: 'Asia' }],
        taxRates: [{ name: 'standard', percentage: 0 }],
        shippingMethods: [],
        paymentMethods: [],
        collections: [],
      },
      productsCsvPath: path.join(
        __dirname,
        '../../core/e2e/fixtures/e2e-products-full.csv',
      ),
    });
    await adminClient.asSuperAdmin();

    // 播种会员档位：2 档（阈值 1000），growthValue 1500 → memberLevel = 2
    await adminClient.query(SAVE_TIERS, {
      input: [
        { tierLevel: 1, threshold: 0, name: '普通会员' },
        { tierLevel: 2, threshold: 1000, name: '银卡会员' },
      ],
    });

    const productsRes = await adminClient.query(GET_PRODUCTS);
    const items = productsRes.products.items;
    expect(items.length).toBeGreaterThan(0);
    productIds = items.map((i: any) => i.id);

    // LV2 会员（带登录账号：createCustomer 传 password 即立即验证建号）
    const lv2 = await adminClient.query(CREATE_CUSTOMER, {
      input: {
        firstName: '银卡',
        lastName: '会员',
        emailAddress: LV2_EMAIL,
        phoneNumber: '13800138002',
      },
      password: 'test',
    });
    await adminClient.query(ADJUST_GROWTH, {
      customerId: lv2.createCustomer.id,
      amount: 1500,
      source: 'test',
    });

    // LV1 会员（未调成长值，memberLevel 默认 1）
    await adminClient.query(CREATE_CUSTOMER, {
      input: {
        firstName: '普通',
        lastName: '会员',
        emailAddress: LV1_EMAIL,
        phoneNumber: '13800138003',
      },
      password: 'test',
    });

    // 播种 LV2 全局 95 折规则（LV1 无规则 → 未命中）
    await adminClient.query(CREATE_MEMBER_PRICE_RULE, {
      input: { scope: 'global', memberLevel: 2, discountPercent: 95 },
    });
  }, 180000);

  afterAll(async () => {
    await server.destroy();
  });

  it('未登录返回空数组', async () => {
    const res = await shopClient.query(MY_MEMBER_PRICE, { productIds: [productIds[0]] });
    expect(res.myMemberPrice).toEqual([]);
  });

  it('LV2 会员命中 global 规则：applied=true, discountPercent=95', async () => {
    await shopClient.asUserWithCredentials(LV2_EMAIL, 'test');
    const res = await shopClient.query(MY_MEMBER_PRICE, {
      productIds: [productIds[0], '999999'],
    });
    expect(res.myMemberPrice.length).toBe(2);
    const hit = res.myMemberPrice.find((r: any) => r.productId === productIds[0]);
    expect(hit.applied).toBe(true);
    expect(hit.discountPercent).toBe(95);
  });

  it('不存在的商品 id 返回 applied=false', async () => {
    await shopClient.asUserWithCredentials(LV2_EMAIL, 'test');
    const res = await shopClient.query(MY_MEMBER_PRICE, { productIds: ['999999'] });
    expect(res.myMemberPrice[0].applied).toBe(false);
    expect(res.myMemberPrice[0].discountPercent).toBeNull();
  });

  it('LV1 会员无规则未命中：applied=false, discountPercent=null', async () => {
    await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
    const res = await shopClient.query(MY_MEMBER_PRICE, { productIds: [productIds[0]] });
    expect(res.myMemberPrice[0].applied).toBe(false);
    expect(res.myMemberPrice[0].discountPercent).toBeNull();
  });
});
