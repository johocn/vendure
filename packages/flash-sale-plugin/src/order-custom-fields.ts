import { CustomFields, LanguageCode } from '@vendure/core';

export const flashSaleOrderCustomFields: CustomFields = {
    Order: [
        { name: 'flashSaleActivityId', type: 'int', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '秒杀活动ID' }] },
        { name: 'flashSaleStartAt', type: 'datetime', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '秒杀开始时间' }] },
        { name: 'flashSaleEndAt', type: 'datetime', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '秒杀结束时间' }] },
    ],
};
