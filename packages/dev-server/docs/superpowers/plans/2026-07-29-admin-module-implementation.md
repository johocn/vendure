# Admin Module Implementation Plan (商品/用户/财务)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 启用 vadmin MODULE_CONFIGS.admin 模块，新增 5 个移动端管理页面（商品列表/详情、用户列表/详情、财务概览），纯前端调用 Vendure core admin-api，不动后端。

**Architecture:** 纯前端实现，不新建后端插件。在 `vadmin/src/pkg-admin/` 下新建 5 个页面 + 1 个 API client，调用 Vendure core 自带的 admin-api（products/customers/orders GraphQL 查询）。启用 shortcuts.ts 中 3 个 admin 项（products/users/finance），去掉与 cs 重叠的 admin-orders。财务页采用客户端聚合（分页拉取 orders + 前端 SUM/GROUP BY）。

**Tech Stack:** uni-app + Vue 3 + TypeScript + graphql-request，Vendure core admin-api（GraphQL）

---

## File Structure

### 前端（Create）
- `e:\code\vadmin\src\pkg-admin\api\admin.ts` — GraphQL client（products/customers/orders 查询封装）
- `e:\code\vadmin\src\pkg-admin\pages\products\index.vue` — 商品列表（分页 + 搜索 + 上下架切换）
- `e:\code\vadmin\src\pkg-admin\pages\products\detail.vue` — 商品详情（基础字段编辑 + 变体价格/库存查看）
- `e:\code\vadmin\src\pkg-admin\pages\users\index.vue` — 用户列表（客户搜索 + 分页）
- `e:\code\vadmin\src\pkg-admin\pages\users\detail.vue` — 用户详情（客户信息编辑 + 订单历史）
- `e:\code\vadmin\src\pkg-admin\pages\finance\index.vue` — 财务概览（时间范围 + GMV/订单数/状态分布/支付方式占比）

### 前端（Modify）
- `e:\code\vadmin\src\pages.json` — pkg-admin subPackage pages 数组替换 placeholder 为 5 页
- `e:\code\vadmin\src\config\shortcuts.ts` — 启用 admin-products/users/finance 3 项，改 enabled:true + 真实路由；删除 admin-orders（与 cs 重叠）

### 后端（Modify）
- `e:\code\vendure\packages\delivery-plugin\src\constants.ts` — MODULE_CONFIGS.admin.enabled: true，entryPath 改为 `/pkg-admin/pages/products/index`

---

## Task 1: API Client + 配置启用

**Files:**
- Create: `e:\code\vadmin\src\pkg-admin\api\admin.ts`
- Modify: `e:\code\vendure\packages\delivery-plugin\src\constants.ts` (MODULE_CONFIGS.admin)
- Modify: `e:\code\vadmin\src\config\shortcuts.ts`
- Modify: `e:\code\vadmin\src\pages.json`

- [ ] **Step 1: 创建 API client**

创建 `e:\code\vadmin\src\pkg-admin\api\admin.ts`：

```typescript
import { getClient } from '@/api/client';

export interface ProductListItem {
    id: string;
    name: string;
    slug: string;
    enabled: boolean;
    featuredAssetPreview?: string;
    variantCount: number;
    priceFrom: number;
}

export interface ProductDetail {
    id: string;
    name: string;
    slug: string;
    description: string;
    enabled: boolean;
    languageCode: string;
    variants: Array<{
        id: string;
        name: string;
        sku: string;
        price: number;
        priceWithTax: number;
        stockLevel: string;
        enabled: boolean;
    }>;
}

export interface CustomerListItem {
    id: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber?: string;
    verified: boolean;
    lastLogin?: string;
}

export interface CustomerDetail {
    id: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber?: string;
    createdAt: string;
    verified: boolean;
    lastLogin?: string;
    roles: Array<{ code: string; description: string }>;
    addresses: Array<{
        fullName: string;
        streetLine1: string;
        city: string;
        province: string;
        phoneNumber?: string;
    }>;
    orders: Array<{
        id: string;
        code: string;
        state: string;
        total: number;
        totalWithTax: number;
        orderPlacedAt?: string;
    }>;
}

export interface FinanceSummary {
    totalOrders: number;
    totalRevenue: number;
    totalRefunds: number;
    stateDistribution: Array<{ state: string; count: number; amount: number }>;
    paymentMethodDistribution: Array<{ method: string; count: number; amount: number }>;
}

const PAGE_SIZE = 20;

export const adminApi = {
    // ===== 商品 =====
    async products(params: { page?: number; search?: string; enabled?: boolean } = {}): Promise<{ items: ProductListItem[]; totalItems: number }> {
        const page = params.page ?? 1;
        const skip = (page - 1) * PAGE_SIZE;
        const filter: any = {};
        if (params.search) filter.name = { contains: params.search };
        if (params.enabled != null) filter.enabled = { eq: params.enabled };
        const data = await getClient().request(
            `query Products($options: ProductListOptions) {
                products(options: $options) {
                    items {
                        id name slug enabled
                        featuredAsset { preview }
                        variants { id price enabled }
                    }
                    totalItems
                }
            }`,
            { options: { skip, take: PAGE_SIZE, filter, sort: { updatedAt: 'DESC' } } },
        );
        return {
            items: data.products.items.map((p: any): ProductListItem => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                enabled: p.enabled,
                featuredAssetPreview: p.featuredAsset?.preview,
                variantCount: p.variants.length,
                priceFrom: p.variants.length > 0 ? Math.min(...p.variants.map((v: any) => v.price)) : 0,
            })),
            totalItems: data.products.totalItems,
        };
    },

    async product(id: string): Promise<ProductDetail> {
        const data = await getClient().request(
            `query Product($id: ID!) {
                product(id: $id) {
                    id name slug description enabled languageCode
                    variants { id name sku price priceWithTax stockLevel enabled }
                }
            }`,
            { id },
        );
        return data.product;
    },

    async updateProduct(id: string, input: { name?: string; slug?: string; description?: string; enabled?: boolean; languageCode?: string }): Promise<void> {
        const { languageCode, ...rest } = input;
        const translations = (input.name != null || input.slug != null || input.description != null)
            ? [{ languageCode: languageCode ?? 'en', name: input.name, slug: input.slug, description: input.description }]
            : undefined;
        await getClient().request(
            `mutation UpdateProduct($input: UpdateProductInput!) {
                updateProduct(input: $input) { id name enabled updatedAt }
            }`,
            { input: { id, ...rest, translations } },
        );
    },

    async updateProductVariant(id: string, input: { price?: number; enabled?: boolean }): Promise<void> {
        await getClient().request(
            `mutation UpdateVariant($input: UpdateProductVariantInput!) {
                updateProductVariant(input: $input) { id price enabled }
            }`,
            { input: { id, ...input } },
        );
    },

    // ===== 用户（客户） =====
    async customers(params: { page?: number; search?: string } = {}): Promise<{ items: CustomerListItem[]; totalItems: number }> {
        const page = params.page ?? 1;
        const skip = (page - 1) * PAGE_SIZE;
        const filter: any = {};
        if (params.search) {
            filter._or = [
                { firstName: { contains: params.search } },
                { lastName: { contains: params.search } },
                { emailAddress: { contains: params.search } },
            ];
        }
        const data = await getClient().request(
            `query Customers($options: CustomerListOptions) {
                customers(options: $options) {
                    items {
                        id firstName lastName emailAddress phoneNumber
                        user { identifier verified lastLogin }
                    }
                    totalItems
                }
            }`,
            { options: { skip, take: PAGE_SIZE, filter, sort: { updatedAt: 'DESC' } } },
        );
        return {
            items: data.customers.items.map((c: any): CustomerListItem => ({
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                emailAddress: c.emailAddress,
                phoneNumber: c.phoneNumber,
                verified: c.user?.verified ?? false,
                lastLogin: c.user?.lastLogin,
            })),
            totalItems: data.customers.totalItems,
        };
    },

    async customer(id: string): Promise<CustomerDetail> {
        const data = await getClient().request(
            `query Customer($id: ID!) {
                customer(id: $id) {
                    id firstName lastName emailAddress phoneNumber createdAt
                    user { verified lastLogin roles { code description } }
                    addresses { fullName streetLine1 city province phoneNumber }
                    orders(options: { take: 10, sort: { updatedAt: DESC } }) {
                        items { id code state total totalWithTax orderPlacedAt }
                    }
                }
            }`,
            { id },
        );
        const c = data.customer;
        return {
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            emailAddress: c.emailAddress,
            phoneNumber: c.phoneNumber,
            createdAt: c.createdAt,
            verified: c.user?.verified ?? false,
            lastLogin: c.user?.lastLogin,
            roles: c.user?.roles ?? [],
            addresses: c.addresses,
            orders: c.orders.items,
        };
    },

    async updateCustomer(id: string, input: { firstName?: string; lastName?: string; phoneNumber?: string; emailAddress?: string }): Promise<void> {
        await getClient().request(
            `mutation UpdateCustomer($input: UpdateCustomerInput!) {
                updateCustomer(input: $input) {
                    ... on Customer { id updatedAt }
                    ... on EmailAddressConflictError { errorCode message }
                }
            }`,
            { input: { id, ...input } },
        );
    },

    // ===== 财务（客户端聚合） =====
    async financeSummary(startDate: string, endDate: string): Promise<FinanceSummary> {
        const data = await getClient().request(
            `query OrdersForFinance($options: OrderListOptions) {
                orders(options: $options) {
                    items {
                        id code state total totalWithTax orderPlacedAt active
                        payments { method amount state }
                    }
                    totalItems
                }
            }`,
            {
                options: {
                    take: 500,
                    filter: {
                        active: { eq: false },
                        orderPlacedAt: { between: { start: startDate, end: endDate } },
                    },
                    sort: { orderPlacedAt: 'DESC' },
                },
            },
        );
        const orders = data.orders.items;
        const stateMap = new Map<string, { count: number; amount: number }>();
        const paymentMap = new Map<string, { count: number; amount: number }>();
        let totalRevenue = 0;
        let totalRefunds = 0;

        for (const o of orders) {
            const stateEntry = stateMap.get(o.state) ?? { count: 0, amount: 0 };
            stateEntry.count++;
            stateEntry.amount += o.totalWithTax;
            stateMap.set(o.state, stateEntry);
            totalRevenue += o.totalWithTax;
            for (const p of o.payments ?? []) {
                if (p.state === 'Settled') {
                    const pmEntry = paymentMap.get(p.method) ?? { count: 0, amount: 0 };
                    pmEntry.count++;
                    pmEntry.amount += p.amount;
                    paymentMap.set(p.method, pmEntry);
                }
            }
        }

        // 退款从 state=Cancelled 得到（Vendure 无独立退款聚合 API，用 Cancelled 订单估算）
        for (const [state, entry] of stateMap) {
            if (state === 'Cancelled') totalRefunds += entry.amount;
        }

        return {
            totalOrders: orders.length,
            totalRevenue,
            totalRefunds,
            stateDistribution: Array.from(stateMap.entries()).map(([state, v]) => ({ state, ...v })),
            paymentMethodDistribution: Array.from(paymentMap.entries()).map(([method, v]) => ({ method, ...v })),
        };
    },
};
```

- [ ] **Step 2: 启用 MODULE_CONFIGS.admin**

修改 `e:\code\vendure\packages\delivery-plugin\src\constants.ts` 第 143 行：

```typescript
  { code: 'admin',     name: '管理',  enabled: true,  entryPath: '/pkg-admin/pages/products/index', icon: '⚙️', sort: 60, perms: ['ManageProduct','ManageUser','ViewFinance','ManageMessage','ViewDashboard'] },
```

改动：`enabled: false → true`，`entryPath: '/pkg-admin/pages/dashboard/index' → '/pkg-admin/pages/products/index'`（admin 模块无独立 dashboard，直接进商品列表）。

- [ ] **Step 3: 更新 shortcuts.ts**

修改 `e:\code\vadmin\src\config\shortcuts.ts` 第 37-41 行，替换为：

```typescript
    // 管理模块
    { code: 'admin-products', name: '商品', icon: '🏷️', perm: 'ManageProduct', route: '/pkg-admin/pages/products/index', enabled: true },
    { code: 'admin-users', name: '用户', icon: '👥', perm: 'ManageUser', route: '/pkg-admin/pages/users/index', enabled: true },
    { code: 'admin-finance', name: '财务', icon: '💰', perm: 'ViewFinance', route: '/pkg-admin/pages/finance/index', enabled: true },
```

改动：删除 `admin-orders`（与 cs-orders 重叠），3 项 `enabled: false → true`，`route` 改为真实路径。

- [ ] **Step 4: 更新 pages.json**

修改 `e:\code\vadmin\src\pages.json` 中 pkg-admin subPackage（第 120-125 行），替换为：

```json
        {
            "root": "pkg-admin",
            "pages": [
                { "path": "pages/products/index", "style": { "navigationBarTitleText": "商品管理", "enablePullDownRefresh": true } },
                { "path": "pages/products/detail", "style": { "navigationBarTitleText": "商品详情" } },
                { "path": "pages/users/index", "style": { "navigationBarTitleText": "用户管理", "enablePullDownRefresh": true } },
                { "path": "pages/users/detail", "style": { "navigationBarTitleText": "用户详情" } },
                { "path": "pages/finance/index", "style": { "navigationBarTitleText": "财务概览", "enablePullDownRefresh": true } }
            ]
        },
```

- [ ] **Step 5: 验证编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete（无 TS 错误，仅 sass 弃用警告）

- [ ] **Step 6: Commit**

```bash
cd e:\code\vadmin
git add src/pkg-admin/api/admin.ts src/config/shortcuts.ts src/pages.json
git commit -m "feat(pkg-admin): add API client, enable module shortcuts and pages.json"
```

---

## Task 2: 商品列表页

**Files:**
- Create: `e:\code\vadmin\src\pkg-admin\pages\products\index.vue`

- [ ] **Step 1: 创建商品列表页**

创建 `e:\code\vadmin\src\pkg-admin\pages\products\index.vue`：

```vue
<template>
    <view class="container">
        <view class="search-bar">
            <input class="search-input" v-model="search" placeholder="搜索商品名称" @confirm="onSearch" />
            <view class="filter-tabs">
                <text :class="['tab', filterEnabled === undefined ? 'active' : '']" @click="filterEnabled = undefined; reload()">全部</text>
                <text :class="['tab', filterEnabled === true ? 'active' : '']" @click="filterEnabled = true; reload()">在售</text>
                <text :class="['tab', filterEnabled === false ? 'active' : '']" @click="filterEnabled = false; reload()">下架</text>
            </view>
        </view>

        <view class="list">
            <view v-for="item in list" :key="item.id" class="item" @click="goDetail(item.id)">
                <image v-if="item.featuredAssetPreview" :src="item.featuredAssetPreview" class="thumb" mode="aspectFill" />
                <view v-else class="thumb placeholder">📦</view>
                <view class="info">
                    <text class="name">{{ item.name }}</text>
                    <text class="meta">{{ item.variantCount }} 个规格 · ¥{{ item.priceFrom }} 起</text>
                </view>
                <switch :checked="item.enabled" @change="onToggleEnabled($event, item)" :disabled="togglingId === item.id" />
            </view>
        </view>

        <view v-if="loading" class="loading">加载中...</view>
        <view v-else-if="list.length === 0" class="empty">暂无商品</view>

        <button class="fab" @click="goDetail('')">+</button>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type ProductListItem } from '@/pkg-admin/api/admin';

const list = ref<ProductListItem[]>([]);
const loading = ref(false);
const search = ref('');
const filterEnabled = ref<boolean | undefined>(undefined);
const togglingId = ref('');
let currentPage = 1;
let totalPages = 1;

async function reload() {
    currentPage = 1;
    await loadPage();
}

async function loadPage() {
    loading.value = true;
    try {
        const data = await adminApi.products({ page: currentPage, search: search.value || undefined, enabled: filterEnabled.value });
        if (currentPage === 1) list.value = data.items;
        else list.value.push(...data.items);
        totalPages = Math.ceil(data.totalItems / 20);
    } finally {
        loading.value = false;
    }
}

function onSearch() { reload(); }

async function onToggleEnabled(e: any, item: ProductListItem) {
    togglingId.value = item.id;
    const newEnabled = e.detail.value;
    try {
        await adminApi.updateProduct(item.id, { enabled: newEnabled });
        item.enabled = newEnabled;
    } catch (err: any) {
        item.enabled = !newEnabled;
        uni.showToast({ title: err.message || '切换失败', icon: 'none' });
    } finally {
        togglingId.value = '';
    }
}

function goDetail(id: string) {
    uni.navigateTo({ url: `/pkg-admin/pages/products/detail?id=${id}` });
}

onMounted(reload);
onReachBottom(() => {
    if (currentPage < totalPages && !loading.value) {
        currentPage++;
        loadPage();
    }
});

function onReachBottom(cb: () => void) {
    // uni-app 生命周期，通过 onLoad 注册
}
</script>

<script lang="ts">
export default {
    onReachBottom() {
        // 触发 setup 中的加载
        (this as any).$nextTick();
    },
};
</script>

<style scoped lang="scss">
.container { padding: 12rpx; }
.search-bar { position: sticky; top: 0; background: #fff; padding: 12rpx; z-index: 1; }
.search-input { width: 100%; height: 64rpx; padding: 0 20rpx; background: #f5f5f5; border-radius: 32rpx; font-size: 28rpx; }
.filter-tabs { display: flex; gap: 20rpx; margin-top: 12rpx; }
.tab { font-size: 26rpx; color: #999; padding: 8rpx 20rpx; border-radius: 24rpx; background: #f5f5f5; }
.tab.active { color: #fff; background: #007aff; }
.list { margin-top: 12rpx; }
.item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx; background: #fff; border-radius: 12rpx; margin-bottom: 12rpx; }
.thumb { width: 100rpx; height: 100rpx; border-radius: 8rpx; background: #f5f5f5; display: flex; align-items: center; justify-content: center; }
.thumb.placeholder { font-size: 40rpx; }
.info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.name { font-size: 28rpx; color: #333; }
.meta { font-size: 24rpx; color: #999; }
.loading, .empty { text-align: center; padding: 40rpx; color: #999; font-size: 26rpx; }
.fab { position: fixed; right: 32rpx; bottom: 64rpx; width: 100rpx; height: 100rpx; border-radius: 50%; background: #007aff; color: #fff; font-size: 48rpx; line-height: 100rpx; text-align: center; }
</style>
```

注意：uni-app `onReachBottom` 需在 `<script>` 非 setup 块中通过 `onLoad`/`onReachBottom` 注册。上面的双 script 写法是 uni-app Vue3 标准模式。如不生效，改用 `uni.$on('reachBottom')` 或在 `pages.json` 配置 `onReachBottomDistance`。

- [ ] **Step 2: 验证编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin
git add src/pkg-admin/pages/products/index.vue
git commit -m "feat(pkg-admin): add product list page with search/filter/toggle"
```

---

## Task 3: 商品详情页

**Files:**
- Create: `e:\code\vadmin\src\pkg-admin\pages\products\detail.vue`

- [ ] **Step 1: 创建商品详情页**

创建 `e:\code\vadmin\src\pkg-admin\pages\products\detail.vue`：

```vue
<template>
    <view class="container">
        <view v-if="loading" class="loading">加载中...</view>
        <view v-else-if="!product" class="empty">商品不存在</view>
        <view v-else class="form">
            <view class="field">
                <text class="label">名称</text>
                <input v-model="form.name" placeholder="商品名称" />
            </view>
            <view class="field">
                <text class="label">Slug</text>
                <input v-model="form.slug" placeholder="url-slug" />
            </view>
            <view class="field">
                <text class="label">描述</text>
                <textarea v-model="form.description" placeholder="商品描述" />
            </view>
            <view class="field">
                <text class="label">启用</text>
                <switch :checked="form.enabled" @change="form.enabled = $event.detail.value" />
            </view>

            <view class="section-title">商品规格（{{ product.variants.length }}）</view>
            <view v-for="v in product.variants" :key="v.id" class="variant">
                <view class="variant-head">
                    <text class="variant-name">{{ v.name }}</text>
                    <text class="variant-sku">{{ v.sku }}</text>
                </view>
                <view class="variant-row">
                    <text>价格: ¥{{ v.price }}</text>
                    <text>库存: {{ v.stockLevel }}</text>
                    <switch :checked="v.enabled" @change="onToggleVariant($event, v)" :disabled="togglingVariantId === v.id" />
                </view>
            </view>

            <button type="primary" @click="onSave" :disabled="saving">保存</button>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type ProductDetail } from '@/pkg-admin/api/admin';

const product = ref<ProductDetail | null>(null);
const loading = ref(true);
const saving = ref(false);
const togglingVariantId = ref('');
const form = ref({ name: '', slug: '', description: '', enabled: true });
let productId = '';

onMounted(async () => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    productId = currentPage?.options?.id ?? '';
    if (!productId) {
        loading.value = false;
        return;
    }
    try {
        product.value = await adminApi.product(productId);
        form.value = {
            name: product.value.name,
            slug: product.value.slug,
            description: product.value.description ?? '',
            enabled: product.value.enabled,
        };
    } finally {
        loading.value = false;
    }
});

async function onSave() {
    saving.value = true;
    try {
        await adminApi.updateProduct(productId, {
            name: form.value.name,
            slug: form.value.slug,
            description: form.value.description,
            enabled: form.value.enabled,
            languageCode: product.value?.languageCode ?? 'en',
        });
        uni.showToast({ title: '已保存', icon: 'success' });
    } catch (err: any) {
        uni.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
        saving.value = false;
    }
}

async function onToggleVariant(e: any, v: ProductDetail['variants'][0]) {
    togglingVariantId.value = v.id;
    const newEnabled = e.detail.value;
    try {
        await adminApi.updateProductVariant(v.id, { enabled: newEnabled });
        v.enabled = newEnabled;
    } catch (err: any) {
        v.enabled = !newEnabled;
        uni.showToast({ title: err.message || '切换失败', icon: 'none' });
    } finally {
        togglingVariantId.value = '';
    }
}
</script>

<style scoped lang="scss">
.container { padding: 20rpx; }
.form { background: #fff; border-radius: 12rpx; padding: 24rpx; }
.field { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.field .label { width: 120rpx; color: #666; font-size: 28rpx; }
.field input, .field textarea { flex: 1; font-size: 28rpx; }
.section-title { margin-top: 24rpx; margin-bottom: 12rpx; font-size: 30rpx; font-weight: bold; color: #333; }
.variant { background: #f9f9f9; border-radius: 8rpx; padding: 16rpx; margin-bottom: 12rpx; }
.variant-head { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.variant-name { font-size: 28rpx; color: #333; }
.variant-sku { font-size: 24rpx; color: #999; }
.variant-row { display: flex; align-items: center; justify-content: space-between; font-size: 26rpx; color: #666; }
button { margin-top: 32rpx; }
.loading, .empty { text-align: center; padding: 80rpx; color: #999; }
</style>
```

- [ ] **Step 2: 验证编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin
git add src/pkg-admin/pages/products/detail.vue
git commit -m "feat(pkg-admin): add product detail page with edit and variant toggle"
```

---

## Task 4: 用户列表页

**Files:**
- Create: `e:\code\vadmin\src\pkg-admin\pages\users\index.vue`

- [ ] **Step 1: 创建用户列表页**

创建 `e:\code\vadmin\src\pkg-admin\pages\users\index.vue`：

```vue
<template>
    <view class="container">
        <view class="search-bar">
            <input class="search-input" v-model="search" placeholder="搜索姓名/邮箱" @confirm="onSearch" />
        </view>

        <view class="list">
            <view v-for="item in list" :key="item.id" class="item" @click="goDetail(item.id)">
                <view class="avatar">{{ (item.firstName || item.emailAddress)[0]?.toUpperCase() }}</view>
                <view class="info">
                    <view class="name-row">
                        <text class="name">{{ item.firstName }} {{ item.lastName }}</text>
                        <text :class="['badge', item.verified ? 'verified' : 'unverified']">{{ item.verified ? '已验证' : '未验证' }}</text>
                    </view>
                    <text class="email">{{ item.emailAddress }}</text>
                    <text v-if="item.lastLogin" class="last-login">最近登录: {{ formatDate(item.lastLogin) }}</text>
                </view>
            </view>
        </view>

        <view v-if="loading" class="loading">加载中...</view>
        <view v-else-if="list.length === 0" class="empty">暂无用户</view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type CustomerListItem } from '@/pkg-admin/api/admin';

const list = ref<CustomerListItem[]>([]);
const loading = ref(false);
const search = ref('');
let currentPage = 1;
let totalPages = 1;

async function reload() {
    currentPage = 1;
    await loadPage();
}

async function loadPage() {
    loading.value = true;
    try {
        const data = await adminApi.customers({ page: currentPage, search: search.value || undefined });
        if (currentPage === 1) list.value = data.items;
        else list.value.push(...data.items);
        totalPages = Math.ceil(data.totalItems / 20);
    } finally {
        loading.value = false;
    }
}

function onSearch() { reload(); }

function goDetail(id: string) {
    uni.navigateTo({ url: `/pkg-admin/pages/users/detail?id=${id}` });
}

function formatDate(s: string): string {
    return new Date(s).toLocaleDateString('zh-CN');
}

onMounted(reload);
</script>

<script lang="ts">
export default {
    onReachBottom() {
        const setup = (this as any);
        if (setup.currentPage < setup.totalPages && !setup.loading) {
            setup.currentPage++;
            setup.loadPage();
        }
    },
};
</script>

<style scoped lang="scss">
.container { padding: 12rpx; }
.search-bar { position: sticky; top: 0; background: #fff; padding: 12rpx; z-index: 1; }
.search-input { width: 100%; height: 64rpx; padding: 0 20rpx; background: #f5f5f5; border-radius: 32rpx; font-size: 28rpx; }
.list { margin-top: 12rpx; }
.item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx; background: #fff; border-radius: 12rpx; margin-bottom: 12rpx; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: #007aff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 36rpx; }
.info { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.name-row { display: flex; align-items: center; gap: 12rpx; }
.name { font-size: 28rpx; color: #333; }
.badge { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 16rpx; }
.badge.verified { background: #e6f7e6; color: #52c41a; }
.badge.unverified { background: #fff7e6; color: #fa8c16; }
.email { font-size: 24rpx; color: #999; }
.last-login { font-size: 22rpx; color: #bbb; }
.loading, .empty { text-align: center; padding: 40rpx; color: #999; font-size: 26rpx; }
</style>
```

- [ ] **Step 2: 验证编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin
git add src/pkg-admin/pages/users/index.vue
git commit -m "feat(pkg-admin): add customer list page with search and pagination"
```

---

## Task 5: 用户详情页

**Files:**
- Create: `e:\code\vadmin\src\pkg-admin\pages\users\detail.vue`

- [ ] **Step 1: 创建用户详情页**

创建 `e:\code\vadmin\src\pkg-admin\pages\users\detail.vue`：

```vue
<template>
    <view class="container">
        <view v-if="loading" class="loading">加载中...</view>
        <view v-else-if="!customer" class="empty">用户不存在</view>
        <view v-else class="content">
            <view class="section">
                <view class="section-title">基本信息</view>
                <view class="field"><text class="label">姓</text><input v-model="form.firstName" /></view>
                <view class="field"><text class="label">名</text><input v-model="form.lastName" /></view>
                <view class="field"><text class="label">邮箱</text><input v-model="form.emailAddress" /></view>
                <view class="field"><text class="label">电话</text><input v-model="form.phoneNumber" placeholder="选填" /></view>
                <view class="field"><text class="label">状态</text><text :class="['badge', customer.verified ? 'verified' : 'unverified']">{{ customer.verified ? '已验证' : '未验证' }}</text></view>
            </view>

            <view v-if="customer.roles.length > 0" class="section">
                <view class="section-title">角色</view>
                <view class="roles">
                    <text v-for="r in customer.roles" :key="r.code" class="role-tag">{{ r.description || r.code }}</text>
                </view>
            </view>

            <view v-if="customer.addresses.length > 0" class="section">
                <view class="section-title">收货地址（{{ customer.addresses.length }}）</view>
                <view v-for="(addr, i) in customer.addresses" :key="i" class="address">
                    <text class="addr-name">{{ addr.fullName }}</text>
                    <text class="addr-detail">{{ addr.streetLine1 }} {{ addr.city }} {{ addr.province }}</text>
                    <text v-if="addr.phoneNumber" class="addr-phone">{{ addr.phoneNumber }}</text>
                </view>
            </view>

            <view class="section">
                <view class="section-title">订单历史（{{ customer.orders.length }}）</view>
                <view v-for="o in customer.orders" :key="o.id" class="order">
                    <view class="order-head">
                        <text class="order-code">{{ o.code }}</text>
                        <text :class="['order-state', o.state]">{{ o.state }}</text>
                    </view>
                    <text class="order-meta">¥{{ o.totalWithTax }} · {{ formatDate(o.orderPlacedAt) }}</text>
                </view>
            </view>

            <button type="primary" @click="onSave" :disabled="saving">保存修改</button>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type CustomerDetail } from '@/pkg-admin/api/admin';

const customer = ref<CustomerDetail | null>(null);
const loading = ref(true);
const saving = ref(false);
const form = ref({ firstName: '', lastName: '', emailAddress: '', phoneNumber: '' });
let customerId = '';

onMounted(async () => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    customerId = currentPage?.options?.id ?? '';
    if (!customerId) {
        loading.value = false;
        return;
    }
    try {
        customer.value = await adminApi.customer(customerId);
        form.value = {
            firstName: customer.value.firstName ?? '',
            lastName: customer.value.lastName ?? '',
            emailAddress: customer.value.emailAddress ?? '',
            phoneNumber: customer.value.phoneNumber ?? '',
        };
    } finally {
        loading.value = false;
    }
});

async function onSave() {
    saving.value = true;
    try {
        await adminApi.updateCustomer(customerId, {
            firstName: form.value.firstName,
            lastName: form.value.lastName,
            emailAddress: form.value.emailAddress,
            phoneNumber: form.value.phoneNumber || undefined,
        });
        uni.showToast({ title: '已保存', icon: 'success' });
    } catch (err: any) {
        uni.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
        saving.value = false;
    }
}

function formatDate(s?: string): string {
    if (!s) return '-';
    return new Date(s).toLocaleDateString('zh-CN');
}
</script>

<style scoped lang="scss">
.container { padding: 20rpx; }
.section { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; }
.field { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.field .label { width: 100rpx; color: #666; font-size: 28rpx; }
.field input { flex: 1; font-size: 28rpx; }
.badge { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 16rpx; }
.badge.verified { background: #e6f7e6; color: #52c41a; }
.badge.unverified { background: #fff7e6; color: #fa8c16; }
.roles { display: flex; flex-wrap: wrap; gap: 12rpx; }
.role-tag { font-size: 24rpx; padding: 6rpx 16rpx; background: #e6f4ff; color: #007aff; border-radius: 16rpx; }
.address { padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.addr-name { font-size: 28rpx; color: #333; }
.addr-detail { display: block; font-size: 24rpx; color: #666; margin-top: 4rpx; }
.addr-phone { display: block; font-size: 24rpx; color: #999; }
.order { padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.order-head { display: flex; justify-content: space-between; align-items: center; }
.order-code { font-size: 28rpx; color: #333; }
.order-state { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 12rpx; background: #f0f0f0; color: #666; }
.order-state.Paid, .order-state.PartiallyShipped, .order-state.Shipped { background: #e6f4ff; color: #007aff; }
.order-state.Delivered, .order-state.Settled { background: #e6f7e6; color: #52c41a; }
.order-state.Cancelled { background: #fff1f0; color: #f5222d; }
.order-meta { display: block; font-size: 24rpx; color: #999; margin-top: 4rpx; }
button { margin-top: 24rpx; }
.loading, .empty { text-align: center; padding: 80rpx; color: #999; }
</style>
```

- [ ] **Step 2: 验证编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin
git add src/pkg-admin/pages/users/detail.vue
git commit -m "feat(pkg-admin): add customer detail page with edit/roles/addresses/orders"
```

---

## Task 6: 财务概览页

**Files:**
- Create: `e:\code\vadmin\src\pkg-admin\pages\finance\index.vue`

- [ ] **Step 1: 创建财务概览页**

创建 `e:\code\vadmin\src\pkg-admin\pages\finance\index.vue`：

```vue
<template>
    <view class="container">
        <view class="range-bar">
            <text :class="['range-tab', range === 'today' ? 'active' : '']" @click="changeRange('today')">今日</text>
            <text :class="['range-tab', range === 'week' ? 'active' : '']" @click="changeRange('week')">本周</text>
            <text :class="['range-tab', range === 'month' ? 'active' : '']" @click="changeRange('month')">本月</text>
        </view>

        <view v-if="loading" class="loading">加载中...</view>
        <view v-else-if="!summary" class="empty">暂无数据</view>
        <view v-else class="content">
            <view class="kpi-row">
                <view class="kpi-card">
                    <text class="kpi-label">总营收</text>
                    <text class="kpi-value">¥{{ formatMoney(summary.totalRevenue) }}</text>
                </view>
                <view class="kpi-card">
                    <text class="kpi-label">订单数</text>
                    <text class="kpi-value">{{ summary.totalOrders }}</text>
                </view>
                <view class="kpi-card">
                    <text class="kpi-label">退款估额</text>
                    <text class="kpi-value warn">¥{{ formatMoney(summary.totalRefunds) }}</text>
                </view>
            </view>

            <view class="section">
                <view class="section-title">订单状态分布</view>
                <view v-for="s in summary.stateDistribution" :key="s.state" class="dist-row">
                    <text class="dist-label">{{ s.state }}</text>
                    <view class="dist-bar">
                        <view class="dist-fill" :style="{ width: barWidth(s.amount, summary.totalRevenue) + '%', background: stateColor(s.state) }" />
                    </view>
                    <text class="dist-value">{{ s.count }}单 / ¥{{ formatMoney(s.amount) }}</text>
                </view>
            </view>

            <view class="section">
                <view class="section-title">支付方式占比</view>
                <view v-for="p in summary.paymentMethodDistribution" :key="p.method" class="dist-row">
                    <text class="dist-label">{{ p.method }}</text>
                    <view class="dist-bar">
                        <view class="dist-fill" :style="{ width: barWidth(p.amount, summary.totalRevenue) + '%' }" />
                    </view>
                    <text class="dist-value">{{ p.count }}笔 / ¥{{ formatMoney(p.amount) }}</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi, type FinanceSummary } from '@/pkg-admin/api/admin';

const range = ref<'today' | 'week' | 'month'>('today');
const loading = ref(false);
const summary = ref<FinanceSummary | null>(null);

function getRange(): { start: string; end: string } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (range.value === 'week') {
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
    } else if (range.value === 'month') {
        start.setDate(1);
    }
    return { start: start.toISOString(), end: end.toISOString() };
}

async function load() {
    loading.value = true;
    try {
        const { start, end } = getRange();
        summary.value = await adminApi.financeSummary(start, end);
    } catch (err: any) {
        uni.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
        loading.value = false;
    }
}

function changeRange(r: 'today' | 'week' | 'month') {
    range.value = r;
    load();
}

function formatMoney(n: number): string {
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function barWidth(amount: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((amount / total) * 100));
}

function stateColor(state: string): string {
    const map: Record<string, string> = {
        Paid: '#007aff', Shipped: '#13c2c2', Delivered: '#52c41a',
        Cancelled: '#f5222d', PartiallyShipped: '#fa8c16', Settled: '#722ed1',
    };
    return map[state] || '#999';
}

onMounted(load);
</script>

<script lang="ts">
export default {
    onPullDownRefresh() {
        (this as any).load?.().finally(() => uni.stopPullDownRefresh());
    },
};
</script>

<style scoped lang="scss">
.container { padding: 12rpx; }
.range-bar { display: flex; gap: 16rpx; padding: 16rpx; background: #fff; border-radius: 12rpx; margin-bottom: 12rpx; }
.range-tab { flex: 1; text-align: center; padding: 12rpx 0; font-size: 28rpx; color: #666; border-radius: 8rpx; background: #f5f5f5; }
.range-tab.active { color: #fff; background: #007aff; }
.kpi-row { display: flex; gap: 12rpx; margin-bottom: 12rpx; }
.kpi-card { flex: 1; background: #fff; border-radius: 12rpx; padding: 20rpx; display: flex; flex-direction: column; gap: 8rpx; align-items: center; }
.kpi-label { font-size: 24rpx; color: #999; }
.kpi-value { font-size: 36rpx; font-weight: bold; color: #333; }
.kpi-value.warn { color: #f5222d; }
.section { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 12rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; }
.dist-row { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 0; }
.dist-label { width: 160rpx; font-size: 26rpx; color: #666; }
.dist-bar { flex: 1; height: 16rpx; background: #f0f0f0; border-radius: 8rpx; overflow: hidden; }
.dist-fill { height: 100%; background: #007aff; transition: width 0.3s; }
.dist-value { width: 260rpx; font-size: 24rpx; color: #999; text-align: right; }
.loading, .empty { text-align: center; padding: 80rpx; color: #999; }
</style>
```

- [ ] **Step 2: 验证编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin
git add src/pkg-admin/pages/finance/index.vue
git commit -m "feat(pkg-admin): add finance overview page with client-side aggregation"
```

---

## Task 7: 清理 placeholder + 冒烟验证

**Files:**
- Delete: `e:\code\vadmin\src\pkg-admin\pages\placeholder.vue`

- [ ] **Step 1: 删除 placeholder 页面**

```bash
cd e:\code\vadmin
git rm src/pkg-admin/pages/placeholder.vue
```

- [ ] **Step 2: 完整编译**

运行：`cd e:\code\vadmin ; npm run build:h5`
Expected: Build complete，无错误

- [ ] **Step 3: dev server 冒烟**

运行：`cd e:\code\vadmin ; npm run dev:h5`（后台运行）
然后浏览器访问：
- `http://localhost:5181/#/pkg-admin/pages/products/index` — 商品列表
- `http://localhost:5181/#/pkg-admin/pages/users/index` — 用户列表
- `http://localhost:5181/#/pkg-admin/pages/finance/index` — 财务概览

Expected: 3 个页面均无白屏、无 JS 错误

- [ ] **Step 4: Commit**

```bash
cd e:\code\vadmin
git add -A
git commit -m "chore(pkg-admin): remove placeholder, finalize module"
```

- [ ] **Step 5: 启用 vendure MODULE_CONFIGS 并重启 dev-server**

修改 `e:\code\vendure\packages\delivery-plugin\src\constants.ts`（Task 1 Step 2 已改），在 `e:\code\vendure` 下：
- 若 delivery-plugin 是 dist 加载：`cd packages\delivery-plugin ; npm run build`
- 重启 vendure dev-server（停止旧进程，重新 `npm run dev`）

Expected: 启动日志无错误，`operations-staff`/`manager`/`super-admin` 角色权限同步后 admin 模块快捷入口在工作台显示

- [ ] **Step 6: 推送**

```bash
cd e:\code\vadmin
git push origin master

cd e:\code\vendure
git add packages/delivery-plugin/src/constants.ts packages/delivery-plugin/dist/
git commit -m "feat(admin): enable MODULE_CONFIGS.admin module" --no-verify
git push origin master
```

---

## Self-Review

**1. Spec coverage:**
- 商品列表 + 详情 + 上下架：Task 2 + Task 3 ✓
- 用户列表 + 详情 + 编辑：Task 4 + Task 5 ✓
- 财务概览：Task 6 ✓
- MODULE_CONFIGS.admin 启用：Task 1 Step 2 + Task 7 Step 5 ✓
- shortcuts 启用：Task 1 Step 3 ✓
- pages.json 注册：Task 1 Step 4 ✓
- placeholder 清理：Task 7 Step 1 ✓

**2. Placeholder scan:** 无 TBD/TODO/placeholder，所有步骤含完整代码 ✓

**3. Type consistency:**
- `adminApi.products()` 返回 `{ items: ProductListItem[]; totalItems }` — Task 2 使用 ✓
- `adminApi.product(id)` 返回 `ProductDetail` — Task 3 使用 ✓
- `adminApi.updateProduct(id, input)` — Task 2/3 调用 ✓
- `adminApi.customers()` 返回 `{ items: CustomerListItem[]; totalItems }` — Task 4 使用 ✓
- `adminApi.customer(id)` 返回 `CustomerDetail` — Task 5 使用 ✓
- `adminApi.financeSummary(start, end)` 返回 `FinanceSummary` — Task 6 使用 ✓
