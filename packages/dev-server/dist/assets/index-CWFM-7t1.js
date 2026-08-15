import{g as o,j as e,T as m,x as a}from"./index-Db6dV6Bh.js";import"./manage-languages-dialog-BNYgrwy7.js";import"./login-form-CIdUAdad.js";import"./channel-selector-CeKjvQ9G.js";import"./country-selector-BmzBO8Pj.js";import"./customer-address-form-BX7cDyfU.js";import"./customer-selector-OnV0C9_o.js";import"./history-entry-extensions-4DS7auz2.js";import"./language-selector-ClptxUDN.js";import"./product-variant-selector-2aCD1TMR.js";import"./role-selector-B3l59nEw.js";import"./seller-selector-fYPVM0QU.js";import"./tax-category-selector-D4ySV-ry.js";import"./zone-selector-BO_4_EqC.js";import"./sidebar-context-DHHru3SM.js";import"./common-operations-DkeS1WEu.js";import"./use-job-queue-polling-B74dPsjv.js";import{L as n}from"./list-page-CE3qHLcE.js";import"./eye-C07Z7S5I.js";import"./form-field-wrapper-BoTFZWUC.js";const p=o(`
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
