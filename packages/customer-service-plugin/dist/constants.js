"use strict";
// e:\code\vendure\packages\customer-service-plugin\src\constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS_MAP = exports.CustomerServicePermissions = void 0;
// 权限名常量（引用 delivery-plugin 中已注册的权限，此处不重复注册 PermissionDefinition）
// 仅定义字符串常量供 @Allow 装饰器和 ROLE_PERMISSIONS_MAP 使用
exports.CustomerServicePermissions = {
    ViewAllOrders: 'ViewAllOrders',
    HandleAfterSales: 'HandleAfterSales',
    HandleException: 'HandleException',
    ManageCustomer: 'ManageCustomer',
};
// Role 与 Permission 绑定表（增量同步：已存在的角色仅补绑缺失权限）
// customer-service 角色已在 delivery-plugin 中定义，这里做权限绑定同步
exports.ROLE_PERMISSIONS_MAP = {
    'customer-service': [
        'Authenticated',
        'ViewAllOrders',
        'HandleAfterSales',
        'HandleException',
        'ManageCustomer',
    ],
    'manager': [
        'Authenticated',
        'ViewAllOrders',
        'HandleAfterSales',
        'HandleException',
        'ManageCustomer',
    ],
    'super-admin': [
        'Authenticated',
        'ViewAllOrders',
        'HandleAfterSales',
        'HandleException',
        'ManageCustomer',
        'SuperAdmin',
    ],
};
