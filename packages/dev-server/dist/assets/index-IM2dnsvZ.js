import{g as n,u as a,a as c,j as r,T as d,x as p}from"./index-BxmvIxaG.js";import"./manage-languages-dialog-BhjPy2sS.js";import"./login-form-CJL4WxMz.js";import"./channel-selector-D7DXpwvB.js";import"./country-selector-DoRAG6nK.js";import"./customer-address-form-S6Bu7v-m.js";import"./customer-selector-B1xaxApB.js";import"./history-entry-extensions-B42x2igA.js";import"./language-selector-CbX2V-gv.js";import"./product-variant-selector-RCL9t8XK.js";import"./role-selector-DfYSsYWx.js";import"./seller-selector-BGAxfHB4.js";import"./tax-category-selector-DuAPocJu.js";import"./zone-selector-riLzradK.js";import"./sidebar-context-BgdxRmkt.js";import"./common-operations-CH6P-QVK.js";import"./use-job-queue-polling-BCjGtYLB.js";import{L as t}from"./labeled-data-Dv4q63at.js";import"./eye-D97lx3N5.js";import"./form-field-wrapper-BiHSWRht.js";const u=n(`
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
