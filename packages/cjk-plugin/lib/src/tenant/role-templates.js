"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFICIAL_ROLE_TEMPLATES = void 0;
const core_1 = require("@vendure/core");
exports.OFFICIAL_ROLE_TEMPLATES = [
    {
        key: 'tenant-admin',
        busiPrefix: 'tenant-admin',
        description: '租户管理员',
        permissions: [
            core_1.Permission.ReadCatalog, core_1.Permission.CreateCatalog, core_1.Permission.UpdateCatalog, core_1.Permission.DeleteCatalog,
            core_1.Permission.ReadProduct, core_1.Permission.CreateProduct, core_1.Permission.UpdateProduct, core_1.Permission.DeleteProduct,
            core_1.Permission.ReadOrder, core_1.Permission.UpdateOrder, core_1.Permission.CreateOrder,
            core_1.Permission.ReadAsset, core_1.Permission.CreateAsset, core_1.Permission.UpdateAsset, core_1.Permission.DeleteAsset,
            core_1.Permission.ReadCollection, core_1.Permission.CreateCollection, core_1.Permission.UpdateCollection, core_1.Permission.DeleteCollection,
            core_1.Permission.ReadShippingMethod, core_1.Permission.CreateShippingMethod, core_1.Permission.UpdateShippingMethod, core_1.Permission.DeleteShippingMethod,
            'ShippingProfile',
            core_1.Permission.ReadPaymentMethod, core_1.Permission.CreatePaymentMethod, core_1.Permission.UpdatePaymentMethod, core_1.Permission.DeletePaymentMethod,
            // 租户物理网点管理（方案3）：仓库/网点增删改
            core_1.Permission.CreateStockLocation, core_1.Permission.UpdateStockLocation, core_1.Permission.DeleteStockLocation,
            // 收银/POS：租户管理员可操作到店自提核销收款，且可向下授权「收银员」角色
            'ManageOwnShop',
            'TenantRoleManage', 'TenantMemberManage',
        ],
    },
    {
        key: 'sales',
        busiPrefix: 'sales',
        description: '销售',
        permissions: [
            core_1.Permission.ReadCatalog,
            core_1.Permission.ReadProduct, core_1.Permission.CreateProduct, core_1.Permission.UpdateProduct,
            core_1.Permission.ReadOrder, core_1.Permission.UpdateOrder, core_1.Permission.CreateOrder,
            core_1.Permission.ReadAsset, core_1.Permission.CreateAsset,
            core_1.Permission.ReadCollection,
        ],
    },
    {
        key: 'stock',
        busiPrefix: 'stock',
        description: '库存',
        permissions: [
            core_1.Permission.ReadCatalog,
            core_1.Permission.ReadProduct,
            core_1.Permission.UpdateProduct,
            core_1.Permission.ReadOrder,
        ],
    },
    {
        key: 'cashier',
        busiPrefix: 'cashier',
        description: '收银员',
        permissions: [
            core_1.Permission.ReadOrder, core_1.Permission.UpdateOrder,
            'ManageOwnShop',
        ],
    },
];
//# sourceMappingURL=role-templates.js.map