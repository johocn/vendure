import{g as o,j as e,T as m,x as a}from"./index-BxmvIxaG.js";import"./manage-languages-dialog-BhjPy2sS.js";import"./login-form-CJL4WxMz.js";import"./channel-selector-D7DXpwvB.js";import"./country-selector-DoRAG6nK.js";import"./customer-address-form-S6Bu7v-m.js";import"./customer-selector-B1xaxApB.js";import"./history-entry-extensions-B42x2igA.js";import"./language-selector-CbX2V-gv.js";import"./product-variant-selector-RCL9t8XK.js";import"./role-selector-DfYSsYWx.js";import"./seller-selector-BGAxfHB4.js";import"./tax-category-selector-DuAPocJu.js";import"./zone-selector-riLzradK.js";import"./sidebar-context-BgdxRmkt.js";import"./common-operations-CH6P-QVK.js";import"./use-job-queue-polling-BCjGtYLB.js";import{L as n}from"./list-page-DG4CHTjL.js";import"./eye-D97lx3N5.js";import"./form-field-wrapper-BiHSWRht.js";const p=o(`
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
