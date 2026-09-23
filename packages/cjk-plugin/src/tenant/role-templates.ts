import { Permission } from '@vendure/core';

/**
 * 租户内置角色模板（单一来源）。
 * 官方自营租户 seed 与后续新建租户均从该模板生成角色，避免权限清单多处漂移。
 * 数据仍落成每租户独立的 Role（符合 Vendure 按 channel 授权），
 * 仅角色「定义」收敛为一处，改一处全局生效。
 */
export interface RoleTemplate {
    key: 'tenant-admin' | 'sales' | 'stock' | 'cashier';
    busiPrefix: string;
    description: string;
    permissions: string[];
}

export const OFFICIAL_ROLE_TEMPLATES: RoleTemplate[] = [
    {
        key: 'tenant-admin',
        busiPrefix: 'tenant-admin',
        description: '租户管理员',
        permissions: [
            Permission.ReadCatalog, Permission.CreateCatalog, Permission.UpdateCatalog, Permission.DeleteCatalog,
            Permission.ReadProduct, Permission.CreateProduct, Permission.UpdateProduct, Permission.DeleteProduct,
            Permission.ReadOrder, Permission.UpdateOrder, Permission.CreateOrder,
            Permission.ReadAsset, Permission.CreateAsset, Permission.UpdateAsset, Permission.DeleteAsset,
            Permission.ReadCollection, Permission.CreateCollection, Permission.UpdateCollection, Permission.DeleteCollection,
            Permission.ReadShippingMethod, Permission.CreateShippingMethod, Permission.UpdateShippingMethod, Permission.DeleteShippingMethod,
            'ShippingProfile',
            Permission.ReadPaymentMethod, Permission.CreatePaymentMethod, Permission.UpdatePaymentMethod, Permission.DeletePaymentMethod,
            // 租户物理网点管理（方案3）：仓库/网点增删改
            Permission.CreateStockLocation, Permission.UpdateStockLocation, Permission.DeleteStockLocation,
            // 收银/POS：租户管理员可操作到店自提核销收款，且可向下授权「收银员」角色
            'ManageOwnShop',
            'TenantRoleManage', 'TenantMemberManage',
            // 多人协同盘库（规格 §9）：仓管主管「能盘」+「能过账」
            'StocktakeCount', 'StocktakePost',
        ],
    },
    {
        key: 'sales',
        busiPrefix: 'sales',
        description: '销售',
        permissions: [
            Permission.ReadCatalog,
            Permission.ReadProduct, Permission.CreateProduct, Permission.UpdateProduct,
            Permission.ReadOrder, Permission.UpdateOrder, Permission.CreateOrder,
            Permission.ReadAsset, Permission.CreateAsset,
            Permission.ReadCollection,
        ],
    },
    {
        key: 'stock',
        busiPrefix: 'stock',
        description: '库存',
        permissions: [
            Permission.ReadCatalog,
            Permission.ReadProduct,
            Permission.UpdateProduct,
            Permission.ReadOrder,
            // 多人协同盘库（规格 §9）：仓管/盘点员只「能盘」，不过账
            'StocktakeCount',
        ],
    },
    {
        key: 'cashier',
        busiPrefix: 'cashier',
        description: '收银员',
        permissions: [
            Permission.ReadOrder, Permission.UpdateOrder,
            'ManageOwnShop',
        ],
    },
];