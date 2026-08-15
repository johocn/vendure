import{g as o,j as e,T as m,x as a}from"./index-DqgpDxui.js";import"./manage-languages-dialog-BetjS6XX.js";import"./login-form-Dm9gd9kz.js";import"./channel-selector-DN2FdeUA.js";import"./country-selector-CGyZPIov.js";import"./customer-address-form-5ecKA6wJ.js";import"./customer-selector-C3pDo_8O.js";import"./history-entry-extensions-B_N18a_0.js";import"./language-selector-DG50oEtN.js";import"./product-variant-selector-DjeQkK_7.js";import"./role-selector-D4umQAXx.js";import"./seller-selector-D_JtZbn9.js";import"./tax-category-selector-Blegjoyo.js";import"./zone-selector-DCf4QXpn.js";import"./sidebar-context-Div_qWqv.js";import"./common-operations-BP0miUeH.js";import"./use-job-queue-polling-DkTxWiBE.js";import{L as n}from"./list-page-DvJkYXw6.js";import"./eye-D9dO7P2X.js";import"./form-field-wrapper-CJJV-zqX.js";const p=o(`
    query GetSubscribeMessageLogs {
        subscribeMessageLogs {
            items {
                id
                customerId
                openid
                templateId
                status
                errorMsg
                sentAt
                createdAt
            }
            totalItems
        }
    }
`),g={navMenuItem:{sectionId:"marketing",id:"subscribe-message-logs",url:"/subscribe-message-logs",title:"订阅消息日志",requiresPermission:["ReadSettings"]},path:"/subscribe-message-logs",loader:()=>({breadcrumb:"订阅消息日志"}),component:t=>e.jsx(n,{pageId:"subscribe-message-log-list",title:e.jsx(m,{id:"cF8ysM"}),listQuery:p,route:t,customizeColumns:{status:{header:"状态",cell:({row:r})=>{const s=r.original.status,i={success:"bg-green-100 text-green-800",failed:"bg-red-100 text-red-800",pending:"bg-yellow-100 text-yellow-800"};return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${i[s]||""}`,children:s})}}}})};a({routes:[g]});
