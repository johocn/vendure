import{j as o,Q as r,L as s,d as p}from"./index-B5sUqbxQ.js";import"./manage-languages-dialog-DZzJpRkY.js";import"./login-form-CMc_B2Yh.js";import"./channel-selector-CmTaPcID.js";import"./country-selector-Bqy3z5Mx.js";import"./customer-address-form-4GKtopmE.js";import"./customer-selector-BjvA1ZiR.js";import"./history-entry-extensions-BNMYIyYp.js";import"./language-selector-B-s78i-r.js";import"./product-variant-selector-CrX-3WSD.js";import"./role-selector-DOCSxlnZ.js";import"./seller-selector-CnmJ_4Ui.js";import"./tax-category-selector-SCHZdOA5.js";import"./zone-selector-BuTiNfbw.js";import"./sidebar-context-CCpKufl3.js";import"./common-operations-CrlPxpHP.js";import"./use-job-queue-polling-BkonPsNG.js";import{L as a}from"./labeled-data-rY1JsJQW.js";import{L as c}from"./list-page-LXIeoLMh.js";import"./eye-DMZf5K_a.js";import"./form-field-wrapper-WByjkV3U.js";const d={id:"coupon-info",title:o.jsx(r,{id:"7J14Nc"}),location:{pageId:"order-detail",column:"side",position:{blockId:"flash-sale-info",order:"after"}},shouldRender:t=>!!t.entity?.customFields?.appliedCouponCode,component:({context:t})=>{const e=t.entity?.customFields;return e?.appliedCouponCode?o.jsx("div",{className:"space-y-2",children:o.jsx(a,{label:"优惠券码",children:e.appliedCouponCode})}):null}},m=s(`
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
