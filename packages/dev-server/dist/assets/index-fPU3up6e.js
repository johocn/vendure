import{g as o,j as i,T as a,d,x as m}from"./index-Db6dV6Bh.js";import"./manage-languages-dialog-BNYgrwy7.js";import"./login-form-CIdUAdad.js";import"./channel-selector-CeKjvQ9G.js";import"./country-selector-BmzBO8Pj.js";import"./customer-address-form-BX7cDyfU.js";import"./customer-selector-OnV0C9_o.js";import"./history-entry-extensions-4DS7auz2.js";import"./language-selector-ClptxUDN.js";import"./product-variant-selector-2aCD1TMR.js";import"./role-selector-B3l59nEw.js";import"./seller-selector-fYPVM0QU.js";import"./tax-category-selector-D4ySV-ry.js";import"./zone-selector-BO_4_EqC.js";import"./sidebar-context-DHHru3SM.js";import"./common-operations-DkeS1WEu.js";import"./use-job-queue-polling-B74dPsjv.js";import{L as l}from"./list-page-CE3qHLcE.js";import{D as u}from"./detail-page-CeJLV9Tn.js";import{D as c}from"./detail-page-button-DbXTIQoM.js";import{U as p}from"./user-check-CzX0czR8.js";import"./eye-C07Z7S5I.js";import"./form-field-wrapper-BoTFZWUC.js";const b=o(`
    query GetCommissionRecords($options: CommissionRecordListOptions) {
        commissionRecords(options: $options) {
            items {
                id
                distributorId
                orderId
                commissionType
                commissionRate
                orderAmount
                commissionAmount
                status
                settledAt
                createdAt
            }
            totalItems
        }
    }
`),g={navMenuItem:{sectionId:"distribution",id:"commission-records",url:"/commission-records",title:"Commissions",requiresPermission:["ReadCustomer"]},path:"/commission-records",loader:()=>({breadcrumb:"Commission Records"}),component:s=>i.jsx(l,{pageId:"commission-record-list",title:i.jsx(a,{id:"poqW8W"}),listQuery:b,route:s,defaultVisibility:{commissionRate:!1,settledAt:!1},customizeColumns:{commissionType:{header:"Type",cell:({row:t})=>t.original.commissionType==="direct"?"Direct":"Indirect"},status:{header:"Status",cell:({row:t})=>{const e=t.original.status,r={pending:"bg-yellow-100 text-yellow-800",confirmed:"bg-green-100 text-green-800",paid:"bg-blue-100 text-blue-800",cancelled:"bg-gray-100 text-gray-800"};return i.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r[e]||""}`,children:e})}}}})},f=[{pageId:"channel-detail"}],x=[{pageId:"customer-detail"}],n=o(`
    query GetDistributorDetail($id: ID!) {
        distributors(options: { filter: { id: { eq: $id } } }) {
            items {
                id
                customerId
                parentId
                level
                status
                totalEarnings
                availableBalance
                frozenBalance
                referralCode
                createdAt
                updatedAt
            }
            totalItems
        }
    }
`),h={path:"/distributors/$id",loader:d({queryDocument:n,breadcrumb:(s,t)=>[{path:"/distributors",label:"Distributors"},s?"New":t?.referralCode]}),component:s=>i.jsx(u,{pageId:"distributor-detail",queryDocument:n,route:s,title:t=>t.referralCode||t.id})},y=o(`
    query GetDistributors($options: DistributorListOptions) {
        distributors(options: $options) {
            items {
                id
                customerId
                parentId
                level
                status
                totalEarnings
                availableBalance
                frozenBalance
                referralCode
            }
            totalItems
        }
    }
`),I={navMenuItem:{sectionId:"distribution",id:"distributors",url:"/distributors",title:"Distributors",requiresPermission:["ReadCustomer"]},path:"/distributors",loader:()=>({breadcrumb:"Distributors"}),component:s=>i.jsx(l,{pageId:"distributor-list",title:i.jsx(a,{id:"6r5Red"}),listQuery:y,route:s,defaultVisibility:{parentId:!1,level:!1,frozenBalance:!1,referralCode:!1},customizeColumns:{id:{header:"ID",cell:({row:t})=>i.jsx(c,{id:t.original.id,label:t.original.id})},referralCode:{header:"Referral Code",cell:({row:t})=>i.jsx("span",{className:"font-mono text-sm",children:t.original.referralCode})},status:{header:"Status",cell:({row:t})=>{const e=t.original.status,r={active:"bg-green-100 text-green-800",frozen:"bg-blue-100 text-blue-800",pending:"bg-yellow-100 text-yellow-800"};return i.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r[e]||""}`,children:e})}}}})},w=o(`
    query GetWithdrawalRequests($options: WithdrawalRequestListOptions) {
        withdrawalRequests(options: $options) {
            items {
                id
                distributorId
                amount
                method
                accountInfo
                status
                reviewedAt
                paidAt
                createdAt
            }
            totalItems
        }
    }
`),D={navMenuItem:{sectionId:"distribution",id:"withdrawal-requests",url:"/withdrawal-requests",title:"Withdrawals",requiresPermission:["ReadCustomer"]},path:"/withdrawal-requests",loader:()=>({breadcrumb:"Withdrawal Requests"}),component:s=>i.jsx(l,{pageId:"withdrawal-request-list",title:i.jsx(a,{id:"TpkLWg"}),listQuery:w,route:s,defaultVisibility:{reviewedAt:!1,paidAt:!1},customizeColumns:{method:{header:"Method",cell:({row:t})=>{const e=t.original.method;return{bank:"Bank",alipay:"Alipay",wechat:"WeChat"}[e]||e}},status:{header:"Status",cell:({row:t})=>{const e=t.original.status,r={pending:"bg-yellow-100 text-yellow-800",approved:"bg-green-100 text-green-800",rejected:"bg-red-100 text-red-800",paid:"bg-blue-100 text-blue-800"};return i.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r[e]||""}`,children:e})}}}})};m({navSections:[{id:"distribution",title:"Distribution",icon:p,order:700}],routes:[I,h,g,D],detailForms:[...f,...x]});
