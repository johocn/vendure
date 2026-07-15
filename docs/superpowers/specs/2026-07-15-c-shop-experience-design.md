# C 端体验增强：微信登录修复、分享扩展、商品海报、邀请码归因闭环

- **日期**：2026-07-15
- **状态**：已批准（待用户审阅）
- **范围**：vshop 前端 + vendure 后端（wechat-auth-plugin、distribution-plugin）
- **不包含**：后台租户支付设置页（独立 spec 处理）

## 背景

当前 C 端存在以下问题：

1. **微信登录不可用**：`VITE_WECHAT_APP_ID` 环境变量为空，登录按钮 `v-if` 永假；静默授权 `result.userId` 为空时无反馈，可能循环跳转。
2. **分享覆盖有限**：仅商品详情页接入分享，首页、活动页、优惠券页未接入；SPA 路由切换时 `resetWxReady()` 未调用，签名 URL 可能失效。
3. **商品海报缺失**：完全未实现，无 canvas/html-to-image 等依赖，无相关组件。
4. **邀请码归因断裂**：前端能捕获和拼接邀请码，但后端 `customer.customFields.referralCode` 无写入路径，注册/登录时未传递 ref 码，导致佣金归因逻辑无法生效。

## 目标

- 修复微信登录可用性，AppId 从后端 authConfig 获取
- 分享扩展到首页、活动页（秒杀/拼团）、优惠券页
- 实现商品海报生成（H5 html-to-image + 小程序 canvas），含小程序码/二维码
- 修复邀请码归因闭环（3 处断裂点）
- 后端新增 wxacode 服务，支持租户级凭证隔离

## 非目标（YAGNI）

- 不引入后台分享文案/海报模板配置 UI
- 不引入数据埋点
- 不实现多模板海报
- 不实现短码映射服务（slug 超长时截断处理）
- 不实现 Redis 频次限流（内存计数器足够）
- 不强制统一前后端命名（通过接口层映射）

## 整体架构

### 影响范围

```
e:\code\vshop (前端)
├── src/api/queries/channel.ts        ← authMethods 查询字段更新
├── src/api/queries/wechat.ts         ← 新增 GET_WXACODE 查询
├── src/api/mutations/auth.ts         ← 注册/登录补写 referredBy
├── src/stores/tenant.ts              ← wechatAppId state
├── src/stores/auth.ts                ← 复用现有 inviteCode
├── src/App.vue                       ← onLaunch 解析小程序 scene 中的 r=邀请码
├── src/pages/login/index.vue         ← 修复静默授权循环 + 读后端 appId
├── src/pages/home/index.vue          ← 接入分享
├── src/pkg-product/pages/detail.vue  ← 接入海报组件
├── src/pkg-promotion/pages/*         ← 接入分享
├── src/pkg-user/pages/distribution.vue ← 携带 referredByCode
├── src/composables/useShare.ts       ← 复用（无需改）
├── src/composables/useH5Share.ts     ← 复用（无需改）
├── src/utils/wechat.ts               ← resetWxReady 路由拦截接入
├── src/components/product-poster/    ← 新增海报组件
└── package.json                      ← 新增 html-to-image、qrcode 依赖

e:\code\vendure (后端)
└── packages/wechat-auth-plugin/
    ├── src/wechat-auth.service.ts    ← token 缓存重构为 Map + 新增 getMiniProgramAccessToken
    ├── src/wxacode.service.ts        ← 新增：调用微信 getwxacodeunlimit
    ├── src/wxacode.service.spec.ts   ← 新增：单元测试
    ├── src/wechat-auth-shop.resolver.ts ← 追加 wechatWxacode 查询
    └── src/plugin.ts                 ← 注册 WxacodeService + schema
└── packages/distribution-plugin/
    ├── src/distribution.service.ts   ← apply 成功后回写 customer.referralCode
    ├── src/commission.service.ts     ← 读取 referredBy 而非 referralCode + self-referral 校验
    ├── src/distribution.service.spec.ts  ← 新增：单元测试
    └── src/commission.service.spec.ts    ← 新增：单元测试
```

### 模块职责划分

| 模块 | 职责 | 边界 |
|---|---|---|
| **authConfig 扩展** | shop GraphQL `authMethods` 返回值追加 `wechatAppId` 公开字段 | 仅返回公开 appId，不返回 secret |
| **WxacodeService** | 取小程序 access_token + 调用 `getwxacodeunlimit` 生成小程序码 | 返回 base64，不存储图片 |
| **WechatAuthShopResolver** | 暴露 `wechatWxacode(path, scene)` GraphQL 查询 | 仅鉴权用户可调，频次限流 |
| **ProductPoster 组件** | 前端绘制海报，H5/小程序双端实现 | 接收 product 数据 + wxacode base64，输出图片 |
| **分享扩展** | 4 类页面接入 useShare/useH5Share | 文案硬编码，不可配置 |
| **邀请码归因修复** | 3 处断裂点修复 | 注册/登录/申请分销商时传递和回写 |

### 关键约束

1. **token 缓存隔离**：`WechatAuthService` 当前是单例缓存，需重构为 `Map<appId, TokenCache>`，支持多租户不同 appId
2. **wxacode 鉴权**：仅登录用户可调用，防止滥用；每 userId 每分钟 10 次
3. **前端条件编译**：海报组件 H5 与小程序分两套实现，通过 `#ifdef` 隔离
4. **YAGNI**：不引入后台配置 UI，不引入数据埋点，不引入多模板海报
5. **邀请码补写不影响主流程**：注册/登录成功是主目标，邀请码补写失败仅记录日志，不阻断主流程

## 详细设计

### 1. 微信登录修复

#### 1.1 问题与修复

**问题 1：AppId 来源缺失**
- 当前：前端读 `VITE_WECHAT_APP_ID`，.env 中为空，按钮 `v-if` 永假
- 修复：后端 `authMethods` 查询返回值追加 `wechatAppId` 公开字段

**问题 2：静默授权循环跳转**
- 当前：`login/index.vue` L132-L141 自动触发静默授权，`result.userId` 为空时无反馈，会重复跳转
- 修复：增加失败标记 `lastWechatAuthFailed`，失败后不再自动触发，显示错误提示

#### 1.2 后端改动

**auth-shop.resolver.ts** — `authMethods` 查询返回值扩展

当前返回：`[AuthMethod!]!`（如 `['native','wechat','phone']`）

改造为对象类型：

```graphql
type AuthMethodsResult {
  methods: [AuthMethod!]!
  wechatAppId: String   # 公开值，仅当 methods 含 wechat 时返回，否则 null
}

extend type Query {
  authMethods: AuthMethodsResult!
}
```

- 从 `parseAndDecryptStruct` 读 channel authConfig
- `enabledMethods` 含 `wechat` 时，从 `overrides.wechat.appId` 取 appId（appId 是公开值，无需脱敏；仅 secret 字段脱敏）
- 若 override 未配置 appId，回退到 `WechatAuthPluginOptions.appId`（全局默认）

#### 1.3 前端改动

**api/queries/channel.ts** — `getAuthMethods()` 查询字段更新

```graphql
query GetAuthMethods {
  authMethods {
    methods
    wechatAppId
  }
}
```

**stores/tenant.ts** — state 扩展

```typescript
authMethods: string[] = []
wechatAppId: string = ''  // 新增
```

**pages/login/index.vue** — 关键修复

```vue
<!-- 替换 -->
const wechatAppId = import.meta.env.VITE_WECHAT_APP_ID || ''
<!-- 为 -->
const wechatAppId = computed(() => tenantStore.wechatAppId)

<!-- 静默授权循环修复 -->
const lastWechatAuthFailed = ref(false)
// onMounted 中：
if (isWechatBrowser && !authStore.token && !lastWechatAuthFailed.value) {
  // 自动触发静默授权
}
// handleWechatH5Callback 中：
if (!result.userId) {
  lastWechatAuthFailed.value = true
  uni.showToast({ title: '微信登录失败，请重试', icon: 'none' })
  return
}
```

#### 1.4 兼容性

- 保留 `.env` 的 `VITE_WECHAT_APP_ID` 作为兜底（若后端未返回 appId 时使用）
- 后端 `authMethods` 返回类型变更，需同步更新 vshop 的 GraphQL 查询

### 2. 转发分享扩展

#### 2.1 扩展范围与文案

| 页面 | 标题文案 | 跳转路径 | 缩略图 |
|---|---|---|---|
| **商品详情**（已接入，修复） | 商品名 | `/#/pkg-product/pages/detail?slug=xxx&ref=邀请码` | 商品主图 |
| **首页** | `${channelName} - 精选好物` | `/?ref=邀请码` | channel logo 或默认图 |
| **秒杀活动** | `限时秒杀：${activityName}` | `/#/pkg-promotion/pages/flash-sale?ref=邀请码` | 活动主图 |
| **拼团活动** | `拼团：${activityName}` | `/#/pkg-promotion/pages/group-buy?ref=邀请码` | 活动主图 |
| **优惠券** | `快来领优惠券 - ${channelName}` | `/#/pkg-promotion/pages/coupons?ref=邀请码` | 默认图 |

#### 2.2 修复：SPA 路由切换签名失效

**问题**：`utils/wechat.ts` 中 `wxReadyPromise` 单例在 SPA 路由切换后未重置，微信签名 URL 仍是旧页面，导致 `wx.config` 失败。

**修复**：在路由守卫中调用 `resetWxReady()`。

**推荐实现**：uni-app 路由拦截器，覆盖所有路由变化。

```typescript
// App.vue 或新增 src/utils/router-guard.ts
// #ifdef H5
import { resetWxReady } from './utils/wechat'

uni.addInterceptor('switchTab', { complete: resetWxReady })
uni.addInterceptor('navigateTo', { complete: resetWxReady })
uni.addInterceptor('redirectTo', { complete: resetWxReady })
// #endif
```

#### 2.3 分享文案来源

- **channelName**：从 `tenantStore` 读取（若已有则复用，否则新增字段）
- **邀请码**：从 `authStore.inviteCode` 读取
- **activityName**：各活动页从自身数据加载

#### 2.4 文案兜底

- channelName 缺失时用 "VShop 商城"
- inviteCode 缺失时不拼接 ref 参数（分享链接不带分销归因）
- activityName 缺失时用通用文案（如 "限时秒杀" / "拼团优惠"）

#### 2.5 实现方式

各页面 `onLoad` 或 `onMounted` 中调用现有 `useShare`/`useH5Share`，传入对应文案：

```typescript
// 示例：首页
const { setTitle, setPath, setImageUrl } = useH5Share()
useShare({ title: `${channelName.value} - 精选好物`, path: '/?ref=' + inviteCode.value })
```

`useShare`/`useH5Share` composable 已存在，无需重构，仅扩展调用方。

### 3. 商品海报

#### 3.1 组件结构

```
src/components/product-poster/
├── product-poster.vue          # 入口组件，条件编译分发
├── product-poster-h5.vue       # H5 实现（#ifdef H5）
├── product-poster-mp.vue       # 小程序实现（#ifdef MP-WEIXIN）
└── usePosterData.ts            # 公共数据准备 composable
```

#### 3.2 海报布局（单一模板）

```
┌─────────────────────────┐
│  [Logo]  商城名称         │  ← 顶部：channel logo + 名称
├─────────────────────────┤
│                         │
│    [商品主图 750x750]    │  ← 主图区
│                         │
├─────────────────────────┤
│  ¥ 99.00  ¥199.00(划线)  │  ← 价格区
│  商品标题（最多2行）      │
├─────────────────────────┤
│  [小程序码]  扫码购买     │  ← 底部：二维码 + 文案 + 邀请码
│  邀请码：ABC123          │
└─────────────────────────┘
画布尺寸：750 x 1200（逻辑像素）
```

#### 3.3 H5 实现（html-to-image）

```typescript
// product-poster-h5.vue
import { toPng } from 'html-to-image'

async function generatePoster(): Promise<string> {
  const node = posterRef.value
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff'
  })
  return dataUrl  // data:image/png;base64,...
}
```

- DOM 渲染海报布局 → `toPng` 截图生成 dataURL
- 依赖：`html-to-image`（约 12KB gzipped）
- 跨域图片需服务端配置 CORS 或使用 `cacheBust` + 代理

#### 3.4 小程序实现（原生 canvas）

```typescript
// product-poster-mp.vue
const ctx = uni.createCanvasContext('posterCanvas')

function drawPoster(data: PosterData) {
  // 1. 绘制背景
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, 750, 1200)
  // 2. 绘制商城名
  ctx.setFontSize(28)
  ctx.fillText(data.channelName, 80, 60)
  // 3. 绘制商品主图
  ctx.drawImage(data.productImage, 0, 100, 750, 750)
  // 4. 绘制价格
  ctx.setFillStyle('#e93b3b')
  ctx.setFontSize(48)
  ctx.fillText(`¥${data.price}`, 40, 920)
  // 5. 绘制小程序码
  ctx.drawImage(data.wxacodeBase64, 40, 1000, 150, 150)
  // 6. 绘制邀请码
  ctx.setFillStyle('#999')
  ctx.setFontSize(24)
  ctx.fillText(`邀请码：${data.inviteCode}`, 210, 1080)
  ctx.draw()
}
```

- 生成后用 `uni.canvasToTempFilePath` 导出临时路径
- 小程序码图片需先 `uni.getImageInfo` 下载到本地再绘制

#### 3.5 数据准备（usePosterData.ts）

```typescript
interface PosterData {
  channelName: string
  channelLogo?: string
  productImage: string
  productTitle: string
  price: string
  originalPrice?: string
  wxacodeBase64: string       // 从后端查询
  inviteCode?: string
  marketingText?: string      // 如"限时秒杀" "拼团价"
}

async function preparePosterData(product: Product): Promise<PosterData> {
  const scene = authStore.inviteCode
    ? `s=${product.slug}&r=${authStore.inviteCode}`
    : `s=${product.slug}`
  const wxacode = await fetchWxacode({
    path: 'pkg-product/pages/detail',
    scene
  })
  return {
    channelName: tenantStore.channelName || 'VShop 商城',
    productImage: product.featuredAsset.preview,
    productTitle: product.name,
    price: product.priceWithTax.value,
    originalPrice: product.customFields?.compareAtPrice,
    wxacodeBase64: wxacode,
    inviteCode: authStore.inviteCode
  }
}
```

#### 3.6 小程序码 scene 参数设计

```typescript
// 调用后端 wechatWxacode 查询
const scene = authStore.inviteCode
  ? `s=${product.slug}&r=${authStore.inviteCode}`  // 紧凑格式，最大 32 字符
  : `s=${product.slug}`
```

- slug 较短时用 `s=slug&r=邀请码`（约 20 字符）
- slug 超长时仅传 `s=slug`，邀请码通过 URL 参数补充（H5 场景）

**小程序 scene 解析**（App.vue onLaunch）：

```typescript
function parseScene(scene: string): { slug?: string; ref?: string } {
  const params = new URLSearchParams(scene)
  return {
    slug: params.get('s') || undefined,
    ref: params.get('r') || undefined
  }
}
```

#### 3.7 H5 二维码

H5 端不用小程序码，用 `qrcode` 库生成 URL 二维码：

```typescript
import QRCode from 'qrcode'

const shareUrl = buildShareLink(`/#/pkg-product/pages/detail?slug=${product.slug}`)
const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, { width: 200 })
// qrCodeDataUrl 可直接用于 canvas 绘制
```

新增依赖：`qrcode`（约 25KB gzipped）

#### 3.8 用户操作流程

```
商品详情页 → 点击"生成海报"按钮
  ↓
加载中（获取小程序码，绘制画布）
  ↓
展示海报预览（弹窗/新页面）
  ↓
用户选择：
  ├─【保存到相册】H5: 提示长按保存 / 小程序: uni.saveImageToPhotosAlbum
  ├─【分享好友】仅小程序: wx.shareAppMessage 携带 imageUrl
  └─【复制链接】复制商品 URL 到剪贴板
```

#### 3.9 商品详情页接入

在 `detail.vue` 操作栏新增"海报"按钮：

```vue
<uni-icons type="image" @click="showPoster = true" />
<ProductPoster v-if="showPoster" :product="product" @close="showPoster = false" />
```

#### 3.10 依赖新增

**vshop package.json**：

```json
{
  "dependencies": {
    "html-to-image": "^1.11.11",
    "qrcode": "^1.5.3"
  }
}
```

小程序端无需新增依赖（原生 canvas API）。

#### 3.11 关键约束

1. **小程序码 scene 限制 32 字符**：`s=slug&r=邀请码` 通常足够，长 slug 超长时截断
2. **H5 跨域图片**：商品图来自 Vendure Asset，需配置 CORS 或走代理
3. **canvas 性能**：小程序 canvas 绘制是同步阻塞的，大图可能卡顿，加 loading 提示
4. **海报缓存**：同一商品+同一用户的小程序码 60 秒内复用（前端内存缓存）

### 4. 邀请码归因闭环修复

#### 4.1 现状：五处断裂点

1. **commission.service 读取了错误的字段**：`commission.service.ts` L46 读取 `customer.customFields.referralCode`（用户自己的推荐码），但归因逻辑应读取 `customer.customFields.referredBy`（推荐人的推荐码）。当前逻辑导致用户 A 下单时用自己的 referralCode 查找分销商，找到 A 自己，给 A 自己发佣金（self-referral 错误）。
2. **Customer.customFields.referralCode 无写入路径**：`DistributionService.apply()` 生成 Distributor 实体的 referralCode 后未回写到 Customer。
3. **前端 inviteCode 未传给后端**：`App.vue` 捕获 URL `?ref=xxx` 后只存本地 storage，注册/登录/申请分销商时未传递。
4. **applyDistributor 不传 referredByCode**：`distribution.vue` 调用 `applyDistributor` mutation 时漏传 `referredByCode` 参数。
5. **小程序场景下 scene 参数未解析为 inviteCode**：`App.vue` 仅在 H5 环境捕获 `?ref=xxx`，小程序扫码进入时 scene 参数（含 `r=邀请码`）未被解析写入 `authStore.inviteCode`。

#### 4.2 断裂点 1：修复 commission.service 读取字段错误 + self-referral 校验

**位置**：`commission.service.ts` `calculateCommission()` 方法

**问题**：当前 L46 读取 `customer.customFields.referralCode`（用户自己的推荐码），导致用户自己下单时给自己发佣金。

**修复**：改为读取 `customer.customFields.referredBy`（推荐人的推荐码），并增加 self-referral 校验：

```typescript
async calculateCommission(event: PaymentStateTransitionEvent): Promise<void> {
  const ctx = event.ctx;
  const order = event.order;

  if (!(ctx.channel as any).customFields?.distributionEnabled) {
    return;
  }

  const customer = order.customer;
  if (!customer) return;

  // 修复 1：读取 referredBy（推荐人的推荐码），而非 referralCode（自己的码）
  const referredBy = (customer as any).customFields?.referredBy;
  if (!referredBy) return;

  const directDistributor = await this.distributionService.findByReferralCode(ctx, referredBy);
  if (!directDistributor || directDistributor.status !== 'active') return;

  // 修复 2：self-referral 校验
  // 若订单用户本身就是分销商 A（即 A 自己下单），且 A 的推荐人码指向自己，跳过
  if (String(directDistributor.customerId) === String(customer.id)) {
    Logger.info(`Skip self-referral commission for customer ${customer.id}`, loggerCtx);
    return;
  }

  // ... 后续佣金计算逻辑不变 ...
}
```

#### 4.3 断裂点 2：申请分销商后回写 customer.referralCode

**位置**：`distribution.service.ts` `apply()` 方法

```typescript
// 现有：生成 Distributor 后直接返回
// 修改：生成后回写到 Customer.customFields.referralCode
async apply(ctx, customerId, referredByCode?) {
  // ... 现有逻辑创建 distributor ...
  const distributor = await this.distributorRepo.save(newDistributor)
  
  // 新增：回写到 Customer
  const customer = await this.customerService.findById(ctx, customerId)
  await this.customerService.update(ctx, {
    id: customer.id,
    customFields: { referralCode: distributor.referralCode }
  })
  
  return distributor
}
```

#### 4.4 断裂点 3：注册/登录时传递 ref 码

**前端改动**：

`api/mutations/auth.ts` — 注册成功后补写 referredBy（分两步执行）：

**步骤 1：注册**

```graphql
mutation Register($email: String!, $password: String!) {
  register(input: { emailAddress: $email, password: $password }) {
    ...on SuccessResult { success }
  }
}
```

**步骤 2：注册成功后，补写 referredBy**（仅当 inviteCode 存在时）

```graphql
mutation UpdateCustomerReferredBy($referredBy: String!) {
  updateCustomer(input: { customFields: { referredBy: $referredBy } }) {
    ...on Customer { id }
    ...on MissingPasswordError { errorCode }
  }
}
```

前端实现：

```typescript
async function registerWithInviteCode(email, password) {
  // 步骤 1：注册
  const result = await register(email, password)
  if (!result.success) return result
  
  // 步骤 2：补写 referredBy（仅当 inviteCode 存在）
  if (authStore.inviteCode) {
    await tryUpdateReferredBy(authStore.inviteCode)
  }
  
  return result
}
```

**登录时**：若用户已有 `referredBy`，不覆盖；若没有，登录成功后补写：

```typescript
async function loginWithInviteCode(email, password) {
  const result = await login(email, password)
  if (result.success && authStore.inviteCode) {
    // 仅当用户 referredBy 为空时补写
    await tryUpdateReferredBy(authStore.inviteCode)
  }
}
```

**`tryUpdateReferredBy` 实现**：

```typescript
async function tryUpdateReferredBy(inviteCode: string) {
  try {
    // 1. 查询当前用户的 referredBy
    const { customer } = await client.query({
      query: GET_CUSTOMER_REFERRAL,
      fetchPolicy: 'network-only'
    })
    // 2. 已有值则不覆盖
    if (customer?.customFields?.referredBy) return
    // 3. 空则补写
    await client.mutate({
      mutation: UPDATE_CUSTOMER_REFERRAL,
      variables: { referredBy: inviteCode }
    })
  } catch (e) {
    // 失败不影响主流程
    console.error('补写 referredBy 失败', e)
  }
}
```

#### 4.5 断裂点 4：applyDistributor 传递 referredByCode

`distribution.vue` — 申请时携带推荐人码：

```typescript
const applyDistributorMutation = gql`
  mutation ApplyDistributor($referredByCode: String) {
    applyDistributor(referredByCode: $referredByCode) {
      id
      status
    }
  }
`

// 调用时传入 authStore.inviteCode（即推荐人的 referralCode）
await applyDistributor({ referredByCode: authStore.inviteCode })
```

#### 4.6 断裂点 5：小程序场景下 scene 参数解析为 inviteCode

**位置**：`App.vue` `onLaunch` 钩子

**问题**：当前仅 H5 环境捕获 `?ref=xxx`，小程序扫码进入时 scene 参数（格式 `s=slug&r=邀请码`）未被解析。

**修复**：扩展 `onLaunch`，小程序环境下解析 scene 参数：

```typescript
// App.vue onLaunch
onLaunch((options: any) => {
  const tenantStore = useTenantStore();
  const authStore = useAuthStore();

  tenantStore.initTenant();
  authStore.restoreSession();

  // H5: 从 URL ?ref=xxx 捕获
  // #ifdef H5
  try {
    const url = new URL(window.location.href);
    const refCode = url.searchParams.get('ref');
    if (refCode) {
      authStore.setInviteCode(refCode);
    }
  } catch (e) {}
  // #endif

  // 小程序: 从 scene 参数解析 r=邀请码
  // #ifdef MP-WEIXIN
  try {
    const scene = options?.query?.scene || options?.scene;
    if (scene) {
      const decoded = decodeURIComponent(scene);
      const params = new URLSearchParams(decoded);
      const refCode = params.get('r');
      if (refCode) {
        authStore.setInviteCode(refCode);
      }
    }
  } catch (e) {}
  // #endif

  setupRouteGuard();
});
```

**注意**：
- 小程序码生成时 scene 格式为 `s=slug&r=邀请码`
- 微信会将 scene 透传到 onLaunch 的 options.query.scene
- 需 decodeURIComponent 解码（微信会对 scene 做 URL 编码）

#### 4.7 命名统一策略

**不强制重命名**，通过接口层映射：

- 后端 `referralCode`（Customer.customFields 和 Distributor 实体）
- 前端 `inviteCode`（authStore）
- GraphQL 中间层用 `referralCode`/`referredBy`（后端契约）

前端在调用 API 时将 `inviteCode` 映射为 `referredBy`（注册时）或 `referredByCode`（申请分销商时）。

#### 4.8 数据流闭环

```
1. 分销商 A 申请通过
   → distribution.service.apply() 回写 customer_A.customFields.referralCode = "XYZ8"
                                        ↓
2. A 分享海报/链接（带 ref=XYZ8）
   - H5: URL ?ref=XYZ8
   - 小程序: scene 含 r=XYZ8
                                        ↓
3. B 扫码/点击进入
   - H5: App.vue 捕获 ?ref=XYZ8 → authStore.inviteCode = "XYZ8"
   - 小程序: App.vue 解析 scene → authStore.inviteCode = "XYZ8"
                                        ↓
4. B 注册
   → register 成功后补写 customer_B.customFields.referredBy = "XYZ8"
                                        ↓
5. B 下单支付
   → commission.service 读取 customer_B.customFields.referredBy = "XYZ8"
   → self-referral 校验：B != A，通过
   → findByReferralCode("XYZ8") → 找到 Distributor A
   → 创建 direct 佣金给 A
                                        ↓
6. 若 B 也申请成为分销商
   → applyDistributor(referredByCode: "XYZ8")
   → 建立 distributor_B.parentId = distributor_A.id（上下级关系）
   → B 后续下级 C 下单时，A 也能获得 indirect 佣金
```

#### 4.9 影响范围

| 改动点 | 文件 | 说明 |
|---|---|---|
| 后端字段修复 | commission.service.ts | 读取 referredBy 而非 referralCode + self-referral 校验 |
| 后端回写 | distribution.service.ts | apply 成功后回写 customer.referralCode |
| 前端注册 | api/mutations/auth.ts | 注册后补写 referredBy |
| 前端登录 | api/mutations/auth.ts | 登录后补写 referredBy（仅空时） |
| 前端申请分销商 | pkg-user/pages/distribution.vue | 携带 referredByCode |
| 前端小程序 scene 解析 | App.vue | onLaunch 解析 scene 参数中的 r=邀请码 |

### 5. 后端 wxacode 服务

#### 5.1 WxacodeService 设计

**文件**：`e:\code\vendure\packages\wechat-auth-plugin\src\wxacode.service.ts`

```typescript
export class WxacodeService {
  private tokenCache = new Map<string, TokenCache>()  // 按 appId 隔离

  async generateWxacode(ctx: RequestUserContext, args: {
    path?: string       // 小程序页面路径，如 'pkg-product/pages/detail'
    scene: string       // 场景参数，最大 32 字符，如 's=abc123&r=XYZ8'
    width?: number      // 二维码宽度，默认 430
    envVersion?: 'release' | 'trial' | 'develop'
  }): Promise<{ contentType: string; base64: string }>
}
```

#### 5.2 token 缓存重构

`wechat-auth.service.ts` 现有单例缓存改为 Map：

```typescript
// 现有
private accessTokenCache: TokenCache | null = null

// 改为
private accessTokenCacheMap = new Map<string, TokenCache>()

async getMiniProgramAccessToken(appId: string, appSecret: string): Promise<string> {
  const cached = this.accessTokenCacheMap.get(appId)
  if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_SECONDS * 1000) {
    return cached.token
  }
  const token = await this.fetchAccessToken(appId, appSecret)
  this.accessTokenCacheMap.set(appId, {
    token,
    expiresAt: Date.now() + 7200 * 1000
  })
  return token
}
```

- 公众号 token 缓存保持原 `getAccessToken()` 方法不变（向后兼容）
- 新增 `getMiniProgramAccessToken(appId, appSecret)` 方法
- 两套缓存独立，按 appId 隔离

#### 5.3 凭证来源（租户隔离）

```typescript
// 在 WxacodeService.generateWxacode 中
async generateWxacode(ctx, args) {
  // 1. 获取租户级小程序凭证（复用现有 authConfig override 机制）
  const override = await getAuthOverride(ctx, 'wechat')
  const appId = override?.miniProgramAppId || this.options.miniProgramAppId
  const appSecret = override?.miniProgramAppSecret || this.options.miniProgramAppSecret
  
  if (!appId || !appSecret) {
    throw new Error('小程序凭证未配置')
  }
  
  // 2. 获取 access_token（按 appId 隔离缓存）
  const accessToken = await this.wechatAuthService.getMiniProgramAccessToken(appId, appSecret)
  
  // 3. 调用微信 getwxacodeunlimit 接口
  const response = await fetch('https://api.weixin.qq.com/wxa/getwxacodeunlimit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      scene: args.scene,
      page: args.path,
      width: args.width || 430,
      env_version: args.envVersion || 'release',
      check_path: false  // 允许未发布页面
    })
  })
  
  // 4. 处理响应：图片或错误 JSON
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      contentType,
      base64: buffer.toString('base64')
    }
  }
  
  // 错误响应
  const errorBody = await response.json()
  throw new Error(`微信小程序码生成失败: ${errorBody.errcode} ${errorBody.errmsg}`)
}
```

#### 5.4 GraphQL 查询暴露

**文件**：`wechat-auth-shop.resolver.ts`

```graphql
type WxacodeResult {
  contentType: String!
  base64: String!
}

extend type Query {
  wechatWxacode(
    scene: String!
    path: String
    width: Int
  ): WxacodeResult!
}
```

```typescript
@Query(() => WxacodeResult)
async wechatWxacode(
  @Ctx() ctx: RequestContext,
  @Args('scene') scene: string,
  @Args({ name: 'path', type: () => String, nullable: true }) path?: string,
  @Args({ name: 'width', type: () => Int, nullable: true }) width?: number,
): Promise<WxacodeResult> {
  // 1. 鉴权：仅登录用户
  if (!ctx.activeUser) {
    throw new ForbiddenError('请先登录')
  }
  
  // 2. 参数校验
  if (scene.length > 32) {
    throw new UserInputError('scene 参数不能超过 32 字符')
  }
  
  // 3. 调用服务
  const result = await this.wxacodeService.generateWxacode(ctx, { scene, path, width })
  return result
}
```

#### 5.5 频次限制

简单内存计数器，按 userId 限流：

```typescript
private userCallCount = new Map<number, { count: number; resetAt: number }>()

private checkRateLimit(userId: number) {
  const now = Date.now()
  const record = this.userCallCount.get(userId)
  
  if (!record || record.resetAt < now) {
    this.userCallCount.set(userId, { count: 1, resetAt: now + 60_000 })
    return
  }
  
  if (record.count >= 10) {  // 每分钟 10 次
    throw new Error('调用过于频繁，请稍后再试')
  }
  record.count++
}
```

- 每 userId 每分钟 10 次（足够海报生成场景）
- 内存计数器，重启重置（MVP 足够，无需 Redis）

#### 5.6 前端缓存

前端对同一 scene 的小程序码 60 秒内复用：

```typescript
// usePosterData.ts
const wxacodeCache = new Map<string, { base64: string; expireAt: number }>()

async function fetchWxacode(scene: string, path?: string): Promise<string> {
  const cacheKey = `${scene}|${path || ''}`
  const cached = wxacodeCache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) {
    return cached.base64
  }
  
  const result = await client.query({
    query: GET_WXACODE,
    variables: { scene, path }
  })
  
  wxacodeCache.set(cacheKey, {
    base64: result.data.wechatWxacode.base64,
    expireAt: Date.now() + 60_000
  })
  return result.data.wechatWxacode.base64
}
```

#### 5.7 plugin.ts 注册

```typescript
// wechat-auth-plugin/src/plugin.ts
providers: [
  WechatAuthService,
  WxacodeService,  // 新增
  // ... 现有 providers
]

shopApiExtensions: {
  schema: `
    type WxacodeResult {
      contentType: String!
      base64: String!
    }
    extend type Query {
      wechatWxacode(scene: String!, path: String, width: Int): WxacodeResult!
    }
  `,
  resolvers: [WechatAuthShopResolver]  // 已存在，追加方法即可
}
```

## 错误处理策略

| 场景 | 错误类型 | 处理方式 | 用户感知 |
|---|---|---|---|
| **微信登录** AppId 未配置 | 前端 | 按钮 `v-if` 为 false，不渲染 | 按钮不显示（静默） |
| **微信登录** 静默授权失败 | 前端 | `lastWechatAuthFailed` 标记，显示 toast | "微信登录失败，请重试" |
| **微信登录** OAuth 回调错误 | 后端 | 返回错误码，前端 toast | 显示具体错误 |
| **分享** JSSDK 签名失败 | 前端 | `wx.error` 回调，console.error | 分享按钮使用默认分享（标题为页面 title） |
| **海报** 小程序码生成失败 | 后端 | 抛 `UserInputError` 或通用 Error | "海报生成失败，请稍后重试" |
| **海报** 跨域图片加载失败 | 前端 | `try/catch`，使用兜底图 | 海报显示默认商品图或纯色背景 |
| **海报** canvas 绘制失败 | 前端 | `try/catch`，toast 提示 | "海报生成失败" |
| **海报** 保存相册权限拒绝 | 前端 | 引导用户开启权限 | 弹窗引导到设置页 |
| **wxacode** 频次超限 | 后端 | 抛 Error | "调用过于频繁，请稍后再试" |
| **wxacode** scene 超 32 字符 | 后端 | `UserInputError` | "参数不能超过 32 字符" |
| **wxacode** 小程序凭证未配置 | 后端 | 抛 Error | "小程序凭证未配置" |
| **wxacode** 微信接口 errcode | 后端 | 解析 JSON，抛 Error 带 errcode | "小程序码生成失败：[errcode]" |
| **邀请码** 注册时补写 referredBy 失败 | 前端 | `try/catch`，不影响注册成功 | 用户无感知（注册仍成功） |
| **邀请码** 登录时补写 referredBy 失败 | 前端 | `try/catch`，不影响登录成功 | 用户无感知（登录仍成功） |

### 关键设计原则

1. **邀请码补写不影响主流程**：注册/登录成功是主目标，邀请码补写失败仅记录日志，不阻断主流程
2. **海报生成失败不阻断页面**：商品详情页正常可用，海报仅作为附加功能
3. **分享失败静默降级**：JSSDK 失败时使用浏览器默认分享能力
4. **wxacode 错误明确**：区分参数错误、凭证错误、微信接口错误，便于排查

## 测试策略

### 后端单元测试

**WxacodeService** — `wechat-auth-plugin/src/wxacode.service.spec.ts`

```typescript
describe('WxacodeService', () => {
  it('生成成功：返回 base64 图片')
  it('凭证未配置：抛 Error')
  it('scene 超 32 字符：抛 UserInputError')
  it('微信返回 errcode：解析错误并抛出')
  it('token 缓存命中：不重复请求 access_token')
  it('token 缓存过期：重新请求 access_token')
  it('多 appId 隔离：不同 appId 独立缓存')
  it('频次限制：每分钟 10 次后抛错')
})
```

**WechatAuthService token 缓存重构** — 回归测试

```typescript
describe('getMiniProgramAccessToken', () => {
  it('公众号 token 与小程序 token 独立缓存')
  it('不同 appId 互不干扰')
  it('现有 getAccessToken 行为不变（向后兼容）')
})
```

**DistributionService.apply 回写** — `distribution-plugin/src/distribution.service.spec.ts`

```typescript
describe('apply', () => {
  it('申请成功后回写 customer.customFields.referralCode')
  it('referredByCode 有效时建立上下级关系')
  it('referredByCode 无效时忽略，仍创建独立分销商')
})
```

**CommissionService.calculateCommission 字段修复** — `distribution-plugin/src/commission.service.spec.ts`

```typescript
describe('calculateCommission', () => {
  it('读取 customer.referredBy 而非 referralCode')
  it('referredBy 为空：不创建佣金')
  it('referredBy 有效：创建 direct 佣金给上级分销商')
  it('self-referral 校验：订单用户是分销商自己时跳过')
  it('上级分销商有 parentId：创建 indirect 佣金给上上级')
  it('上级分销商状态非 active：不创建佣金')
})
```

### 后端 e2e 测试

**wxacode 查询** — `cjk-plugins-e2e/wxacode.e2e.spec.ts`

```typescript
describe('wechatWxacode query', () => {
  it('未登录：抛 ForbiddenError')
  it('登录后：返回 WxacodeResult（mock 微信接口）')
  it('scene 超长：抛 UserInputError')
  it('频次超限：抛 Error')
})
```

### 前端测试

**ProductPoster 组件** — 手动测试为主

```typescript
describe('ProductPoster', () => {
  it('H5: 调用 html-to-image 生成 dataURL')
  it('小程序: 调用 canvas 绘制并导出临时路径')
  it('wxacode 获取失败: 显示错误提示')
  it('商品图跨域: 使用兜底图')
  it('保存相册权限拒绝: 引导开启权限')
})
```

**邀请码数据流** — 手动测试

```
测试用例 1：完整归因闭环（H5）
  1. 用户 A 申请分销商 → 验证 customer_A.referralCode 已回写
  2. 用户 A 分享海报 → 验证小程序码 scene 含 r=referralCode_A
  3. 用户 B 扫码进入 → 验证 authStore.inviteCode = referralCode_A
  4. 用户 B 注册 → 验证 customer_B.referredBy = referralCode_A
  5. 用户 B 下单支付 → 验证佣金记录创建给 A

测试用例 2：完整归因闭环（小程序）
  1. 用户 A 在小程序中分享海报
  2. 用户 B 扫小程序码进入 → 验证 App.vue 解析 scene 中 r=参数
  3. 验证 authStore.inviteCode = referralCode_A
  4. 后续流程同 H5

测试用例 3：登录补写
  1. 用户 C 已注册但 referredBy 为空
  2. 通过 ref 链接登录 → 验证 referredBy 补写成功

测试用例 4：不覆盖已有
  1. 用户 D 已有 referredBy = code_X
  2. 通过 ref=code_Y 链接登录 → 验证 referredBy 仍为 code_X

测试用例 5：self-referral 防护
  1. 用户 A 是分销商，customer_A.referralCode = "XYZ8"
  2. 用户 A 的 referredBy 意外被设为 "XYZ8"（脏数据）
  3. 用户 A 下单支付 → 验证不创建佣金（self-referral 校验）

测试用例 6：上下级 indirect 佣金
  1. 用户 A 是分销商（referralCode = "XYZ8"）
  2. 用户 B 通过 A 的链接注册并申请分销商（referredByCode = "XYZ8"）
  3. 用户 C 通过 B 的链接注册
  4. 用户 C 下单支付 → 验证 B 获得 direct 佣金，A 获得 indirect 佣金
```

### 测试依赖

- **后端**：复用现有 `@vendure/testing` + `cjk-plugins-e2e` 配置
- **微信接口 mock**：使用 `nock` 或手动 mock fetch（WxacodeService 内部 fetch）
- **前端**：现有 vitest 配置，手动测试为主（uni-app 组件测试复杂度高）
