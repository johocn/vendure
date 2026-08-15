import{L as n,j as e,Q as d,az as c,aA as m,d as p}from"./index-CfivDxyc.js";import"./manage-languages-dialog-jxDgDM_E.js";import"./login-form-dN2Am_qx.js";import"./channel-selector-Ron1860q.js";import"./country-selector-Cuy-3TuH.js";import"./customer-address-form-BFVuOD5x.js";import"./customer-selector-BFPANTem.js";import"./history-entry-extensions-BUUmrAfT.js";import"./language-selector-CdfSFhKU.js";import"./product-variant-selector-j3jNI8de.js";import"./role-selector-COKt3Xxr.js";import"./seller-selector-BVqkydOL.js";import"./tax-category-selector-D6o2TRrv.js";import"./zone-selector-PlHdxnLD.js";import"./sidebar-context-Cy6uNzT7.js";import"./common-operations-CvUJQuIN.js";import"./use-job-queue-polling-DSTQoH3Y.js";import{L as u}from"./list-page-B52oWElI.js";import{L as o}from"./labeled-data-glW0u7T8.js";import"./eye-D23-6w4z.js";import"./form-field-wrapper-CCW1n5aN.js";const g=n(`
    query GetReviews {
        reviews {
            items {
                id
                customerId
                productId
                rating
                content
                status
                createdAt
            }
            totalItems
        }
    }
`),x={navMenuItem:{sectionId:"catalog",id:"reviews",url:"/reviews",title:"评价管理",requiresPermission:["ReadCatalog"]},path:"/reviews",loader:()=>({breadcrumb:"评价管理"}),component:a=>e.jsx(u,{pageId:"review-list",title:e.jsx(d,{id:"rVg7PG"}),listQuery:g,route:a,customizeColumns:{rating:{header:"评分",cell:({row:r})=>{const t=Number(r.original.rating)||0;return e.jsxs("span",{className:"text-sm","aria-label":`${t}/5`,children:[e.jsx("span",{className:"text-yellow-500",children:"★".repeat(t)}),e.jsx("span",{className:"text-muted-foreground",children:"☆".repeat(5-t)})]})}},status:{header:"状态",cell:({row:r})=>{const t=r.original.status,i={pending:"bg-yellow-100 text-yellow-800",approved:"bg-green-100 text-green-800",rejected:"bg-red-100 text-red-800"};return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${i[t]||""}`,children:t})}}}})},v=n(`
    query GetReviewStats($productId: ID!) {
        reviewStats(productId: $productId) {
            totalCount
            goodRate
            averageRating
        }
    }
`),w={id:"review-stats",title:e.jsx(d,{id:"wyYOzQ"}),location:{pageId:"product-detail",column:"side",position:{blockId:"enabled-toggle",order:"after"}},shouldRender:()=>!0,component:({context:a})=>{const t=a.entity?.id,{data:i,isLoading:l}=c({queryKey:["reviewStats",t],queryFn:()=>m.query(v,{productId:String(t)}),enabled:!!t}),s=i?.reviewStats;return l?e.jsx("div",{className:"text-sm text-muted-foreground",children:"加载中..."}):s?e.jsxs("div",{className:"space-y-2",children:[e.jsx(o,{label:"评价总数",children:s.totalCount}),e.jsxs(o,{label:"好评率",children:[s.goodRate,"%"]}),e.jsx(o,{label:"平均评分",children:s.averageRating})]}):e.jsx("div",{className:"text-sm text-muted-foreground",children:"暂无评价数据"})}};p({routes:[x],pageBlocks:[w]});
