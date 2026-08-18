import{g as n,u as a,a as c,j as r,T as d,x as p}from"./index-q8xQ09Gk.js";import"./manage-languages-dialog-ZLK1UcKs.js";import"./login-form-CQYuZP-E.js";import"./channel-selector-D8x7rreQ.js";import"./country-selector-4_UxwAe9.js";import"./customer-address-form-CS7UPAc8.js";import"./customer-selector-BYX0f6BV.js";import"./history-entry-extensions-BNwdiQmW.js";import"./language-selector-Bl8bN85G.js";import"./product-variant-selector-BY90oFrQ.js";import"./role-selector-Cpe-3bJU.js";import"./seller-selector-CdA_BaU6.js";import"./tax-category-selector-neBdiwIn.js";import"./zone-selector-Z1q-EIyt.js";import"./sidebar-context-BZG1o8ro.js";import"./common-operations-DiEBC9Rh.js";import"./use-job-queue-polling-C-z0h4vP.js";import{L as t}from"./labeled-data-Ca18l7pI.js";import"./eye-Ba1S8OiU.js";import"./form-field-wrapper-sMWnENrA.js";const u=n(`
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
