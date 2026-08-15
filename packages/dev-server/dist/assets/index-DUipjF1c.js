import{L as n,az as a,aA as c,j as r,Q as d,d as p}from"./index-CfivDxyc.js";import"./manage-languages-dialog-jxDgDM_E.js";import"./login-form-dN2Am_qx.js";import"./channel-selector-Ron1860q.js";import"./country-selector-Cuy-3TuH.js";import"./customer-address-form-BFVuOD5x.js";import"./customer-selector-BFPANTem.js";import"./history-entry-extensions-BUUmrAfT.js";import"./language-selector-CdfSFhKU.js";import"./product-variant-selector-j3jNI8de.js";import"./role-selector-COKt3Xxr.js";import"./seller-selector-BVqkydOL.js";import"./tax-category-selector-D6o2TRrv.js";import"./zone-selector-PlHdxnLD.js";import"./sidebar-context-Cy6uNzT7.js";import"./common-operations-CvUJQuIN.js";import"./use-job-queue-polling-DSTQoH3Y.js";import{L as t}from"./labeled-data-glW0u7T8.js";import"./eye-D23-6w4z.js";import"./form-field-wrapper-CCW1n5aN.js";const u=n(`
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
