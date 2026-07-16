# 自提点管理 UI 按钮补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在自提点列表页补齐新建按钮和行内删除按钮，让管理员能通过 Dashboard 界面直接管理自提点。

**Architecture:** 仅修改 1 个文件 `pickup-location-list.tsx`。列表页通过 `ActionBarItem` + `<Link to="./new">` 添加新建按钮（跳转到 DetailPage 的新建模式）；通过 `customizeColumns` 追加操作列，行内调用 `deletePickupLocation` mutation 实现删除。详情页保持不变。

**Tech Stack:** React + Vendure Dashboard (ListPage, ActionBarItem) + TanStack Router (Link) + TanStack Query (useMutation) + graphql-request (gql tag)

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx` | 修改 | 添加新建按钮 + 行内删除按钮 + deletePickupLocation mutation |

---

## 参考文档

- Spec: `e:\code\vendure\docs\superpowers\specs\2026-07-16-pickup-location-ui-buttons-design.md`
- 参考实现: `e:\code\vendure\packages\dashboard\src\app\routes\_authenticated\_products\products.tsx:114-119` (ActionBarItem + Link to "./new" 模式)
- 权限定义: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-permissions.ts:5-7` (`PickupLocationCreate` / `PickupLocationDelete`)
- GraphQL schema: `e:\code\vendure\packages\cjk-plugin\src\plugin.ts:111` (`deletePickupLocation(id: ID!): Boolean!`)

---

## Task 1: 在列表页添加新建按钮和删除功能

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx`

- [ ] **Step 1: 读取当前 pickup-location-list.tsx 内容**

Run: `Read e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx`

Expected: 文件包含 `ListPage` 组件，当前 `customizeColumns` 配置了 id 和 name 两列，但没有 ActionBarItem 子组件和删除功能。

- [ ] **Step 2: 用完整新内容覆盖 pickup-location-list.tsx**

将 `pickup-location-list.tsx` 完整内容替换为：

```tsx
import { api } from '@/vdb/graphql/api';
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { DashboardRouteDefinition, DetailPageButton, ListPage } from '@vendure/dashboard';
import { ActionBarItem } from '@vendure/dashboard';
import { Button } from '@/vdb/components/ui/button';
import { Link } from '@tanstack/react-router';
import { PlusIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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

const deletePickupLocationDocument = graphql(`
    mutation DeletePickupLocation($id: ID!) {
        deletePickupLocation(id: $id)
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
        <PickupLocationListPage route={route} />
    ),
};

function PickupLocationListPage({ route }: { route: any }) {
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.mutate(deletePickupLocationDocument, { id }),
        onSuccess: () => {
            toast.success('删除成功');
            window.location.reload();
        },
        onError: (error: any) => {
            toast.error('删除失败: ' + (error?.message || '未知错误'));
        },
    });

    const handleDelete = (id: string) => {
        if (window.confirm('确认删除此自提点?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
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
                actions: {
                    header: '操作',
                    cell: ({ row }) => (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(row.original.id)}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    ),
                },
            }}
        >
            <ActionBarItem itemId="create-button" requiresPermission={['PickupLocationCreate']}>
                <Button render={<Link to="./new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    <Trans>新建自提点</Trans>
                </Button>
            </ActionBarItem>
        </ListPage>
    );
}
```

**关键改动说明:**
1. 新增 `deletePickupLocationDocument` GraphQL mutation
2. 将 `component` 从内联 JSX 改为独立函数组件 `PickupLocationListPage`（因为需要 hooks）
3. 新增 `actions` 列在 `customizeColumns`，使用 `Trash2` 图标的删除按钮
4. 在 `ListPage` children 中添加 `ActionBarItem` + `Link to="./new"` 的新建按钮
5. 权限 `PickupLocationCreate` 对应 [pickup-permissions.ts](file:///e:/code/vendure/packages/cjk-plugin/src/pickup/pickup-permissions.ts) 定义

- [ ] **Step 3: 编译 cjk-plugin**

Run:
```bash
cd e:\code\vendure\packages\cjk-plugin && npm run build
```

Expected: 编译成功，无 TypeScript 错误。如果出现 `api` 或 `@/vdb/graphql/api` 导入路径错误，需要调整导入路径。

- [ ] **Step 4: 检查编译输出**

Run:
```bash
cd e:\code\vendure\packages\cjk-plugin && dir dashboard\pickup-location-list.js
```

Expected: `dist/dashboard/pickup-location-list.js` 文件存在且时间戳为最新。

- [ ] **Step 5: 重启 dev-server（如运行中）并验证编译**

如果 dev-server 正在运行（job `37d20f7a38ce4c998866c6b9a9581683`），先停止后重启：

Run:
```bash
cd e:\code\vendure\packages\dev-server && npm run dev
```

Expected: 后端启动无错误，GraphiQL 可访问。

- [ ] **Step 6: 验证 GraphQL schema 中 deletePickupLocation 可用**

通过 GraphiQL 或 API 验证：

```bash
$body = '{"query":"query{__type(name:\"Mutation\"){fields{name}}}"}'
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $body -ContentType 'application/json'
$r.data.__type.fields | Where-Object { $_.name -like '*PickupLocation*' }
```

Expected: 输出包含 `createPickupLocation`、`updatePickupLocation`、`deletePickupLocation`。

- [ ] **Step 7: 启动 Dashboard dev server 验证 UI**

如果 Dashboard dev server 未运行，启动：

```bash
cd e:\code\vendure\packages\dev-server && npm run dashboard:dev
```

Expected: Vite dev server 启动成功，无编译错误。

- [ ] **Step 8: 浏览器验证列表页 UI**

访问 `http://localhost:5173/dashboard/pickup-locations`

Expected:
1. 页面标题 "Pickup Locations"
2. 右上角可见"新建自提点"按钮（带 + 图标）
3. 列表显示 3 条双阳区测试数据（双阳商城店、菜鸟驿站双阳泰山店、长春科技学院自提点）
4. 每行右侧有删除按钮（垃圾桶图标）
5. 操作列标题为"操作"

- [ ] **Step 9: 浏览器验证新建功能**

1. 点击"新建自提点"按钮
2. 验证跳转到 `http://localhost:5173/dashboard/pickup-locations/new`
3. 详情页显示空表单
4. 填写 name=测试自提点, type=store, address=测试地址
5. 点击 Create 按钮提交
6. 验证跳转回列表页，且新记录出现在列表中

Expected: 新建成功，列表页显示 4 条记录。

- [ ] **Step 10: 浏览器验证删除功能**

1. 在列表页找到刚创建的"测试自提点"
2. 点击该行的删除按钮（垃圾桶图标）
3. 验证弹出确认对话框"确认删除此自提点?"
4. 点击确认
5. 验证页面刷新后该记录已消失

Expected: 删除成功，列表页恢复为 3 条记录。

- [ ] **Step 11: 提交代码**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/pickup-location-list.tsx packages/cjk-plugin/dist
git commit -m "feat: add create and delete buttons to pickup location list

- Add ActionBarItem with Link to './new' for creating new pickup location
- Add actions column with delete button calling deletePickupLocation mutation
- Refactor component to standalone function to support hooks (useMutation)
- Permission guarded: PickupLocationCreate for new button"
```

Expected: 提交成功。

---

## Self-Review

### Spec coverage
- ✅ 列表页新增按钮 → Task 1 Step 2 的 ActionBarItem
- ✅ 列表页行内删除按钮 → Task 1 Step 2 的 actions 列
- ✅ 详情页不变 → 计划未修改 pickup-location-detail.tsx
- ✅ 权限 PickupLocationCreate → Step 2 的 requiresPermission
- ✅ deletePickupLocation mutation → Step 2 的 deletePickupLocationDocument

### Placeholder scan
- ✅ 无 TBD/TODO
- ✅ 所有代码完整
- ✅ 所有命令完整

### Type consistency
- ✅ `deletePickupLocation(id: ID!): Boolean!` 与 schema 一致
- ✅ `PickupLocationCreate` 与 pickup-permissions.ts 一致
- ✅ `api.mutate` 返回值未使用（mutation 返回 Boolean），符合预期

### 潜在风险
1. **导入路径**: `@/vdb/graphql/api` 和 `@/vdb/components/ui/button` 路径基于 products.tsx 参考，cjk-plugin 的 tsconfig 可能配置不同。Step 3 编译时如失败，需检查 cjk-plugin 的 dashboard tsconfig 路径别名。
2. **window.location.reload**: 简单粗暴的刷新方式。如果 ListPage 提供 refetch 方法更优雅，但为了最小改动先用 reload。
3. **window.confirm**: 原生 confirm 对话框。Dashboard 可能有自己的 Dialog 组件，但为了最小改动先用原生。
