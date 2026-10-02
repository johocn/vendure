import{g as o,j as e,T as m,x as a}from"./index-BRWcz4T7.js";import"./manage-languages-dialog-Dyik0M6Q.js";import"./login-form-CiSitQcR.js";import"./channel-selector-BWj5KWF3.js";import"./country-selector-IxS5umRK.js";import"./customer-address-form-Dr5GqbpF.js";import"./customer-selector-DqZrTcDA.js";import"./history-entry-extensions-BVZrZBsk.js";import"./language-selector-DYXGp-WE.js";import"./product-variant-selector-Dx8ked_w.js";import"./role-selector-CMNxsQq5.js";import"./seller-selector-CetRtWhQ.js";import"./tax-category-selector-D1ss9x6V.js";import"./zone-selector-C_otEi2y.js";import"./sidebar-context-D86e__tE.js";import"./common-operations-C4rPaDZ-.js";import"./use-job-queue-polling-C7uCqbYm.js";import{L as n}from"./list-page-C-wn1e1X.js";import"./eye-BkiwXX5d.js";import"./form-field-wrapper-CW1TuIn2.js";const p=o(`
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
