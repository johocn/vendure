import{g as o,j as e,T as m,x as a}from"./index-q8xQ09Gk.js";import"./manage-languages-dialog-ZLK1UcKs.js";import"./login-form-CQYuZP-E.js";import"./channel-selector-D8x7rreQ.js";import"./country-selector-4_UxwAe9.js";import"./customer-address-form-CS7UPAc8.js";import"./customer-selector-BYX0f6BV.js";import"./history-entry-extensions-BNwdiQmW.js";import"./language-selector-Bl8bN85G.js";import"./product-variant-selector-BY90oFrQ.js";import"./role-selector-Cpe-3bJU.js";import"./seller-selector-CdA_BaU6.js";import"./tax-category-selector-neBdiwIn.js";import"./zone-selector-Z1q-EIyt.js";import"./sidebar-context-BZG1o8ro.js";import"./common-operations-DiEBC9Rh.js";import"./use-job-queue-polling-C-z0h4vP.js";import{L as n}from"./list-page-D-MY5NSq.js";import"./eye-Ba1S8OiU.js";import"./form-field-wrapper-sMWnENrA.js";const p=o(`
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
