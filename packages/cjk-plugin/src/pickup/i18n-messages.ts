import { LanguageCode, RequestContext } from '@vendure/core';

type MessageMap = Record<LanguageCode, string>;

export const ERROR_MESSAGES: Record<string, MessageMap> = {
    PICKUP_LOCATION_NOT_SELECTED: {
        [LanguageCode.zh_Hans]: '订单未选择自提点',
        [LanguageCode.en]: 'No pickup location selected for the order',
        [LanguageCode.ja]: '受取場所が選択されていません',
        [LanguageCode.ko]: '수거 장소가 선택되지 않았습니다',
    } as MessageMap,
    PICKUP_LOCATION_NOT_BOUND: {
        [LanguageCode.zh_Hans]: '您未绑定该企业职工自提点',
        [LanguageCode.en]: 'You are not bound to this employee pickup location',
        [LanguageCode.ja]: 'この従業員受取場所にバインドされていません',
        [LanguageCode.ko]: '이 직원 수거 장소에 바인딩되지 않았습니다',
    } as MessageMap,
    FORBIDDEN_PROMOTE: {
        [LanguageCode.zh_Hans]: '仅超级管理员可升级公共自提点',
        [LanguageCode.en]: 'Only super admin can promote pickup location',
        [LanguageCode.ja]: 'スーパー管理者のみ公開に昇格できます',
        [LanguageCode.ko]: '슈퍼 관리자만 공개로 승격할 수 있습니다',
    } as MessageMap,
    NO_ACTIVE_ORDER: {
        [LanguageCode.zh_Hans]: '无活动订单',
        [LanguageCode.en]: 'No active order',
        [LanguageCode.ja]: 'アクティブな注文がありません',
        [LanguageCode.ko]: '활성 주문이 없습니다',
    } as MessageMap,
    PICKUP_LOCATION_NOT_VISIBLE: {
        [LanguageCode.zh_Hans]: '自提点不在当前租户可见范围内',
        [LanguageCode.en]: 'Pickup location not visible in current tenant',
        [LanguageCode.ja]: '受取場所が現在のテナントで表示できません',
        [LanguageCode.ko]: '수거 장소가 현재 테넌트에서 볼 수 없습니다',
    } as MessageMap,
    MAP_CONFIG_NOT_CONFIGURED: {
        [LanguageCode.zh_Hans]: '地图服务未配置，请在后台 Channel 配置 mapConfig',
        [LanguageCode.en]: 'Map service not configured, please configure mapConfig in Channel settings',
        [LanguageCode.ja]: 'マップサービスが未設定です。バックグラウンド Channel の mapConfig を設定してください',
        [LanguageCode.ko]: '지도 서비스가 미구성되었습니다. 백엔드 Channel의 mapConfig를 구성하십시오',
    } as MessageMap,
    MAP_PROVIDER_NOT_REGISTERED: {
        [LanguageCode.zh_Hans]: '未注册的地图 Provider: {provider}',
        [LanguageCode.en]: 'Unregistered map provider: {provider}',
        [LanguageCode.ja]: '未登録のマッププロバイダ: {provider}',
        [LanguageCode.ko]: '등록되지 않은 지도 프로바이더: {provider}',
    } as MessageMap,
    MAP_PROVIDER_API_ERROR: {
        [LanguageCode.zh_Hans]: '地图服务调用失败: {message}',
        [LanguageCode.en]: 'Map service API error: {message}',
        [LanguageCode.ja]: 'マップサービス呼び出し失敗: {message}',
        [LanguageCode.ko]: '지도 서비스 호출 실패: {message}',
    } as MessageMap,
};

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

export function translateError(ctx: RequestContext, key: ErrorMessageKey): string {
    const messages = ERROR_MESSAGES[key];
    return messages[ctx.languageCode] || messages[LanguageCode.en];
}
