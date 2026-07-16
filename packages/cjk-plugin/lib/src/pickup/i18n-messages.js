"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_MESSAGES = void 0;
exports.translateError = translateError;
const core_1 = require("@vendure/core");
exports.ERROR_MESSAGES = {
    PICKUP_LOCATION_NOT_SELECTED: {
        [core_1.LanguageCode.zh_Hans]: '订单未选择自提点',
        [core_1.LanguageCode.en]: 'No pickup location selected for the order',
        [core_1.LanguageCode.ja]: '受取場所が選択されていません',
        [core_1.LanguageCode.ko]: '수거 장소가 선택되지 않았습니다',
    },
    PICKUP_LOCATION_NOT_BOUND: {
        [core_1.LanguageCode.zh_Hans]: '您未绑定该企业职工自提点',
        [core_1.LanguageCode.en]: 'You are not bound to this employee pickup location',
        [core_1.LanguageCode.ja]: 'この従業員受取場所にバインドされていません',
        [core_1.LanguageCode.ko]: '이 직원 수거 장소에 바인딩되지 않았습니다',
    },
    FORBIDDEN_PROMOTE: {
        [core_1.LanguageCode.zh_Hans]: '仅超级管理员可升级公共自提点',
        [core_1.LanguageCode.en]: 'Only super admin can promote pickup location',
        [core_1.LanguageCode.ja]: 'スーパー管理者のみ公開に昇格できます',
        [core_1.LanguageCode.ko]: '슈퍼 관리자만 공개로 승격할 수 있습니다',
    },
    NO_ACTIVE_ORDER: {
        [core_1.LanguageCode.zh_Hans]: '无活动订单',
        [core_1.LanguageCode.en]: 'No active order',
        [core_1.LanguageCode.ja]: 'アクティブな注文がありません',
        [core_1.LanguageCode.ko]: '활성 주문이 없습니다',
    },
    PICKUP_LOCATION_NOT_VISIBLE: {
        [core_1.LanguageCode.zh_Hans]: '自提点不在当前租户可见范围内',
        [core_1.LanguageCode.en]: 'Pickup location not visible in current tenant',
        [core_1.LanguageCode.ja]: '受取場所が現在のテナントで表示できません',
        [core_1.LanguageCode.ko]: '수거 장소가 현재 테넌트에서 볼 수 없습니다',
    },
    MAP_CONFIG_NOT_CONFIGURED: {
        [core_1.LanguageCode.zh_Hans]: '地图服务未配置，请在后台 Channel 配置 mapConfig',
        [core_1.LanguageCode.en]: 'Map service not configured, please configure mapConfig in Channel settings',
        [core_1.LanguageCode.ja]: 'マップサービスが未設定です。バックグラウンド Channel の mapConfig を設定してください',
        [core_1.LanguageCode.ko]: '지도 서비스가 미구성되었습니다. 백엔드 Channel의 mapConfig를 구성하십시오',
    },
    MAP_PROVIDER_NOT_REGISTERED: {
        [core_1.LanguageCode.zh_Hans]: '未注册的地图 Provider: {provider}',
        [core_1.LanguageCode.en]: 'Unregistered map provider: {provider}',
        [core_1.LanguageCode.ja]: '未登録のマッププロバイダ: {provider}',
        [core_1.LanguageCode.ko]: '등록되지 않은 지도 프로바이더: {provider}',
    },
    MAP_PROVIDER_API_ERROR: {
        [core_1.LanguageCode.zh_Hans]: '地图服务调用失败: {message}',
        [core_1.LanguageCode.en]: 'Map service API error: {message}',
        [core_1.LanguageCode.ja]: 'マップサービス呼び出し失敗: {message}',
        [core_1.LanguageCode.ko]: '지도 서비스 호출 실패: {message}',
    },
};
function translateError(ctx, key) {
    const messages = exports.ERROR_MESSAGES[key];
    return messages[ctx.languageCode] || messages[core_1.LanguageCode.en];
}
//# sourceMappingURL=i18n-messages.js.map