# 自提点管理 UI 按钮补齐设计

## 背景

当前 Dashboard 的自提点列表页（`/pickup-locations`）缺少新建按钮，无法通过界面创建自提点。后端 CRUD mutation 已就绪，但 UI 未对接。

## 目标

补齐列表页的新建按钮和行内删除按钮，让管理员能在界面上直接管理自提点。详情页保持不变（已有 Update 按钮）。

## 改动范围

仅修改 1 个文件：`e:\code\vendure\packages\cjk-plugin\dashboard\pickup-location-list.tsx`

## 设计

### 列表页新增按钮

在 `ListPage` 的 children 中传入两个 `ActionBarItem`：

```tsx
<ActionBarItem itemId="create-button" requiresPermission={['PickupLocationCreate']}>
    <Button render={<Link to="./new" />}>
        <PlusIcon className="mr-2 h-4 w-4" />
        <Trans>新建自提点</Trans>
    </Button>
</ActionBarItem>
```

- 路由 `./new` 对应详情页路由 `/pickup-locations/$id`，其中 `id=new` 触发 `DetailPage` 的新建模式（`params.id === NEW_ENTITY_PATH`）
- 权限 `PickupLocationCreate` 对应 [pickup-permissions.ts](file:///e:/code/vendure/packages/cjk-plugin/src/pickup/pickup-permissions.ts) 中定义的 `CreatePickupLocation`

### 列表页行内删除按钮

在 `customizeColumns` 中追加 `actions` 操作列：

```tsx
actions: {
    header: '操作',
    cell: ({ row }) => (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
            requiresPermission={['PickupLocationDelete']}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    ),
},
```

`handleDelete` 调用 `deletePickupLocation` mutation，成功后 toast 提示并刷新列表。

### deletePickupLocation mutation

```graphql
mutation DeletePickupLocation($id: ID!) {
    deletePickupLocation(id: $id)
}
```

### 详情页不变

`pickup-location-detail.tsx` 保持现状，`DetailPage` 组件已内置 Update 按钮，新建模式下显示 Create。

## 权限

| 操作 | 权限 | superadmin | tenant-admin |
|------|------|------------|--------------|
| 新建 | PickupLocationCreate | ✅ | ✅ |
| 删除 | PickupLocationDelete | ✅ | ✅ |
| 修改 | PickupLocationUpdate | ✅ | ✅ |

## 不做

- 不改详情页（不加删除按钮）
- 不加批量删除
- 不加 promoteToPublic 按钮（SuperAdmin 专属，通过 API 调用即可）
- 不加中文化（标题保持英文 "Pickup Locations"，后续统一国际化）

## 验证

1. 列表页可见"新建自提点"按钮
2. 点击按钮跳转到 `/pickup-locations/new`，详情页显示空表单 + Create 按钮
3. 填写表单提交后，返回列表页可见新记录
4. 列表页每行有删除按钮，点击后记录被删除
