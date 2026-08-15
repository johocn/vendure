import{L as o,j as e,Q as m,d as a}from"./index-B5sUqbxQ.js";import"./manage-languages-dialog-DZzJpRkY.js";import"./login-form-CMc_B2Yh.js";import"./channel-selector-CmTaPcID.js";import"./country-selector-Bqy3z5Mx.js";import"./customer-address-form-4GKtopmE.js";import"./customer-selector-BjvA1ZiR.js";import"./history-entry-extensions-BNMYIyYp.js";import"./language-selector-B-s78i-r.js";import"./product-variant-selector-CrX-3WSD.js";import"./role-selector-DOCSxlnZ.js";import"./seller-selector-CnmJ_4Ui.js";import"./tax-category-selector-SCHZdOA5.js";import"./zone-selector-BuTiNfbw.js";import"./sidebar-context-CCpKufl3.js";import"./common-operations-CrlPxpHP.js";import"./use-job-queue-polling-BkonPsNG.js";import{L as n}from"./list-page-LXIeoLMh.js";import"./eye-DMZf5K_a.js";import"./form-field-wrapper-WByjkV3U.js";const p=o(`
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
