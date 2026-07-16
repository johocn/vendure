# 自提点管理 UI 按钮补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在自提点列表页补齐新建按钮和行内删除按钮，让管理员能通过 Dashboard 界面直接管理自提点。

**Architecture:** 仅修改 1 个文件 `pickup-location-list.tsx`。列表页通过 `ActionBarItem` + `<Link to="./new">` 添加新建按钮（跳转到 DetailPage 的新建模式）；通过 `customizeColumns` 追加操作列，行内用 `PermissionGuard` 包裹删除按钮（调用 `deletePickupLocation` mutation）。详情页保持不变。

**Tech Stack:** React + Vendure Dashboard (ListPage, ActionBarItem, PermissionGuard, Button, toast, api) + TanStack Router (Link) + TanStack Query (useMutation, useQueryClient)

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx` | 修改 | 添加新建按钮 + 行内删除按钮 + deletePickupLocation mutation |

---

## 关键约束（已验证）

1. **导入路径**：所有 Dashboard 组件从 `@vendure/dashboard` 导入（参考 [payment-config-widget.tsx](file:///e:/code/vendure/packages/cjk-plugin/dashboard/payment-config-widget.tsx) 模式）。`@tanstack/react-router`、`@tanstack/react-query`、`lucide-react` 是 npm 包，Vite 会从 node_modules 解析。
2. **Dashboard 编译方式**：cjk-plugin 的 `npm run build` 只编译后端（`tsconfig.build.json` 的 `files: ["./index.ts"]`）。Dashboard tsx 文件由 dev-server 的 Vite 插件 `vendureDashboardPlugin` 直接编译，无需 `npm run build`。
3. **Button 不支持 requiresPermission**：`Button` 组件是纯 UI 组件（见 [button.tsx](file:///e:/code/vendure/packages/dashboard/src/lib/components/ui/button.tsx)），权限控制必须用 `PermissionGuard` 包裹（见 [permission-guard.tsx](file:///e:/code/vendure/packages/dashboard/src/lib/components/shared/permission-guard.tsx)）。
4. **`api`、`ActionBarItem`、`PermissionGuard`、`Button`、`toast` 均从 `@vendure/dashboard` 导出**（见 [lib/index.ts](file:///e:/code/vendure/packages/dashboard/src/lib/index.ts)）。
5. **`graphql` 从 `@vendure/dashboard` 导出**，不是 `@/graphql/graphql`（cjk-plugin dashboard 无此路径别名）。

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

Expected: 文件包含 `ListPage` 组件，当前 `customizeColumns` 配置了 id 和 name 两列，但没有 ActionBarItem 子组件和删除功能。`graphql` 从 `@/graphql/graphql` 导入（需改为 `@vendure/dashboard`）。

- [ ] **Step 2: 用完整新内容覆盖 pickup-location-list.tsx**

将 `pickup-location-list.tsx` 完整内容替换为：

```tsx
import {
    ActionBarItem,
    api,
    Button,
    DashboardRouteDefinition,
    DetailPageButton,
    graphql,
    ListPage,
    PermissionGuard,
    toast,
} from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PlusIcon, Trash2 } from 'lucide-react';

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
    component: route => <PickupLocationListPage route={route} />,
};

function PickupLocationListPage({ route }: { route: any }) {
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.mutate(deletePickupLocationDocument, { id }),
        onSuccess: () => {
            toast.success('删除成功');
            queryClient.invalidateQueries();
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
                        <PermissionGuard requires={['PickupLocationDelete']}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(row.original.id)}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </PermissionGuard>
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
1. 所有导入统一从 `@vendure/dashboard` 获取（`api`、`Button`、`PermissionGuard`、`toast`、`graphql`、`ActionBarItem`）
2. `@tanstack/react-router` 的 `Link` 和 `@tanstack/react-query` 的 `useMutation`/`useQueryClient` 直接 import（npm 包，Vite 解析）
3. 新增 `deletePickupLocationDocument` GraphQL mutation
4. 将 `component` 从内联 JSX 改为独立函数组件 `PickupLocationListPage`（因为需要 hooks）
5. 删除按钮用 `PermissionGuard` 包裹（Button 不支持 requiresPermission 属性）
6. 新建按钮用 `ActionBarItem` 的 `requiresPermission` 控制（ActionBarItem 支持此属性）
7. 用 `queryClient.invalidateQueries()` 替代 `window.location.reload()` 刷新列表

- [ ] **Step 3: 验证 Vite dev server 自动编译**

Dashboard dev server（Vite）会自动检测文件变更并热更新。如果 dev server 未运行，启动：

```bash
cd e:\code\vendure\packages\dev-server && npm run dashboard:dev
```

Expected: Vite dev server 启动或已运行时自动热更新，无编译错误。

注意：**不需要**运行 `cd packages/cjk-plugin && npm run build`，因为 dashboard tsx 文件由 Vite 编译，cjk-plugin 的 build 只编译后端 TypeScript。

- [ ] **Step 4: 验证后端 GraphQL schema 中 deletePickupLocation 可用**

如果后端 dev-server 未运行，启动：

```bash
cd e:\code\vendure\packages\dev-server && npm run dev
```

通过 API 验证 schema：

```bash
$query = '{"query":"query{__type(name:\"Mutation\"){fields{name}}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $query -ContentType 'application/json' -WebSession $session
$r.data.__type.fields | Where-Object { $_.name -like '*PickupLocation*' } | Select-Object name
```

Expected: 输出包含 `createPickupLocation`、`updatePickupLocation`、`deletePickupLocation`。

- [ ] **Step 5: 浏览器验证列表页 UI**

访问 `http://localhost:5173/dashboard/pickup-locations`

Expected:
1. 页面标题 "Pickup Locations"
2. 右上角可见"新建自提点"按钮（带 + 图标）
3. 列表显示 3 条双阳区测试数据（双阳商城店、菜鸟驿站双阳泰山店、长春科技学院自提点）
4. 每行右侧有删除按钮（垃圾桶图标）
5. 操作列标题为"操作"

- [ ] **Step 6: 浏览器验证新建功能**

1. 点击"新建自提点"按钮
2. 验证跳转到 `http://localhost:5173/dashboard/pickup-locations/new`
3. 详情页显示空表单
4. 填写 name=测试自提点, type=store, address=测试地址
5. 点击 Create 按钮提交
6. 验证跳转回列表页，且新记录出现在列表中

Expected: 新建成功，列表页显示 4 条记录。

- [ ] **Step 7: 浏览器验证删除功能**

1. 在列表页找到刚创建的"测试自提点"
2. 点击该行的删除按钮（垃圾桶图标）
3. 验证弹出确认对话框"确认删除此自提点?"
4. 点击确认
5. 验证 toast 提示"删除成功"
6. 验证列表自动刷新后该记录已消失

Expected: 删除成功，列表页恢复为 3 条记录。

- [ ] **Step 8: 提交代码**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/pickup-location-list.tsx
git commit -m "feat: add create and delete buttons to pickup location list

- Add ActionBarItem with Link to './new' for creating new pickup location
- Add actions column with delete button calling deletePickupLocation mutation
- Refactor component to standalone function to support hooks (useMutation)
- Permission guarded: PickupLocationCreate for new button, PickupLocationDelete for delete button
- Use queryClient.invalidateQueries for list refresh"
```

Expected: 提交成功。

---

## Self-Review

### Spec coverage
- ✅ 列表页新增按钮 → Task 1 Step 2 的 ActionBarItem
- ✅ 列表页行内删除按钮 → Task 1 Step 2 的 actions 列
- ✅ 详情页不变 → 计划未修改 pickup-location-detail.tsx
- ✅ 权限 PickupLocationCreate → Step 2 的 ActionBarItem requiresPermission
- ✅ 权限 PickupLocationDelete → Step 2 的 PermissionGuard 包裹删除按钮
- ✅ deletePickupLocation mutation → Step 2 的 deletePickupLocationDocument

### Placeholder scan
- ✅ 无 TBD/TODO
- ✅ 所有代码完整
- ✅ 所有命令完整

### Type consistency
- ✅ `deletePickupLocation(id: ID!): Boolean!` 与 schema 一致
- ✅ `PickupLocationCreate` / `PickupLocationDelete` 与 pickup-permissions.ts 一致
- ✅ `api.mutate` 返回值未使用（mutation 返回 Boolean），符合预期

### 卡点修复记录
1. ❌ 原方案 `import { api } from '@/vdb/graphql/api'` → ✅ 修复为 `import { api } from '@vendure/dashboard'`
2. ❌ 原方案 `import { Button } from '@/vdb/components/ui/button'` → ✅ 修复为 `import { Button } from '@vendure/dashboard'`
3. ❌ 原方案 `import { graphql } from '@/graphql/graphql'` → ✅ 修复为 `import { graphql } from '@vendure/dashboard'`
4. ❌ 原方案 `import { toast } from 'sonner'` → ✅ 修复为 `import { toast } from '@vendure/dashboard'`
5. ❌ 原方案 Button 上写 `requiresPermission` → ✅ 修复为用 `PermissionGuard` 包裹
6. ❌ 原方案 `window.location.reload()` → ✅ 修复为 `queryClient.invalidateQueries()`
7. ❌ 原方案要求 `npm run build` 编译 cjk-plugin → ✅ 修复为不需要 build（dashboard 由 Vite 编译）
8. ❌ 原方案 `git add packages/cjk-plugin/dist` → ✅ 修复为只 add dashboard tsx 文件（dist 不含 dashboard）
