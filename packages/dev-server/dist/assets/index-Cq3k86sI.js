import{g as n,u as a,a as c,j as r,T as d,x as p}from"./index-Db6dV6Bh.js";import"./manage-languages-dialog-BNYgrwy7.js";import"./login-form-CIdUAdad.js";import"./channel-selector-CeKjvQ9G.js";import"./country-selector-BmzBO8Pj.js";import"./customer-address-form-BX7cDyfU.js";import"./customer-selector-OnV0C9_o.js";import"./history-entry-extensions-4DS7auz2.js";import"./language-selector-ClptxUDN.js";import"./product-variant-selector-2aCD1TMR.js";import"./role-selector-B3l59nEw.js";import"./seller-selector-fYPVM0QU.js";import"./tax-category-selector-D4ySV-ry.js";import"./zone-selector-BO_4_EqC.js";import"./sidebar-context-DHHru3SM.js";import"./common-operations-DkeS1WEu.js";import"./use-job-queue-polling-B74dPsjv.js";import{L as t}from"./labeled-data-Bpii8F0w.js";import"./eye-C07Z7S5I.js";import"./form-field-wrapper-BoTFZWUC.js";const u=n(`
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
