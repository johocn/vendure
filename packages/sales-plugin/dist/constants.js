"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS_MAP = exports.CustomerType = exports.SalesChannel = exports.salesPermissionDefinitions = exports.SalesPermissions = void 0;
// e:\code\vendure\packages\sales-plugin\src\constants.ts
const core_1 = require("@vendure/core");
// 权限名常量（用于 @Allow 装饰器和 Role 映射）
exports.SalesPermissions = {
    CreateOrder: 'CreateOrder',
    ViewOwnSales: 'ViewOwnSales',
    ViewAllSales: 'ViewAllSales',
    ManageCustomer: 'ManageCustomer',
    ViewSalesReport: 'ViewSalesReport',
    ModifyOrderPrice: 'ModifyOrderPrice',
};
// 权限描述映射
const PERMISSION_DESCRIPTIONS = {
    CreateOrder: '销售开单',
    ViewOwnSales: '查看自己的销售订单',
    ViewAllSales: '查看全部销售订单',
    ManageCustomer: '客户档案管理',
    ViewSalesReport: '业绩报表',
    ModifyOrderPrice: '手动改价',
};
// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
exports.salesPermissionDefinitions = Object.entries(exports.SalesPermissions).map(([key, name]) => {
    var _a;
    return new core_1.PermissionDefinition({
        name,
        description: (_a = PERMISSION_DESCRIPTIONS[key]) !== null && _a !== void 0 ? _a : `Grants ${key} permission`,
    });
});
// 销售渠道枚举
var SalesChannel;
(function (SalesChannel) {
    SalesChannel["Store"] = "store";
    SalesChannel["Telesales"] = "telesales";
    SalesChannel["B2b"] = "b2b";
})(SalesChannel || (exports.SalesChannel = SalesChannel = {}));
// 客户类型枚举
var CustomerType;
(function (CustomerType) {
    CustomerType["Individual"] = "individual";
    CustomerType["Enterprise"] = "enterprise";
})(CustomerType || (exports.CustomerType = CustomerType = {}));
// Role 与 Permission 绑定表
// 所有角色必须包含 'Authenticated' 基础权限，否则无法访问任何受保护的 API
exports.ROLE_PERMISSIONS_MAP = {
    'sales-staff': [
        'Authenticated',
        'CreateOrder',
        'ViewOwnSales',
        'ManageCustomer',
        'ViewSalesReport',
        'ModifyOrderPrice',
    ],
    'customer-service': [
        'Authenticated',
        'ViewAllOrders',
        'HandleAfterSales',
        'HandleException',
        'ManageCustomer',
    ],
    'manager': [
        'Authenticated',
        'CreateOrder', 'ViewOwnSales', 'ViewAllSales', 'ManageCustomer',
        'ViewSalesReport', 'ModifyOrderPrice',
    ],
    'super-admin': [
        'Authenticated',
        'CreateOrder', 'ViewOwnSales', 'ViewAllSales', 'ManageCustomer',
        'ViewSalesReport', 'ModifyOrderPrice',
        'SuperAdmin',
    ],
};
