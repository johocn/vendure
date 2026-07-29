// 简单测试 admin-api 是否包含 myPermissions / myDeliveries 等自定义查询
const http = require('http');

const body = JSON.stringify({
  query: `{ __type(name: "Query") { fields { name } } }`,
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/admin-api',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const fields = json?.data?.__type?.fields ?? [];
      const names = fields.map(f => f.name).sort();
      console.log('Query fields count:', names.length);
      const deliveryRelated = names.filter(n =>
        n.toLowerCase().includes('deliv') || n.toLowerCase().includes('perm')
      );
      console.log('Delivery/Permission related:', deliveryRelated);
      // 输出所有自定义查询（过滤掉标准查询）
      const standard = new Set([
        'administrators','administrator','administratorsInRole','roles','role','channels','channel',
        'countries','country','zones','zone','taxCategories','taxCategory','taxRates','taxRate',
        'paymentMethods','paymentMethod','shippingMethods','shippingMethod','products','product',
        'productVariants','productVariant','collections','collection','assets','asset','facets',
        'facet','facetValues','search','searchSuggestions','orders','order','activeOrder',
        'activeCustomer','customers','customer','customerGroups','customerGroup','promotions',
        'promotion','sellers','seller','stocks','stockMovements','stockMovementsByProduct',
        'stockLocations','stockLocation','globalSettings','serverInfo','userStatus','userStatusList',
        'tags','tag','testServers','testEntity','testEntities','testOrderStates','settings',
        'jobQueue','jobs','pendingJobs','jobQueues','jobsById','history','isChannelAware',
        'configurableOperations','customFieldConfig','entityCustomFields','collectionContents',
        'paymentMethodEligibility','shippingMethodEligibility','eligibilityFlags','availableCountries',
        'availablePaymentMethods','availableShippingMethods','eligibleShippingMethods','nextOrderStates',
        'nextStates','productVariantList','productsInCollection','session','sessionCacheSize',
        'administratorsInRoleCount','rolesInChannel','permissionsInRole','me','currentUser',
        'attachments','shippingEligibility','memberLevels','memberLevel','afterSales','afterSalesReasons',
        'afterSalesReason','rechargeCards','rechargeCard','coupons','coupon','reviews','review',
        'reviewSummary','flashSales','flashSale','groupBuys','groupBuy','distributions','distribution',
        'invoices','invoice','logisticsCompanies','logisticsCompany','logisticsTracks','logisticsTrack',
        'memberLevelBenefits','memberLevelPrices','orderTimeout','orderTimeouts','wechatSubscribeMessageTemplates',
        'wechatSubscribeMessageTemplate','cjkRegions','cjkRegion','cjkTenants','cjkTenant','promotionPolicies',
        'promotionPolicy','ossConfig','smsConfig','wechatAuthConfig','douyinAuthConfig','dashboardData',
        'dashboardStats','dashboardSales','dashboardOrders','dashboardCustomers','dashboardProducts',
        'floorBuilder','floorLayouts','floorLayout','navItems','navItem','readonlyTest','settingsStore',
        'allJobQueues','jobQueueDefs','runningJobs','notifications','notification','unreadNotificationCount',
        'systemStatus','metrics','metricSummary','metricSeries','metricList','metricDefinitions','searchStats',
        '_indexes','reindex','indexing','indices','refreshedIndices','indicesInfo','pendingSearchIndexUpdates',
        'inventoryMovements','inventoryItems','inventoryStockLocations','stockLevels','stockLevel',
        'fulfillmentMethods','fulfillmentMethod','orderFulfillments','orderFulfillment','fulfillmentOrder',
        'stockMovementReasons','stockMovementReason','productOptionGroups','productOptionGroup',
        'productOptions','productOption','variants','variant','productsForSelector','collectionsForSelector',
        'channelsInRole','rolesInUser','usersInRole','userRoles','userRole','permissions','permission',
        'authProviders','authProvider','authStrategies','authStrategy','authState','meAdmin',
        'currentAdministrator','administratorsActive','administratorCount','customerCount','orderCount',
        'productCount','stockItemCount','fulfillmentCount','paymentCount','refundCount','promotionCount',
        'collectionCount','facetCount','assetCount','channelCount','sellerCount','roleCount','customerGroupCount',
        'shippingMethodCount','paymentMethodCount','countryCount','zoneCount','taxCategoryCount','taxRateCount',
        'shippingMethodAssignmentCount','paymentMethodAssignmentCount','promotionAssignmentCount',
        'collectionAssignmentCount','facetAssignmentCount','productAssignmentCount','productVariantAssignmentCount',
        'stockLocationCount','stockMovementCount','inventoryMovementCount','orderLineCount','orderItemCount',
        'administratorRoles','customerGroupsForCustomer','channelsForRole','channelsForAdministrator',
        'rolesForAdministrator','permissionsForRole','permissionsForAdministrator','administratorsForRole',
      ]);
      const custom = names.filter(n => !standard.has(n));
      console.log('Non-standard queries (likely custom):', custom);
    } catch (e) {
      console.error('Parse error:', e.message);
      console.error('Raw response (first 500):', data.slice(0, 500));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(body);
req.end();
