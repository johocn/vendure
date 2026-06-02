# Admin UI 扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 7 个 CJK 本地化插件实现完整的 React Dashboard 管理界面扩展

**Architecture:** 每个插件内嵌 `dashboard/` 目录，通过 `@VendurePlugin({ dashboard: './dashboard/index.tsx' })` 声明入口，使用 `defineDashboardExtension()` 注册路由、PageBlock、DetailForm 扩展。Vite 插件自动发现并编译。

**Tech Stack:** React + TypeScript + @vendure/dashboard (defineDashboardExtension, ListPage, DetailPage, detailPageRouteLoader) + graphql-tag + @lingui/react/macro

---

## 文件结构总览

### CjkPlugin
- Create: `packages/cjk-plugin/dashboard/index.tsx`
- Create: `packages/cjk-plugin/dashboard/tsconfig.json`
- Create: `packages/cjk-plugin/dashboard/pickup-location-list.tsx`
- Create: `packages/cjk-plugin/dashboard/pickup-location-detail.tsx`
- Create: `packages/cjk-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/cjk-plugin/dashboard/promotion-detail-forms.tsx`
- Modify: `packages/cjk-plugin/src/plugin.ts` — 添加 `dashboard` 属性

### OrderTimeoutPlugin
- Create: `packages/order-timeout-plugin/dashboard/index.tsx`
- Create: `packages/order-timeout-plugin/dashboard/tsconfig.json`
- Create: `packages/order-timeout-plugin/dashboard/channel-detail-forms.tsx`
- Modify: `packages/order-timeout-plugin/src/plugin.ts` — 添加 `dashboard` 属性

### InvoicePlugin
- Create: `packages/invoice-plugin/dashboard/index.tsx`
- Create: `packages/invoice-plugin/dashboard/tsconfig.json`
- Create: `packages/invoice-plugin/dashboard/invoice-block.tsx`
- Modify: `packages/invoice-plugin/src/plugin.ts` — 添加 `dashboard` 属性

### LogisticsPlugin
- Create: `packages/logistics-plugin/dashboard/index.tsx`
- Create: `packages/logistics-plugin/dashboard/tsconfig.json`
- Create: `packages/logistics-plugin/dashboard/logistics-block.tsx`
- Create: `packages/logistics-plugin/dashboard/channel-detail-forms.tsx`
- Modify: `packages/logistics-plugin/src/plugin.ts` — 添加 `dashboard` 属性

### GroupBuyPlugin
- Create: `packages/group-buy-plugin/dashboard/index.tsx`
- Create: `packages/group-buy-plugin/dashboard/tsconfig.json`
- Create: `packages/group-buy-plugin/dashboard/group-buy-list.tsx`
- Create: `packages/group-buy-plugin/dashboard/group-buy-detail.tsx`
- Create: `packages/group-buy-plugin/dashboard/group-buy-block.tsx`
- Modify: `packages/group-buy-plugin/src/plugin.ts` — 添加 `dashboard` 属性

### FlashSalePlugin
- Create: `packages/flash-sale-plugin/dashboard/index.tsx`
- Create: `packages/flash-sale-plugin/dashboard/tsconfig.json`
- Create: `packages/flash-sale-plugin/dashboard/flash-sale-list.tsx`
- Create: `packages/flash-sale-plugin/dashboard/flash-sale-detail.tsx`
- Create: `packages/flash-sale-plugin/dashboard/flash-sale-block.tsx`
- Modify: `packages/flash-sale-plugin/src/plugin.ts` — 添加 `dashboard` 属性

### DistributionPlugin
- Create: `packages/distribution-plugin/dashboard/index.tsx`
- Create: `packages/distribution-plugin/dashboard/tsconfig.json`
- Create: `packages/distribution-plugin/dashboard/distributor-list.tsx`
- Create: `packages/distribution-plugin/dashboard/distributor-detail.tsx`
- Create: `packages/distribution-plugin/dashboard/commission-record-list.tsx`
- Create: `packages/distribution-plugin/dashboard/withdrawal-request-list.tsx`
- Create: `packages/distribution-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/distribution-plugin/dashboard/customer-detail-forms.tsx`
- Modify: `packages/distribution-plugin/src/plugin.ts` — 添加 `dashboard` 属性

---

### Task 1: CjkPlugin — 自提点管理 + 优惠券叠加配置

**Files:**
- Create: `packages/cjk-plugin/dashboard/tsconfig.json`
- Create: `packages/cjk-plugin/dashboard/pickup-location-list.tsx`
- Create: `packages/cjk-plugin/dashboard/pickup-location-detail.tsx`
- Create: `packages/cjk-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/cjk-plugin/dashboard/promotion-detail-forms.tsx`
- Create: `packages/cjk-plugin/dashboard/index.tsx`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建自提点列表页**

Create `packages/cjk-plugin/dashboard/pickup-location-list.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getPickupLocations = graphql(`
    query GetPickupLocations($options: ListQueryOptions) {
        pickupLocations(options: $options) {
            items {
                id
                name
                type
                address
                phoneNumber
                businessHours
                partner
            }
            totalItems
        }
    }
`);

export const pickupLocationList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'settings',
        id: 'pickup-locations',
        url: '/pickup-locations',
        title: 'Pickup Locations',
        requiresPermission: ['ReadSettings'],
    },
    path: '/pickup-locations',
    loader: () => ({
        breadcrumb: 'Pickup Locations',
    }),
    component: route => (
        <ListPage
            pageId="pickup-location-list"
            title={<Trans>Pickup Locations</Trans>}
            listQuery={getPickupLocations}
            route={route}
            defaultVisibility={{
                phoneNumber: false,
                businessHours: false,
                partner: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.name} />,
                },
            }}
        />
    ),
};
```

- [ ] **Step 3: 创建自提点详情页**

Create `packages/cjk-plugin/dashboard/pickup-location-detail.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getPickupLocationDetail = graphql(`
    query GetPickupLocationDetail($id: ID!) {
        pickupLocation(id: $id) {
            id
            name
            type
            address
            phoneNumber
            businessHours
            coordinates
            partner
        }
    }
`);

const createPickupLocation = graphql(`
    mutation CreatePickupLocation($input: CreatePickupLocationInput!) {
        createPickupLocation(input: $input) {
            id
        }
    }
`);

const updatePickupLocation = graphql(`
    mutation UpdatePickupLocation($input: UpdatePickupLocationInput!) {
        updatePickupLocation(input: $input) {
            id
        }
    }
`);

export const pickupLocationDetail: DashboardRouteDefinition = {
    path: '/pickup-locations/$id',
    loader: detailPageRouteLoader({
        queryDocument: getPickupLocationDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/pickup-locations', label: 'Pickup Locations' },
            isNew ? 'New' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="pickup-location-detail"
            queryDocument={getPickupLocationDetail}
            createDocument={createPickupLocation}
            updateDocument={updatePickupLocation}
            route={route}
            title={location => location.name}
            setValuesForUpdate={location => ({
                id: location.id,
                name: location.name,
                type: location.type,
                address: location.address,
                phoneNumber: location.phoneNumber,
                businessHours: location.businessHours,
                coordinates: location.coordinates,
                partner: location.partner,
            })}
        />
    ),
};
```

- [ ] **Step 4: 创建 Channel 详情表单扩展**

Create `packages/cjk-plugin/dashboard/channel-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
    },
];
```

- [ ] **Step 5: 创建 Promotion 详情表单扩展**

Create `packages/cjk-plugin/dashboard/promotion-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const cjkPromotionDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'promotion-detail',
    },
];
```

- [ ] **Step 6: 创建 dashboard 入口文件**

Create `packages/cjk-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';
import { MapPinIcon } from 'lucide-react';

import { cjkChannelDetailForms } from './channel-detail-forms';
import { cjkPromotionDetailForms } from './promotion-detail-forms';
import { pickupLocationDetail } from './pickup-location-detail';
import { pickupLocationList } from './pickup-location-list';

defineDashboardExtension({
    routes: [pickupLocationList, pickupLocationDetail],
    detailForms: [...cjkChannelDetailForms, ...cjkPromotionDetailForms],
});
```

- [ ] **Step 7: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/cjk-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中添加 `dashboard` 属性：

```ts
@VendurePlugin({
    // ...existing config
    dashboard: './dashboard/index.tsx',
})
```

具体修改：在 `compatibility: '^3.0.0',` 行之前添加 `dashboard: './dashboard/index.tsx',`

- [ ] **Step 8: 提交**

```bash
git add packages/cjk-plugin/dashboard/ packages/cjk-plugin/src/plugin.ts
git commit -m "feat(cjk-plugin): add dashboard UI extension for pickup locations and detail forms"
```

---

### Task 2: OrderTimeoutPlugin — Channel 超时配置

**Files:**
- Create: `packages/order-timeout-plugin/dashboard/tsconfig.json`
- Create: `packages/order-timeout-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/order-timeout-plugin/dashboard/index.tsx`
- Modify: `packages/order-timeout-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建 Channel 详情表单扩展**

Create `packages/order-timeout-plugin/dashboard/channel-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const orderTimeoutChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
    },
];
```

- [ ] **Step 3: 创建 dashboard 入口文件**

Create `packages/order-timeout-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

import { orderTimeoutChannelDetailForms } from './channel-detail-forms';

defineDashboardExtension({
    detailForms: orderTimeoutChannelDetailForms,
});
```

- [ ] **Step 4: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/order-timeout-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 5: 提交**

```bash
git add packages/order-timeout-plugin/dashboard/ packages/order-timeout-plugin/src/plugin.ts
git commit -m "feat(order-timeout-plugin): add dashboard UI extension for channel detail forms"
```

---

### Task 3: InvoicePlugin — 订单发票信息

**Files:**
- Create: `packages/invoice-plugin/dashboard/tsconfig.json`
- Create: `packages/invoice-plugin/dashboard/invoice-block.tsx`
- Create: `packages/invoice-plugin/dashboard/index.tsx`
- Modify: `packages/invoice-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建发票信息 PageBlock**

Create `packages/invoice-plugin/dashboard/invoice-block.tsx`:

```tsx
import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DashboardPageBlockDefinition } from '@vendure/dashboard';

export const invoiceBlock: DashboardPageBlockDefinition = {
    id: 'invoice-info',
    title: <Trans>Invoice Information</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'main-form', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.invoiceRequired;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        if (!cf) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="Invoice Type">{cf.invoiceType || '-'}</LabeledData>
                <LabeledData label="Invoice Title">{cf.invoiceTitle || '-'}</LabeledData>
                <LabeledData label="Tax Number">{cf.invoiceTaxNumber || '-'}</LabeledData>
                <LabeledData label="Email">{cf.invoiceEmail || '-'}</LabeledData>
                {cf.invoiceType === 'special' && (
                    <>
                        <LabeledData label="Company Address">{cf.invoiceCompanyAddress || '-'}</LabeledData>
                        <LabeledData label="Company Phone">{cf.invoiceCompanyPhone || '-'}</LabeledData>
                        <LabeledData label="Bank Name">{cf.invoiceBankName || '-'}</LabeledData>
                        <LabeledData label="Bank Account">{cf.invoiceBankAccount || '-'}</LabeledData>
                    </>
                )}
            </div>
        );
    },
};
```

- [ ] **Step 3: 创建 dashboard 入口文件**

Create `packages/invoice-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

import { invoiceBlock } from './invoice-block';

defineDashboardExtension({
    pageBlocks: [invoiceBlock],
});
```

- [ ] **Step 4: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/invoice-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 5: 提交**

```bash
git add packages/invoice-plugin/dashboard/ packages/invoice-plugin/src/plugin.ts
git commit -m "feat(invoice-plugin): add dashboard UI extension for order invoice block"
```

---

### Task 4: LogisticsPlugin — 物流信息 + 发货策略配置

**Files:**
- Create: `packages/logistics-plugin/dashboard/tsconfig.json`
- Create: `packages/logistics-plugin/dashboard/logistics-block.tsx`
- Create: `packages/logistics-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/logistics-plugin/dashboard/index.tsx`
- Modify: `packages/logistics-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建物流追踪 PageBlock**

Create `packages/logistics-plugin/dashboard/logistics-block.tsx`:

```tsx
import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DashboardPageBlockDefinition } from '@vendure/dashboard';

export const logisticsBlock: DashboardPageBlockDefinition = {
    id: 'logistics-tracking',
    title: <Trans>Logistics Tracking</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'invoice-info', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        const fulfillments = order?.fulfillments;
        if (!fulfillments || !fulfillments.length) return false;
        return fulfillments.some((f: any) => f.customFields?.trackingNumber);
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const fulfillments = order?.fulfillments ?? [];

        return (
            <div className="space-y-3">
                {fulfillments.map((fulfillment: any) => {
                    const cf = fulfillment.customFields;
                    if (!cf?.trackingNumber) return null;
                    return (
                        <div key={fulfillment.id} className="space-y-2">
                            <LabeledData label="Tracking Number">{cf.trackingNumber}</LabeledData>
                            <LabeledData label="Carrier">{cf.carrier || '-'}</LabeledData>
                            <LabeledData label="Carrier Code">{cf.carrierCode || '-'}</LabeledData>
                            <LabeledData label="Shipping Note">{cf.shippingNote || '-'}</LabeledData>
                        </div>
                    );
                })}
            </div>
        );
    },
};
```

- [ ] **Step 3: 创建 Channel 详情表单扩展**

Create `packages/logistics-plugin/dashboard/channel-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const logisticsChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
    },
];
```

- [ ] **Step 4: 创建 dashboard 入口文件**

Create `packages/logistics-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

import { logisticsChannelDetailForms } from './channel-detail-forms';
import { logisticsBlock } from './logistics-block';

defineDashboardExtension({
    pageBlocks: [logisticsBlock],
    detailForms: logisticsChannelDetailForms,
});
```

- [ ] **Step 5: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/logistics-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 6: 提交**

```bash
git add packages/logistics-plugin/dashboard/ packages/logistics-plugin/src/plugin.ts
git commit -m "feat(logistics-plugin): add dashboard UI extension for logistics tracking and channel config"
```

---

### Task 5: GroupBuyPlugin — 拼团活动管理

**Files:**
- Create: `packages/group-buy-plugin/dashboard/tsconfig.json`
- Create: `packages/group-buy-plugin/dashboard/group-buy-list.tsx`
- Create: `packages/group-buy-plugin/dashboard/group-buy-detail.tsx`
- Create: `packages/group-buy-plugin/dashboard/group-buy-block.tsx`
- Create: `packages/group-buy-plugin/dashboard/index.tsx`
- Modify: `packages/group-buy-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建拼团活动列表页**

Create `packages/group-buy-plugin/dashboard/group-buy-list.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getGroupBuyActivities = graphql(`
    query GetGroupBuyActivities($options: Json) {
        groupBuyActivities(options: $options) {
            items {
                id
                name
                status
                targetCount
                currentCount
                maxCount
                groupPrice
                startAt
                endAt
            }
            totalItems
        }
    }
`);

export const groupBuyList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'marketing',
        id: 'group-buy-activities',
        url: '/group-buy-activities',
        title: 'Group Buy',
        requiresPermission: ['ReadPromotion'],
    },
    path: '/group-buy-activities',
    loader: () => ({
        breadcrumb: 'Group Buy',
    }),
    component: route => (
        <ListPage
            pageId="group-buy-list"
            title={<Trans>Group Buy Activities</Trans>}
            listQuery={getGroupBuyActivities}
            route={route}
            defaultVisibility={{
                maxCount: false,
                groupPrice: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.name} />,
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            active: 'bg-green-100 text-green-800',
                            completed: 'bg-blue-100 text-blue-800',
                            expired: 'bg-gray-100 text-gray-800',
                        };
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}>
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
```

- [ ] **Step 3: 创建拼团活动详情页**

Create `packages/group-buy-plugin/dashboard/group-buy-detail.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getGroupBuyDetail = graphql(`
    query GetGroupBuyDetail($id: ID!) {
        groupBuyActivity(id: $id) {
            id
            name
            description
            targetCount
            currentCount
            maxCount
            status
            startAt
            endAt
            groupPrice
            leaderDiscount
            leaderRewardType
            autoConfirm
            allowJoinAfterComplete
            createdAt
            updatedAt
        }
    }
`);

const createGroupBuyActivity = graphql(`
    mutation CreateGroupBuyActivity($input: CreateGroupBuyActivityInput!) {
        createGroupBuyActivity(input: $input) {
            id
        }
    }
`);

const updateGroupBuyActivity = graphql(`
    mutation UpdateGroupBuyActivity($input: UpdateGroupBuyActivityInput!) {
        updateGroupBuyActivity(input: $input) {
            id
        }
    }
`);

export const groupBuyDetail: DashboardRouteDefinition = {
    path: '/group-buy-activities/$id',
    loader: detailPageRouteLoader({
        queryDocument: getGroupBuyDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/group-buy-activities', label: 'Group Buy' },
            isNew ? 'New' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="group-buy-detail"
            queryDocument={getGroupBuyDetail}
            createDocument={createGroupBuyActivity}
            updateDocument={updateGroupBuyActivity}
            route={route}
            title={activity => activity.name}
            setValuesForUpdate={activity => ({
                id: activity.id,
                name: activity.name,
                description: activity.description,
                targetCount: activity.targetCount,
                maxCount: activity.maxCount,
                startAt: activity.startAt,
                endAt: activity.endAt,
                groupPrice: activity.groupPrice,
                leaderDiscount: activity.leaderDiscount,
                status: activity.status,
            })}
        />
    ),
};
```

- [ ] **Step 4: 创建拼团信息 PageBlock**

Create `packages/group-buy-plugin/dashboard/group-buy-block.tsx`:

```tsx
import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DetailPageButton, DashboardPageBlockDefinition } from '@vendure/dashboard';

export const groupBuyBlock: DashboardPageBlockDefinition = {
    id: 'group-buy-info',
    title: <Trans>Group Buy</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'logistics-tracking', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.groupBuyActivityId;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        if (!cf?.groupBuyActivityId) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="Activity ID">
                    <DetailPageButton href={`/group-buy-activities/${cf.groupBuyActivityId}`} label={String(cf.groupBuyActivityId)} />
                </LabeledData>
                <LabeledData label="Is Leader">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cf.groupBuyIsLeader ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                        {cf.groupBuyIsLeader ? 'Leader' : 'Member'}
                    </span>
                </LabeledData>
            </div>
        );
    },
};
```

- [ ] **Step 5: 创建 dashboard 入口文件**

Create `packages/group-buy-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';
import { UsersIcon } from 'lucide-react';

import { groupBuyBlock } from './group-buy-block';
import { groupBuyDetail } from './group-buy-detail';
import { groupBuyList } from './group-buy-list';

defineDashboardExtension({
    navSections: [
        {
            id: 'marketing',
            title: 'Marketing',
            icon: UsersIcon,
            order: 600,
        },
    ],
    routes: [groupBuyList, groupBuyDetail],
    pageBlocks: [groupBuyBlock],
});
```

- [ ] **Step 6: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/group-buy-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 7: 提交**

```bash
git add packages/group-buy-plugin/dashboard/ packages/group-buy-plugin/src/plugin.ts
git commit -m "feat(group-buy-plugin): add dashboard UI extension for group buy management"
```

---

### Task 6: FlashSalePlugin — 秒杀活动管理

**Files:**
- Create: `packages/flash-sale-plugin/dashboard/tsconfig.json`
- Create: `packages/flash-sale-plugin/dashboard/flash-sale-list.tsx`
- Create: `packages/flash-sale-plugin/dashboard/flash-sale-detail.tsx`
- Create: `packages/flash-sale-plugin/dashboard/flash-sale-block.tsx`
- Create: `packages/flash-sale-plugin/dashboard/index.tsx`
- Modify: `packages/flash-sale-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建秒杀活动列表页**

Create `packages/flash-sale-plugin/dashboard/flash-sale-list.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getFlashSaleActivities = graphql(`
    query GetFlashSaleActivities($options: Json) {
        flashSaleActivities(options: $options) {
            items {
                id
                name
                status
                flashPrice
                totalStock
                soldCount
                limitPerUser
                startAt
                endAt
            }
            totalItems
        }
    }
`);

export const flashSaleList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'marketing',
        id: 'flash-sale-activities',
        url: '/flash-sale-activities',
        title: 'Flash Sale',
        requiresPermission: ['ReadPromotion'],
    },
    path: '/flash-sale-activities',
    loader: () => ({
        breadcrumb: 'Flash Sale',
    }),
    component: route => (
        <ListPage
            pageId="flash-sale-list"
            title={<Trans>Flash Sale Activities</Trans>}
            listQuery={getFlashSaleActivities}
            route={route}
            defaultVisibility={{
                limitPerUser: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.name} />,
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            upcoming: 'bg-yellow-100 text-yellow-800',
                            active: 'bg-green-100 text-green-800',
                            ended: 'bg-gray-100 text-gray-800',
                        };
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}>
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
```

- [ ] **Step 3: 创建秒杀活动详情页**

Create `packages/flash-sale-plugin/dashboard/flash-sale-detail.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { DashboardRouteDefinition, DetailPage, detailPageRouteLoader } from '@vendure/dashboard';

const getFlashSaleDetail = graphql(`
    query GetFlashSaleDetail($id: ID!) {
        flashSaleActivity(id: $id) {
            id
            name
            startAt
            endAt
            flashPrice
            totalStock
            soldCount
            limitPerUser
            status
            createdAt
            updatedAt
        }
    }
`);

const createFlashSaleActivity = graphql(`
    mutation CreateFlashSaleActivity($input: CreateFlashSaleActivityInput!) {
        createFlashSaleActivity(input: $input) {
            id
        }
    }
`);

const updateFlashSaleActivity = graphql(`
    mutation UpdateFlashSaleActivity($input: UpdateFlashSaleActivityInput!) {
        updateFlashSaleActivity(input: $input) {
            id
        }
    }
`);

export const flashSaleDetail: DashboardRouteDefinition = {
    path: '/flash-sale-activities/$id',
    loader: detailPageRouteLoader({
        queryDocument: getFlashSaleDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/flash-sale-activities', label: 'Flash Sale' },
            isNew ? 'New' : entity?.name,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="flash-sale-detail"
            queryDocument={getFlashSaleDetail}
            createDocument={createFlashSaleActivity}
            updateDocument={updateFlashSaleActivity}
            route={route}
            title={activity => activity.name}
            setValuesForUpdate={activity => ({
                id: activity.id,
                name: activity.name,
                startAt: activity.startAt,
                endAt: activity.endAt,
                flashPrice: activity.flashPrice,
                totalStock: activity.totalStock,
                limitPerUser: activity.limitPerUser,
                status: activity.status,
            })}
        />
    ),
};
```

- [ ] **Step 4: 创建秒杀信息 PageBlock**

Create `packages/flash-sale-plugin/dashboard/flash-sale-block.tsx`:

```tsx
import { LabeledData } from '@/vdb/components/labeled-data.js';
import { useLocalFormat } from '@/vdb/hooks/use-local-format.js';
import { Trans } from '@lingui/react/macro';
import { DetailPageButton, DashboardPageBlockDefinition } from '@vendure/dashboard';

export const flashSaleBlock: DashboardPageBlockDefinition = {
    id: 'flash-sale-info',
    title: <Trans>Flash Sale</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'group-buy-info', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.flashSaleActivityId;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        const { formatDate } = useLocalFormat();
        if (!cf?.flashSaleActivityId) return null;

        return (
            <div className="space-y-2">
                <LabeledData label="Activity ID">
                    <DetailPageButton href={`/flash-sale-activities/${cf.flashSaleActivityId}`} label={String(cf.flashSaleActivityId)} />
                </LabeledData>
                {cf.flashSaleStartAt && (
                    <LabeledData label="Start At">{formatDate(cf.flashSaleStartAt)}</LabeledData>
                )}
                {cf.flashSaleEndAt && (
                    <LabeledData label="End At">{formatDate(cf.flashSaleEndAt)}</LabeledData>
                )}
            </div>
        );
    },
};
```

- [ ] **Step 5: 创建 dashboard 入口文件**

Create `packages/flash-sale-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

import { flashSaleBlock } from './flash-sale-block';
import { flashSaleDetail } from './flash-sale-detail';
import { flashSaleList } from './flash-sale-list';

defineDashboardExtension({
    routes: [flashSaleList, flashSaleDetail],
    pageBlocks: [flashSaleBlock],
});
```

注意：不在此处定义 navSections，因为"营销"区域已在 GroupBuyPlugin 的 dashboard 中注册。FlashSalePlugin 的路由 navMenuItem 引用 `sectionId: 'marketing'` 即可。

- [ ] **Step 6: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/flash-sale-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 7: 提交**

```bash
git add packages/flash-sale-plugin/dashboard/ packages/flash-sale-plugin/src/plugin.ts
git commit -m "feat(flash-sale-plugin): add dashboard UI extension for flash sale management"
```

---

### Task 7: DistributionPlugin — 分销商 + 佣金 + 提现管理

**Files:**
- Create: `packages/distribution-plugin/dashboard/tsconfig.json`
- Create: `packages/distribution-plugin/dashboard/distributor-list.tsx`
- Create: `packages/distribution-plugin/dashboard/distributor-detail.tsx`
- Create: `packages/distribution-plugin/dashboard/commission-record-list.tsx`
- Create: `packages/distribution-plugin/dashboard/withdrawal-request-list.tsx`
- Create: `packages/distribution-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/distribution-plugin/dashboard/customer-detail-forms.tsx`
- Create: `packages/distribution-plugin/dashboard/index.tsx`
- Modify: `packages/distribution-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建分销商列表页**

Create `packages/distribution-plugin/dashboard/distributor-list.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';

const getDistributors = graphql(`
    query GetDistributors($options: DistributorListOptions) {
        distributors(options: $options) {
            items {
                id
                customerId
                parentId
                level
                status
                totalEarnings
                availableBalance
                frozenBalance
                referralCode
            }
            totalItems
        }
    }
`);

export const distributorList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'distribution',
        id: 'distributors',
        url: '/distributors',
        title: 'Distributors',
        requiresPermission: ['ReadCustomer'],
    },
    path: '/distributors',
    loader: () => ({
        breadcrumb: 'Distributors',
    }),
    component: route => (
        <ListPage
            pageId="distributor-list"
            title={<Trans>Distributors</Trans>}
            listQuery={getDistributors}
            route={route}
            defaultVisibility={{
                parentId: false,
                level: false,
                frozenBalance: false,
                referralCode: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                referralCode: {
                    header: 'Referral Code',
                    cell: ({ row }) => <span className="font-mono text-sm">{row.original.referralCode}</span>,
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            active: 'bg-green-100 text-green-800',
                            frozen: 'bg-blue-100 text-blue-800',
                            pending: 'bg-yellow-100 text-yellow-800',
                        };
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}>
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
```

- [ ] **Step 3: 创建分销商详情页**

Create `packages/distribution-plugin/dashboard/distributor-detail.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { Button, DashboardRouteDefinition, DetailPage, detailPageRouteLoader, usePage } from '@vendure/dashboard';

const getDistributorDetail = graphql(`
    query GetDistributorDetail($id: ID!) {
        distributors(options: { filter: { id: { eq: $id } } }) {
            items {
                id
                customerId
                parentId
                level
                status
                totalEarnings
                availableBalance
                frozenBalance
                referralCode
                createdAt
                updatedAt
            }
            totalItems
        }
    }
`);

const approveDistributor = graphql(`
    mutation ApproveDistributor($id: ID!) {
        approveDistributor(id: $id) {
            id
            status
        }
    }
`);

const freezeDistributor = graphql(`
    mutation FreezeDistributor($id: ID!) {
        freezeDistributor(id: $id) {
            id
            status
        }
    }
`);

export const distributorDetail: DashboardRouteDefinition = {
    path: '/distributors/$id',
    loader: detailPageRouteLoader({
        queryDocument: getDistributorDetail,
        breadcrumb: (isNew, entity) => [
            { path: '/distributors', label: 'Distributors' },
            isNew ? 'New' : entity?.referralCode,
        ],
    }),
    component: route => (
        <DetailPage
            pageId="distributor-detail"
            queryDocument={getDistributorDetail}
            route={route}
            title={distributor => distributor.referralCode || distributor.id}
        />
    ),
};
```

- [ ] **Step 4: 创建佣金记录列表页**

Create `packages/distribution-plugin/dashboard/commission-record-list.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { DashboardRouteDefinition, ListPage } from '@vendure/dashboard';

const getCommissionRecords = graphql(`
    query GetCommissionRecords($options: CommissionRecordListOptions) {
        commissionRecords(options: $options) {
            items {
                id
                distributorId
                orderId
                commissionType
                commissionRate
                orderAmount
                commissionAmount
                status
                settledAt
                createdAt
            }
            totalItems
        }
    }
`);

export const commissionRecordList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'distribution',
        id: 'commission-records',
        url: '/commission-records',
        title: 'Commissions',
        requiresPermission: ['ReadCustomer'],
    },
    path: '/commission-records',
    loader: () => ({
        breadcrumb: 'Commission Records',
    }),
    component: route => (
        <ListPage
            pageId="commission-record-list"
            title={<Trans>Commission Records</Trans>}
            listQuery={getCommissionRecords}
            route={route}
            defaultVisibility={{
                commissionRate: false,
                settledAt: false,
            }}
            customizeColumns={{
                commissionType: {
                    header: 'Type',
                    cell: ({ row }) => {
                        const type = row.original.commissionType;
                        return type === 'direct' ? 'Direct' : 'Indirect';
                    },
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            pending: 'bg-yellow-100 text-yellow-800',
                            confirmed: 'bg-green-100 text-green-800',
                            paid: 'bg-blue-100 text-blue-800',
                            cancelled: 'bg-gray-100 text-gray-800',
                        };
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}>
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
```

- [ ] **Step 5: 创建提现申请列表页**

Create `packages/distribution-plugin/dashboard/withdrawal-request-list.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { Button, DashboardRouteDefinition, ListPage, usePage } from '@vendure/dashboard';
import { toast } from 'sonner';

const getWithdrawalRequests = graphql(`
    query GetWithdrawalRequests($options: WithdrawalRequestListOptions) {
        withdrawalRequests(options: $options) {
            items {
                id
                distributorId
                amount
                method
                accountInfo
                status
                reviewedAt
                paidAt
                createdAt
            }
            totalItems
        }
    }
`);

const approveWithdrawal = graphql(`
    mutation ApproveWithdrawal($id: ID!) {
        approveWithdrawal(id: $id) {
            id
            status
        }
    }
`);

const rejectWithdrawal = graphql(`
    mutation RejectWithdrawal($id: ID!) {
        rejectWithdrawal(id: $id) {
            id
            status
        }
    }
`);

const markWithdrawalPaid = graphql(`
    mutation MarkWithdrawalPaid($id: ID!) {
        markWithdrawalPaid(id: $id) {
            id
            status
        }
    }
`);

export const withdrawalRequestList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'distribution',
        id: 'withdrawal-requests',
        url: '/withdrawal-requests',
        title: 'Withdrawals',
        requiresPermission: ['ReadCustomer'],
    },
    path: '/withdrawal-requests',
    loader: () => ({
        breadcrumb: 'Withdrawal Requests',
    }),
    component: route => (
        <ListPage
            pageId="withdrawal-request-list"
            title={<Trans>Withdrawal Requests</Trans>}
            listQuery={getWithdrawalRequests}
            route={route}
            defaultVisibility={{
                reviewedAt: false,
                paidAt: false,
            }}
            customizeColumns={{
                method: {
                    header: 'Method',
                    cell: ({ row }) => {
                        const method = row.original.method;
                        const labels: Record<string, string> = { bank: 'Bank', alipay: 'Alipay', wechat: 'WeChat' };
                        return labels[method] || method;
                    },
                },
                status: {
                    header: 'Status',
                    cell: ({ row }) => {
                        const status = row.original.status;
                        const colorMap: Record<string, string> = {
                            pending: 'bg-yellow-100 text-yellow-800',
                            approved: 'bg-green-100 text-green-800',
                            rejected: 'bg-red-100 text-red-800',
                            paid: 'bg-blue-100 text-blue-800',
                        };
                        return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || ''}`}>
                                {status}
                            </span>
                        );
                    },
                },
            }}
        />
    ),
};
```

- [ ] **Step 6: 创建 Channel 详情表单扩展**

Create `packages/distribution-plugin/dashboard/channel-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const distributionChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
    },
];
```

- [ ] **Step 7: 创建 Customer 详情表单扩展**

Create `packages/distribution-plugin/dashboard/customer-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const distributionCustomerDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'customer-detail',
    },
];
```

- [ ] **Step 8: 创建 dashboard 入口文件**

Create `packages/distribution-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';
import { UserCheckIcon } from 'lucide-react';

import { commissionRecordList } from './commission-record-list';
import { distributionChannelDetailForms } from './channel-detail-forms';
import { distributionCustomerDetailForms } from './customer-detail-forms';
import { distributorDetail } from './distributor-detail';
import { distributorList } from './distributor-list';
import { withdrawalRequestList } from './withdrawal-request-list';

defineDashboardExtension({
    navSections: [
        {
            id: 'distribution',
            title: 'Distribution',
            icon: UserCheckIcon,
            order: 700,
        },
    ],
    routes: [distributorList, distributorDetail, commissionRecordList, withdrawalRequestList],
    detailForms: [...distributionChannelDetailForms, ...distributionCustomerDetailForms],
});
```

- [ ] **Step 9: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/distribution-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 10: 提交**

```bash
git add packages/distribution-plugin/dashboard/ packages/distribution-plugin/src/plugin.ts
git commit -m "feat(distribution-plugin): add dashboard UI extension for distributor, commission and withdrawal management"
```

---

### Task 8: 编译验证

- [ ] **Step 1: 启动 dev-server 验证 Dashboard 扩展编译**

```bash
cd packages/dev-server && npx ts-node -T dev-server.ts
```

验证点：
1. 服务器正常启动，无编译错误
2. Dashboard 页面可访问
3. 侧边栏出现"营销"和"分销管理"区域
4. 自提点管理出现在"设置"区域
5. 各列表页和详情页路由可访问

- [ ] **Step 2: 提交最终状态**

```bash
git add -A
git commit -m "chore: verify dashboard extensions compile and render correctly"
```
