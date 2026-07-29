// e:\code\vendure\packages\sales-plugin\src\constants.ts
import { PermissionDefinition } from '@vendure/core';

// 权限名常量（用于 @Allow 装饰器和 Role 映射）
export const SalesPermissions = {
  CreateOrder: 'CreateOrder',
  ViewOwnSales: 'ViewOwnSales',
  ViewAllSales: 'ViewAllSales',
  ManageCustomer: 'ManageCustomer',
  ViewSalesReport: 'ViewSalesReport',
  ModifyOrderPrice: 'ModifyOrderPrice',
} as const;

// 权限描述映射
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  CreateOrder: '销售开单',
  ViewOwnSales: '查看自己的销售订单',
  ViewAllSales: '查看全部销售订单',
  ManageCustomer: '客户档案管理',
  ViewSalesReport: '业绩报表',
  ModifyOrderPrice: '手动改价',
};

// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
export const salesPermissionDefinitions: PermissionDefinition[] = Object.entries(
  SalesPermissions,
).map(
  ([key, name]) =>
    new PermissionDefinition({
      name,
      description: PERMISSION_DESCRIPTIONS[key] ?? `Grants ${key} permission`,
    }),
);

// 销售渠道枚举
export enum SalesChannel {
  Store = 'store',
  Telesales = 'telesales',
  B2b = 'b2b',
}

// 客户类型枚举
export enum CustomerType {
  Individual = 'individual',
  Enterprise = 'enterprise',
}

// Role 与 Permission 绑定表
// 所有角色必须包含 'Authenticated' 基础权限，否则无法访问任何受保护的 API
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
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
