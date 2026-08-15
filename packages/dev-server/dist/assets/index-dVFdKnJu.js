import{g as o,j as e,T as m,x as a}from"./index-B1sf7x_O.js";import"./manage-languages-dialog-BVTJMLEg.js";import"./login-form-Ds1edQZO.js";import"./channel-selector-C0ZWPrSZ.js";import"./country-selector-Byp8w1Bu.js";import"./customer-address-form-CwaDxxkG.js";import"./customer-selector-D3zSoGdM.js";import"./history-entry-extensions-BpUGlrhV.js";import"./language-selector-xyyqGUlx.js";import"./product-variant-selector-BZUYxoGb.js";import"./role-selector-riPtM122.js";import"./seller-selector-CKFwOIVO.js";import"./tax-category-selector-DZITJSxF.js";import"./zone-selector-CFPlxJFT.js";import"./sidebar-context-Bhm13uza.js";import"./common-operations-CzNq3Q_b.js";import"./use-job-queue-polling-_gLF-CWF.js";import{L as n}from"./list-page-B-MZa7TG.js";import"./eye-DcYNjVXo.js";import"./form-field-wrapper-BNTKMeyn.js";const p=o(`
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
