import{j as o,Q as r,L as s,d as p}from"./index-CfivDxyc.js";import"./manage-languages-dialog-jxDgDM_E.js";import"./login-form-dN2Am_qx.js";import"./channel-selector-Ron1860q.js";import"./country-selector-Cuy-3TuH.js";import"./customer-address-form-BFVuOD5x.js";import"./customer-selector-BFPANTem.js";import"./history-entry-extensions-BUUmrAfT.js";import"./language-selector-CdfSFhKU.js";import"./product-variant-selector-j3jNI8de.js";import"./role-selector-COKt3Xxr.js";import"./seller-selector-BVqkydOL.js";import"./tax-category-selector-D6o2TRrv.js";import"./zone-selector-PlHdxnLD.js";import"./sidebar-context-Cy6uNzT7.js";import"./common-operations-CvUJQuIN.js";import"./use-job-queue-polling-DSTQoH3Y.js";import{L as a}from"./labeled-data-glW0u7T8.js";import{L as c}from"./list-page-B52oWElI.js";import"./eye-D23-6w4z.js";import"./form-field-wrapper-CCW1n5aN.js";const d={id:"coupon-info",title:o.jsx(r,{id:"7J14Nc"}),location:{pageId:"order-detail",column:"side",position:{blockId:"flash-sale-info",order:"after"}},shouldRender:t=>!!t.entity?.customFields?.appliedCouponCode,component:({context:t})=>{const e=t.entity?.customFields;return e?.appliedCouponCode?o.jsx("div",{className:"space-y-2",children:o.jsx(a,{label:"优惠券码",children:e.appliedCouponCode})}):null}},m=s(`
    query GetCoupons {
        coupons {
            items {
                id
                name
                couponType
                discountValue
                minSpend
                startAt
                endAt
                totalQuantity
                claimedCount
                isActive
            }
            totalItems
        }
    }
`),l={navMenuItem:{sectionId:"marketing",id:"coupons",url:"/coupons",title:"优惠券",requiresPermission:["ReadPromotion"]},path:"/coupons",loader:()=>({breadcrumb:"优惠券"}),component:t=>o.jsx(c,{pageId:"coupon-list",title:o.jsx(r,{id:"7J14Nc"}),listQuery:m,route:t,customizeColumns:{isActive:{header:"状态",cell:({row:i})=>{const e=i.original.isActive,n=e?"bg-green-100 text-green-800":"bg-gray-100 text-gray-800";return o.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${n}`,children:e?"启用":"停用"})}}}})};p({routes:[l],pageBlocks:[d]});
