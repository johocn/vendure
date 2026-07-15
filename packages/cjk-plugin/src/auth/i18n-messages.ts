// e:\code\vendure\packages\cjk-plugin\src\auth\i18n-messages.ts
import { LanguageCode } from '@vendure/core';

type MessageMap = Record<LanguageCode, string>;

export const authI18nMessages: Record<string, MessageMap> = {
    'error.login-method-disabled': {
        [LanguageCode.zh_Hans]: '该登录方式未启用',
        [LanguageCode.en]: 'This login method is not enabled',
        [LanguageCode.ja]: 'このログイン方法は有効になっていません',
        [LanguageCode.ko]: '이 로그인 방식이 활성화되지 않았습니다',
    } as MessageMap,
    'error.sso-config-incomplete': {
        [LanguageCode.zh_Hans]: 'SSO 配置不完整',
        [LanguageCode.en]: 'SSO configuration is incomplete',
        [LanguageCode.ja]: 'SSO設定が不完全です',
        [LanguageCode.ko]: 'SSO 설정이 불완전합니다',
    } as MessageMap,
    'error.sso-token-exchange-failed': {
        [LanguageCode.zh_Hans]: 'SSO 授权失败',
        [LanguageCode.en]: 'SSO authorization failed',
        [LanguageCode.ja]: 'SSO認証に失敗しました',
        [LanguageCode.ko]: 'SSO 인증에 실패했습니다',
    } as MessageMap,
    'error.sso-user-info-failed': {
        [LanguageCode.zh_Hans]: 'SSO 用户信息获取失败',
        [LanguageCode.en]: 'SSO user info retrieval failed',
        [LanguageCode.ja]: 'SSOユーザー情報の取得に失敗しました',
        [LanguageCode.ko]: 'SSO 사용자 정보 조회에 실패했습니다',
    } as MessageMap,
};
