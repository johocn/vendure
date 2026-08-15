import{L as o,j as i,Q as a,N as d,d as m}from"./index-CfivDxyc.js";import"./manage-languages-dialog-jxDgDM_E.js";import"./login-form-dN2Am_qx.js";import"./channel-selector-Ron1860q.js";import"./country-selector-Cuy-3TuH.js";import"./customer-address-form-BFVuOD5x.js";import"./customer-selector-BFPANTem.js";import"./history-entry-extensions-BUUmrAfT.js";import"./language-selector-CdfSFhKU.js";import"./product-variant-selector-j3jNI8de.js";import"./role-selector-COKt3Xxr.js";import"./seller-selector-BVqkydOL.js";import"./tax-category-selector-D6o2TRrv.js";import"./zone-selector-PlHdxnLD.js";import"./sidebar-context-Cy6uNzT7.js";import"./common-operations-CvUJQuIN.js";import"./use-job-queue-polling-DSTQoH3Y.js";import{L as l}from"./list-page-B52oWElI.js";import{D as u}from"./detail-page-GIWtgRmM.js";import{D as c}from"./detail-page-button-DDJQPHS5.js";import{U as p}from"./user-check-BBftfSS1.js";import"./eye-D23-6w4z.js";import"./form-field-wrapper-CCW1n5aN.js";const b=o(`
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
`),g={navMenuItem:{sectionId:"distribution",id:"commission-records",url:"/commission-records",title:"Commissions",requiresPermission:["ReadCustomer"]},path:"/commission-records",loader:()=>({breadcrumb:"Commission Records"}),component:s=>i.jsx(l,{pageId:"commission-record-list",title:i.jsx(a,{id:"poqW8W"}),listQuery:b,route:s,defaultVisibility:{commissionRate:!1,settledAt:!1},customizeColumns:{commissionType:{header:"Type",cell:({row:t})=>t.original.commissionType==="direct"?"Direct":"Indirect"},status:{header:"Status",cell:({row:t})=>{const e=t.original.status,r={pending:"bg-yellow-100 text-yellow-800",confirmed:"bg-green-100 text-green-800",paid:"bg-blue-100 text-blue-800",cancelled:"bg-gray-100 text-gray-800"};return i.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r[e]||""}`,children:e})}}}})},f=[{pageId:"channel-detail"}],h=[{pageId:"customer-detail"}],n=o(`
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
`),x={path:"/distributors/$id",loader:d({queryDocument:n,breadcrumb:(s,t)=>[{path:"/distributors",label:"Distributors"},s?"New":t?.referralCode]}),component:s=>i.jsx(u,{pageId:"distributor-detail",queryDocument:n,route:s,title:t=>t.referralCode||t.id})},y=o(`
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
`),D={navMenuItem:{sectionId:"distribution",id:"withdrawal-requests",url:"/withdrawal-requests",title:"Withdrawals",requiresPermission:["ReadCustomer"]},path:"/withdrawal-requests",loader:()=>({breadcrumb:"Withdrawal Requests"}),component:s=>i.jsx(l,{pageId:"withdrawal-request-list",title:i.jsx(a,{id:"TpkLWg"}),listQuery:w,route:s,defaultVisibility:{reviewedAt:!1,paidAt:!1},customizeColumns:{method:{header:"Method",cell:({row:t})=>{const e=t.original.method;return{bank:"Bank",alipay:"Alipay",wechat:"WeChat"}[e]||e}},status:{header:"Status",cell:({row:t})=>{const e=t.original.status,r={pending:"bg-yellow-100 text-yellow-800",approved:"bg-green-100 text-green-800",rejected:"bg-red-100 text-red-800",paid:"bg-blue-100 text-blue-800"};return i.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r[e]||""}`,children:e})}}}})};m({navSections:[{id:"distribution",title:"Distribution",icon:p,order:700}],routes:[I,x,g,D],detailForms:[...f,...h]});
