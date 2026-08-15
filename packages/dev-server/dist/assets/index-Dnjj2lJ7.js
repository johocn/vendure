import{aY as c,j as e,Q as d,L as s,N as m,d as u}from"./index-B5sUqbxQ.js";import"./manage-languages-dialog-DZzJpRkY.js";import"./login-form-CMc_B2Yh.js";import"./channel-selector-CmTaPcID.js";import"./country-selector-Bqy3z5Mx.js";import"./customer-address-form-4GKtopmE.js";import"./customer-selector-BjvA1ZiR.js";import"./history-entry-extensions-BNMYIyYp.js";import"./language-selector-B-s78i-r.js";import"./product-variant-selector-CrX-3WSD.js";import"./role-selector-DOCSxlnZ.js";import"./seller-selector-CnmJ_4Ui.js";import"./tax-category-selector-SCHZdOA5.js";import"./zone-selector-BuTiNfbw.js";import"./sidebar-context-CCpKufl3.js";import"./common-operations-CrlPxpHP.js";import"./use-job-queue-polling-BkonPsNG.js";import{L as r}from"./labeled-data-rY1JsJQW.js";import{D as o}from"./detail-page-button-DM6TuE-0.js";import{D as p}from"./detail-page-BA7CFeUg.js";import{L as h}from"./list-page-LXIeoLMh.js";import"./eye-DMZf5K_a.js";import"./form-field-wrapper-WByjkV3U.js";const f={id:"flash-sale-info",title:e.jsx(d,{id:"OHQagY"}),location:{pageId:"order-detail",column:"side",position:{blockId:"group-buy-info",order:"after"}},shouldRender:i=>!!i.entity?.customFields?.flashSaleActivityId,component:({context:i})=>{const a=i.entity?.customFields,{formatDate:l}=c();return a?.flashSaleActivityId?e.jsxs("div",{className:"space-y-2",children:[e.jsx(r,{label:"Activity ID",children:e.jsx(o,{href:`/flash-sale-activities/${a.flashSaleActivityId}`,label:String(a.flashSaleActivityId)})}),a.flashSaleStartAt&&e.jsx(r,{label:"Start At",children:l(a.flashSaleStartAt)}),a.flashSaleEndAt&&e.jsx(r,{label:"End At",children:l(a.flashSaleEndAt)})]}):null}},n=s(`
    query GetFlashSaleDetail($id: ID!) {
        flashSaleActivity(id: $id) {
            id
            name
            startAt
            endAt
            flashPrice
            totalStock
            soldCount
            limitPerUser
            status
            createdAt
            updatedAt
        }
    }
`),S=s(`
    mutation CreateFlashSaleActivity($input: CreateFlashSaleActivityInput!) {
        createFlashSaleActivity(input: $input) {
            id
        }
    }
`),A=s(`
    mutation UpdateFlashSaleActivity($input: UpdateFlashSaleActivityInput!) {
        updateFlashSaleActivity(input: $input) {
            id
        }
    }
`),g={path:"/flash-sale-activities/$id",loader:m({queryDocument:n,breadcrumb:(i,t)=>[{path:"/flash-sale-activities",label:"Flash Sale"},i?"New":t?.name]}),component:i=>e.jsx(p,{pageId:"flash-sale-detail",queryDocument:n,createDocument:S,updateDocument:A,route:i,title:t=>t.name,setValuesForUpdate:t=>({id:t.id,name:t.name,startAt:t.startAt,endAt:t.endAt,flashPrice:t.flashPrice,totalStock:t.totalStock,limitPerUser:t.limitPerUser,status:t.status})})},y=s(`
    query GetFlashSaleActivities($options: Json) {
        flashSaleActivities(options: $options) {
            items {
                id
                name
                status
                flashPrice
                totalStock
                soldCount
                limitPerUser
                startAt
                endAt
            }
            totalItems
        }
    }
`),x={navMenuItem:{sectionId:"marketing",id:"flash-sale-activities",url:"/flash-sale-activities",title:"Flash Sale",requiresPermission:["ReadPromotion"]},path:"/flash-sale-activities",loader:()=>({breadcrumb:"Flash Sale"}),component:i=>e.jsx(h,{pageId:"flash-sale-list",title:e.jsx(d,{id:"y9qrqs"}),listQuery:y,route:i,defaultVisibility:{limitPerUser:!1},customizeColumns:{id:{header:"ID",cell:({row:t})=>e.jsx(o,{id:t.original.id,label:t.original.id})},name:{header:"Name",cell:({row:t})=>e.jsx(o,{id:t.original.id,label:t.original.name})},status:{header:"Status",cell:({row:t})=>{const a=t.original.status,l={upcoming:"bg-yellow-100 text-yellow-800",active:"bg-green-100 text-green-800",ended:"bg-gray-100 text-gray-800"};return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${l[a]||""}`,children:a})}}}})};u({routes:[x,g],pageBlocks:[f]});
