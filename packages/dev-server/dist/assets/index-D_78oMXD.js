import{g as n,j as e,T as d,u as c,a as m,x as p}from"./index-BxmvIxaG.js";import"./manage-languages-dialog-BhjPy2sS.js";import"./login-form-CJL4WxMz.js";import"./channel-selector-D7DXpwvB.js";import"./country-selector-DoRAG6nK.js";import"./customer-address-form-S6Bu7v-m.js";import"./customer-selector-B1xaxApB.js";import"./history-entry-extensions-B42x2igA.js";import"./language-selector-CbX2V-gv.js";import"./product-variant-selector-RCL9t8XK.js";import"./role-selector-DfYSsYWx.js";import"./seller-selector-BGAxfHB4.js";import"./tax-category-selector-DuAPocJu.js";import"./zone-selector-riLzradK.js";import"./sidebar-context-BgdxRmkt.js";import"./common-operations-CH6P-QVK.js";import"./use-job-queue-polling-BCjGtYLB.js";import{L as u}from"./list-page-DG4CHTjL.js";import{L as a}from"./labeled-data-Dv4q63at.js";import"./eye-D97lx3N5.js";import"./form-field-wrapper-BiHSWRht.js";const g=n(`
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
`),x={navMenuItem:{sectionId:"catalog",id:"reviews",url:"/reviews",title:"评价管理",requiresPermission:["ReadCatalog"]},path:"/reviews",loader:()=>({breadcrumb:"评价管理"}),component:i=>e.jsx(u,{pageId:"review-list",title:e.jsx(d,{id:"rVg7PG"}),listQuery:g,route:i,customizeColumns:{rating:{header:"评分",cell:({row:r})=>{const t=Number(r.original.rating)||0;return e.jsxs("span",{className:"text-sm","aria-label":`${t}/5`,children:[e.jsx("span",{className:"text-yellow-500",children:"★".repeat(t)}),e.jsx("span",{className:"text-muted-foreground",children:"☆".repeat(5-t)})]})}},status:{header:"状态",cell:({row:r})=>{const t=r.original.status,o={pending:"bg-yellow-100 text-yellow-800",approved:"bg-green-100 text-green-800",rejected:"bg-red-100 text-red-800"};return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${o[t]||""}`,children:t})}}}})},v=n(`
    query GetReviewStats($productId: ID!) {
        reviewStats(productId: $productId) {
            totalCount
            goodRate
            averageRating
        }
    }
`),w={id:"review-stats",title:e.jsx(d,{id:"wyYOzQ"}),location:{pageId:"product-detail",column:"side",position:{blockId:"enabled-toggle",order:"after"}},shouldRender:()=>!0,component:({context:i})=>{const t=i.entity?.id,{data:o,isLoading:l}=c({queryKey:["reviewStats",t],queryFn:()=>m.query(v,{productId:String(t)}),enabled:!!t}),s=o?.reviewStats;return l?e.jsx("div",{className:"text-sm text-muted-foreground",children:"加载中..."}):s?e.jsxs("div",{className:"space-y-2",children:[e.jsx(a,{label:"评价总数",children:s.totalCount}),e.jsxs(a,{label:"好评率",children:[s.goodRate,"%"]}),e.jsx(a,{label:"平均评分",children:s.averageRating})]}):e.jsx("div",{className:"text-sm text-muted-foreground",children:"暂无评价数据"})}};p({routes:[x],pageBlocks:[w]});
