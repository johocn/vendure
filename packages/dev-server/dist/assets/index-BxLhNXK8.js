import{g as n,u as a,a as c,j as r,T as d,x as p}from"./index-DqgpDxui.js";import"./manage-languages-dialog-BetjS6XX.js";import"./login-form-Dm9gd9kz.js";import"./channel-selector-DN2FdeUA.js";import"./country-selector-CGyZPIov.js";import"./customer-address-form-5ecKA6wJ.js";import"./customer-selector-C3pDo_8O.js";import"./history-entry-extensions-B_N18a_0.js";import"./language-selector-DG50oEtN.js";import"./product-variant-selector-DjeQkK_7.js";import"./role-selector-D4umQAXx.js";import"./seller-selector-D_JtZbn9.js";import"./tax-category-selector-Blegjoyo.js";import"./zone-selector-DCf4QXpn.js";import"./sidebar-context-Div_qWqv.js";import"./common-operations-BP0miUeH.js";import"./use-job-queue-polling-DkTxWiBE.js";import{L as t}from"./labeled-data-WAmpRgqt.js";import"./eye-D9dO7P2X.js";import"./form-field-wrapper-CJJV-zqX.js";const u=n(`
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
