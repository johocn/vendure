import{g as n,u as a,a as c,j as r,T as d,x as p}from"./index-B1sf7x_O.js";import"./manage-languages-dialog-BVTJMLEg.js";import"./login-form-Ds1edQZO.js";import"./channel-selector-C0ZWPrSZ.js";import"./country-selector-Byp8w1Bu.js";import"./customer-address-form-CwaDxxkG.js";import"./customer-selector-D3zSoGdM.js";import"./history-entry-extensions-BpUGlrhV.js";import"./language-selector-xyyqGUlx.js";import"./product-variant-selector-BZUYxoGb.js";import"./role-selector-riPtM122.js";import"./seller-selector-CKFwOIVO.js";import"./tax-category-selector-DZITJSxF.js";import"./zone-selector-CFPlxJFT.js";import"./sidebar-context-Bhm13uza.js";import"./common-operations-CzNq3Q_b.js";import"./use-job-queue-polling-_gLF-CWF.js";import{L as t}from"./labeled-data-BJ3oKjTW.js";import"./eye-DcYNjVXo.js";import"./form-field-wrapper-BNTKMeyn.js";const u=n(`
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
