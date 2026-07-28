"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_CONFIGS = exports.ROLE_PERMISSIONS_MAP = exports.ExceptionType = exports.DeliveryStatus = exports.deliveryPermissionDefinitions = exports.DeliveryPermissions = void 0;
// e:\code\vendure\packages\delivery-plugin\src\constants.ts
const core_1 = require("@vendure/core");
// 权限名常量（用于 @Allow 装饰器和 Role 映射）
exports.DeliveryPermissions = {
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
    ManageBanner: 'ManageBanner',
    ManageRecommendation: 'ManageRecommendation',
    ManageNotice: 'ManageNotice',
    ManageFloor: 'ManageFloor',
    ManageFlashSale: 'ManageFlashSale',
    ManageGroupBuy: 'ManageGroupBuy',
    ManageCoupon: 'ManageCoupon',
};
// 权限描述映射
const PERMISSION_DESCRIPTIONS = {
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
    ManageBanner: 'Banner 轮播管理',
    ManageRecommendation: '推荐位管理',
    ManageNotice: '公告/弹窗管理',
    ManageFloor: '首页楼层管理',
    ManageFlashSale: '闪购活动管理',
    ManageGroupBuy: '拼团活动管理',
    ManageCoupon: '优惠券管理',
};
// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
exports.deliveryPermissionDefinitions = Object.entries(exports.DeliveryPermissions).map(([key, name]) => {
    var _a;
    return new core_1.PermissionDefinition({
        name,
        description: (_a = PERMISSION_DESCRIPTIONS[key]) !== null && _a !== void 0 ? _a : `Grants ${key} permission`,
    });
});
// 状态枚举
var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["Assigned"] = "assigned";
    DeliveryStatus["InProgress"] = "in_progress";
    DeliveryStatus["Delivered"] = "delivered";
    DeliveryStatus["Exception"] = "exception";
})(DeliveryStatus || (exports.DeliveryStatus = DeliveryStatus = {}));
var ExceptionType;
(function (ExceptionType) {
    ExceptionType["Rejected"] = "rejected";
    ExceptionType["WrongAddress"] = "wrong_address";
    ExceptionType["NoRecipient"] = "no_recipient";
    ExceptionType["Damaged"] = "damaged";
    ExceptionType["Other"] = "other";
})(ExceptionType || (exports.ExceptionType = ExceptionType = {}));
// Role 与 Permission 绑定表
// 所有角色必须包含 'Authenticated' 基础权限，否则无法访问任何受保护的 API
exports.ROLE_PERMISSIONS_MAP = {
    'delivery-staff': ['Authenticated', 'DeliverOrder', 'MarkDelivered', 'ReportException'],
    'sales-staff': ['Authenticated', 'CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport', 'ViewStock', 'ManageProduct'],
    'inventory-staff': ['Authenticated', 'ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut', 'ManageProduct'],
    'customer-service': ['Authenticated', 'ViewAllOrders', 'HandleAfterSales', 'HandleException', 'ManageCustomer', 'ManageProduct'],
    'operations-staff': ['Authenticated', 'ViewDashboard', 'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor', 'ManagePromotion', 'ManageContent', 'ManageFlashSale', 'ManageGroupBuy', 'ManageCoupon'],
    'manager': [
        'Authenticated',
        'DeliverOrder', 'MarkDelivered', 'ReportException', 'ViewAllDeliveries', 'ReassignDelivery',
        'CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport',
        'ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut',
        'ViewAllOrders', 'HandleAfterSales', 'HandleException',
        'ManagePromotion', 'ManageContent', 'ViewDashboard',
        'ManageProduct', 'ManageUser', 'ViewFinance', 'ManageMessage',
        'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor',
        'ManageFlashSale', 'ManageGroupBuy', 'ManageCoupon',
    ],
    'super-admin': [
        'Authenticated',
        'DeliverOrder', 'MarkDelivered', 'ReportException', 'ViewAllDeliveries', 'ReassignDelivery',
        'CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport',
        'ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut',
        'ViewAllOrders', 'HandleAfterSales', 'HandleException',
        'ManagePromotion', 'ManageContent', 'ViewDashboard',
        'ManageProduct', 'ManageUser', 'ViewFinance', 'ManageMessage',
        'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor',
        'ManageFlashSale', 'ManageGroupBuy', 'ManageCoupon',
        'SuperAdmin',
    ],
};
// 模块配置（与前端 shortcuts.ts 对齐）
exports.MODULE_CONFIGS = [
    { code: 'delivery', name: '送货', enabled: true, entryPath: '/pkg-delivery/pages/list/index', icon: '📦', sort: 10, perms: ['DeliverOrder', 'MarkDelivered', 'ReportException', 'ViewAllDeliveries', 'ReassignDelivery'] },
    { code: 'sales', name: '销售', enabled: true, entryPath: '/pkg-sales/pages/list/index', icon: '📝', sort: 20, perms: ['CreateOrder', 'ViewOwnSales', 'ManageCustomer', 'ViewSalesReport'] },
    { code: 'inventory', name: '调库', enabled: true, entryPath: '/pkg-inventory/pages/stock/index', icon: '📊', sort: 30, perms: ['ViewStock', 'ManageStockMove', 'ManageStocktake', 'ManageStockIn', 'ManageStockOut'] },
    { code: 'cs', name: '客服', enabled: true, entryPath: '/pkg-cs/pages/orders/index', icon: '🎧', sort: 40, perms: ['ViewAllOrders', 'HandleAfterSales', 'HandleException'] },
    { code: 'ops', name: '运营', enabled: true, entryPath: '/pkg-ops/pages/dashboard/index', icon: '📊', sort: 50, perms: ['ViewDashboard', 'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor', 'ManagePromotion', 'ManageContent'] },
    { code: 'admin', name: '管理', enabled: false, entryPath: '/pkg-admin/pages/dashboard/index', icon: '⚙️', sort: 60, perms: ['ManageProduct', 'ManageUser', 'ViewFinance', 'ManageMessage', 'ViewDashboard'] },
    { code: 'common', name: '通用', enabled: true, entryPath: '/pages/profile/index', icon: '👤', sort: 70, perms: [] },
];
