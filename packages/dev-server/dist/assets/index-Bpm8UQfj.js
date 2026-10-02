import{g as n,u as a,a as c,j as r,T as d,x as p}from"./index-BRWcz4T7.js";import"./manage-languages-dialog-Dyik0M6Q.js";import"./login-form-CiSitQcR.js";import"./channel-selector-BWj5KWF3.js";import"./country-selector-IxS5umRK.js";import"./customer-address-form-Dr5GqbpF.js";import"./customer-selector-DqZrTcDA.js";import"./history-entry-extensions-BVZrZBsk.js";import"./language-selector-DYXGp-WE.js";import"./product-variant-selector-Dx8ked_w.js";import"./role-selector-CMNxsQq5.js";import"./seller-selector-CetRtWhQ.js";import"./tax-category-selector-D1ss9x6V.js";import"./zone-selector-C_otEi2y.js";import"./sidebar-context-D86e__tE.js";import"./common-operations-C4rPaDZ-.js";import"./use-job-queue-polling-C7uCqbYm.js";import{L as t}from"./labeled-data-0YRsq-eD.js";import"./eye-BkiwXX5d.js";import"./form-field-wrapper-CW1TuIn2.js";const u=n(`
    query GetMemberInfo($customerId: ID!) {
        memberInfo(customerId: $customerId) {
            level
            levelName
            growthValue
            points
            nextLevelThreshold
            nextLevelName
        }
    }
`),x={id:"member-info",title:r.jsx(d,{id:"8f39x/"}),location:{pageId:"customer-detail",column:"side",position:{blockId:"customer-stats",order:"after"}},shouldRender:o=>!!o.entity?.customFields?.memberLevel,component:({context:o})=>{const m=o.entity?.id,{data:l,isLoading:i}=a({queryKey:["memberInfo",m],queryFn:()=>c.query(u,{customerId:m}),enabled:!!m});if(i)return r.jsx("div",{className:"text-sm text-gray-500",children:"加载中..."});const e=l?.memberInfo;return e?r.jsxs("div",{className:"space-y-2",children:[r.jsx(t,{label:"等级",children:e.level}),r.jsx(t,{label:"等级名称",children:e.levelName}),r.jsx(t,{label:"成长值",children:e.growthValue}),r.jsx(t,{label:"积分",children:e.points}),e.nextLevelThreshold!=null&&r.jsx(t,{label:"下一等级门槛",children:e.nextLevelThreshold}),e.nextLevelName&&r.jsx(t,{label:"下一等级名称",children:e.nextLevelName})]}):null}};p({pageBlocks:[x]});
