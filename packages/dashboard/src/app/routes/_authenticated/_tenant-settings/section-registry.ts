import { type ComponentType, lazy } from 'react';

export interface SectionDef {
    key: string;
    label: string;
    component: ComponentType<{ channelId: string }>;
}

// 懒加载各 Tab，配置驱动；新增租户能力 = 在此追加一项
export const sections: SectionDef[] = [
    { key: 'basic', label: '基本设置', component: lazy(() => import('./sections/basic.js')) },
    { key: 'multi-language', label: '多语言', component: lazy(() => import('./sections/multi-language.js')) },
    { key: 'auth', label: '登录认证 & SSO', component: lazy(() => import('./sections/auth.js')) },
    { key: 'payment', label: '支付方式', component: lazy(() => import('./sections/payment.js')) },
    { key: 'shipping', label: '配送方式', component: lazy(() => import('./sections/shipping.js')) },
    { key: 'pickup', label: '自提点', component: lazy(() => import('./sections/pickup.js')) },
    { key: 'map', label: '地图服务', component: lazy(() => import('./sections/map.js')) },
    { key: 'service-notify', label: '客服与通知', component: lazy(() => import('./sections/service-notify.js')) },
];