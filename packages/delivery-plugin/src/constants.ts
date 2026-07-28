// e:\code\vendure\packages\delivery-plugin\src\constants.ts
import { PermissionDefinition } from '@vendure/core';

// 权限名常量（用于 @Allow 装饰器和 Role 映射）
export const DeliveryPermissions = {
  DeliverOrder: 'DeliverOrder',
  MarkDelivered: 'MarkDelivered',
  ReportException: 'ReportException',
  ViewAllDeliveries: 'ViewAllDeliveries',
  ReassignDelivery: 'ReassignDelivery',
  CreateOrder: 'CreateOrder',
  ViewOwnSales: 'ViewOwnSales',
  ManageCustomer: 'ManageCustomer',
  ViewSalesReport: 'ViewSalesReport',
  ViewStock: 'ViewStock',
  ManageStockMove: 'ManageStockMove',
  ManageStocktake: 'ManageStocktake',
  ManageStockIn: 'ManageStockIn',
  ManageStockOut: 'ManageStockOut',
  ViewAllOrders: 'ViewAllOrders',
  HandleAfterSales: 'HandleAfterSales',
  HandleException: 'HandleException',
  ManagePromotion: 'ManagePromotion',
  ManageContent: 'ManageContent',
  ViewDashboard: 'ViewDashboard',
  ManageProduct: 'ManageProduct',
  ManageUser: 'ManageUser',
  ViewFinance: 'ViewFinance',
  ManageMessage: 'ManageMessage',
} as const;

// 权限描述映射
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  DeliverOrder: '查看配送任务',
  MarkDelivered: '标记送达',
  ReportException: '上报异常',
  ViewAllDeliveries: '查看全部配送',
  ReassignDelivery: '改派',
  CreateOrder: '开单',
  ViewOwnSales: '查看自己的销售订单',
  ManageCustomer: '客户档案管理',
  ViewSalesReport: '业绩查询',
  ViewStock: '库存查询',
  ManageStockMove: '调拨单',
  ManageStocktake: '盘点',
  ManageStockIn: '入库',
  ManageStockOut: '出库',
  ViewAllOrders: '查看全部订单',
  HandleAfterSales: '售后处理',
  HandleException: '异常跟进',
  ManagePromotion: '营销活动',
  ManageContent: '内容管理',
  ViewDashboard: '数据看板',
  ManageProduct: '商品管理',
  ManageUser: '用户管理',
  ViewFinance: '财务概览',
  ManageMessage: '消息群发',
};

// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
export const deliveryPermissionDefinitions: PermissionDefinition[] = Object.entries(
  DeliveryPermissions,
).map(
  ([key, name]) =>
    new PermissionDefinition({
      name,
      description: PERMISSION_DESCRIPTIONS[key] ?? `Grants ${key} permission`,
    }),
);

// 状态枚举
export enum DeliveryStatus {
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Delivered = 'delivered',
  Exception = 'exception',
}

export enum ExceptionType {
  Rejected = 'rejected',
  WrongAddress = 'wrong_address',
  NoRecipient = 'no_recipient',
  Damaged = 'damaged',
  Other = 'other',
}

// Role 与 Permission 绑定表
// 所有角色必须包含 'Authenticated' 基础权限，否则无法访问任何受保护的 API
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  'delivery-staff':     ['Authenticated', 'DeliverOrder', 'MarkDelivered', 'ReportException'],
  'sales-staff':        ['Authenticated', 'CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport', 'ViewStock', 'ManageProduct'],
  'inventory-staff':    ['Authenticated', 'ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut', 'ManageProduct'],
  'customer-service':   ['Authenticated', 'ViewAllOrders', 'HandleAfterSales', 'HandleException', 'ManageCustomer', 'ManageProduct'],
  'operations-staff':   ['Authenticated', 'ManagePromotion', 'ManageContent', 'ViewDashboard'],
  'manager':            [
    'Authenticated',
    'DeliverOrder', 'MarkDelivered', 'ReportException', 'ViewAllDeliveries', 'ReassignDelivery',
    'CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport',
    'ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut',
    'ViewAllOrders', 'HandleAfterSales', 'HandleException',
    'ManagePromotion', 'ManageContent', 'ViewDashboard',
    'ManageProduct', 'ManageUser', 'ViewFinance', 'ManageMessage',
  ],
  'super-admin':        [
    'Authenticated',
    'DeliverOrder', 'MarkDelivered', 'ReportException', 'ViewAllDeliveries', 'ReassignDelivery',
    'CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport',
    'ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut',
    'ViewAllOrders', 'HandleAfterSales', 'HandleException',
    'ManagePromotion', 'ManageContent', 'ViewDashboard',
    'ManageProduct', 'ManageUser', 'ViewFinance', 'ManageMessage',
    'SuperAdmin',
  ],
};

// 模块配置（与前端 shortcuts.ts 对齐）
export const MODULE_CONFIGS = [
  { code: 'delivery',  name: '送货',  enabled: true,  entryPath: '/pkg-delivery/pages/list/index', icon: '📦', sort: 10, perms: ['DeliverOrder','MarkDelivered','ReportException','ViewAllDeliveries','ReassignDelivery'] },
  { code: 'sales',     name: '销售',  enabled: true,  entryPath: '/pkg-sales/pages/list/index',    icon: '📝', sort: 20, perms: ['CreateOrder','ViewOwnSales','ManageCustomer','ViewSalesReport'] },
  { code: 'inventory', name: '调库',  enabled: false, entryPath: '/pkg-inventory/pages/stock/index', icon: '📊', sort: 30, perms: ['ViewStock','ManageStockMove','ManageStocktake','ManageStockIn','ManageStockOut'] },
  { code: 'cs',        name: '客服',  enabled: true,  entryPath: '/pkg-cs/pages/orders/index',    icon: '🎧', sort: 40, perms: ['ViewAllOrders','HandleAfterSales','HandleException'] },
  { code: 'ops',       name: '运营',  enabled: false, entryPath: '/pkg-ops/pages/promotion/index', icon: '🎁', sort: 50, perms: ['ManagePromotion','ManageContent','ViewDashboard'] },
  { code: 'admin',     name: '管理',  enabled: false, entryPath: '/pkg-admin/pages/dashboard/index', icon: '⚙️', sort: 60, perms: ['ManageProduct','ManageUser','ViewFinance','ManageMessage','ViewDashboard'] },
  { code: 'common',    name: '通用',  enabled: true,  entryPath: '/pages/profile/index',         icon: '👤', sort: 70, perms: [] },
];
