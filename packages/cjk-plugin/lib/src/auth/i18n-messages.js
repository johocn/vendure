"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authI18nMessages = void 0;
// e:\code\vendure\packages\cjk-plugin\src\auth\i18n-messages.ts
const core_1 = require("@vendure/core");
exports.authI18nMessages = {
    'error.login-method-disabled': {
        [core_1.LanguageCode.zh_Hans]: '该登录方式未启用',
        [core_1.LanguageCode.en]: 'This login method is not enabled',
        [core_1.LanguageCode.ja]: 'このログイン方法は有効になっていません',
        [core_1.LanguageCode.ko]: '이 로그인 방식이 활성화되지 않았습니다',
    },
    'error.sso-config-incomplete': {
        [core_1.LanguageCode.zh_Hans]: 'SSO 配置不完整',
        [core_1.LanguageCode.en]: 'SSO configuration is incomplete',
        [core_1.LanguageCode.ja]: 'SSO設定が不完全です',
        [core_1.LanguageCode.ko]: 'SSO 설정이 불완전합니다',
    },
    'error.sso-token-exchange-failed': {
        [core_1.LanguageCode.zh_Hans]: 'SSO 授权失败',
        [core_1.LanguageCode.en]: 'SSO authorization failed',
        [core_1.LanguageCode.ja]: 'SSO認証に失敗しました',
        [core_1.LanguageCode.ko]: 'SSO 인증에 실패했습니다',
    },
    'error.sso-user-info-failed': {
        [core_1.LanguageCode.zh_Hans]: 'SSO 用户信息获取失败',
        [core_1.LanguageCode.en]: 'SSO user info retrieval failed',
        [core_1.LanguageCode.ja]: 'SSOユーザー情報の取得に失敗しました',
        [core_1.LanguageCode.ko]: 'SSO 사용자 정보 조회에 실패했습니다',
    },
};
//# sourceMappingURL=i18n-messages.js.map