import{j as e,T as o,g as h,o as U,b as k,r as F,h as S,B as g,q,s as E,a as b,t as u,d as O,J as Q,c as B,P as V,e as K,f as R,i as H,k as f,D as I,m as A,l as z,K as J,N as C,M as $,x as M}from"./index-Db6dV6Bh.js";import"./manage-languages-dialog-BNYgrwy7.js";import"./login-form-CIdUAdad.js";import"./channel-selector-CeKjvQ9G.js";import"./country-selector-BmzBO8Pj.js";import"./customer-address-form-BX7cDyfU.js";import"./customer-selector-OnV0C9_o.js";import"./history-entry-extensions-4DS7auz2.js";import"./language-selector-ClptxUDN.js";import"./product-variant-selector-2aCD1TMR.js";import"./role-selector-B3l59nEw.js";import"./seller-selector-fYPVM0QU.js";import"./tax-category-selector-D4ySV-ry.js";import"./zone-selector-BO_4_EqC.js";import"./sidebar-context-DHHru3SM.js";import"./common-operations-DkeS1WEu.js";import"./use-job-queue-polling-B74dPsjv.js";import{L as X}from"./labeled-data-Bpii8F0w.js";import{L as W}from"./list-page-CE3qHLcE.js";import{F as l}from"./form-field-wrapper-BoTFZWUC.js";import"./eye-C07Z7S5I.js";const Z={id:"coupon-info",title:e.jsx(o,{id:"7J14Nc"}),location:{pageId:"order-detail",column:"side",position:{blockId:"flash-sale-info",order:"after"}},shouldRender:r=>!!r.entity?.customFields?.appliedCouponCode,component:({context:r})=>{const p=r.entity?.customFields;return p?.appliedCouponCode?e.jsx("div",{className:"space-y-2",children:e.jsx(X,{label:"优惠券码",children:p.appliedCouponCode})}):null}},Y=h(`
    query GetCoupons {
        coupons {
            items {
                id
                name
                couponType
                discountValue
                minSpend
                maxDiscount
                startAt
                endAt
                totalQuantity
                claimedCount
                isActive
                isGlobal
                ownerChannelId
                enabledInCurrentChannel
            }
            totalItems
        }
    }
`),_=h(`
    mutation EnableCouponForChannel($id: ID!) {
        enableCouponForChannel(id: $id) {
            id
        }
    }
`),ee=h(`
    mutation DisableCouponForChannel($id: ID!) {
        disableCouponForChannel(id: $id) {
            id
        }
    }
`),ne=h(`
    mutation DeleteCoupon($id: ID!) {
        deleteCoupon(id: $id)
    }
`),te={navMenuItem:{sectionId:"marketing",id:"coupons",url:"/coupons",title:"优惠券",requiresPermission:["ReadPromotion"]},path:"/coupons",loader:()=>({breadcrumb:"优惠券"}),component:r=>e.jsx(se,{route:r})};function se({route:r}){const m=U(),p=k(),[d,j]=F.useState(null),y=()=>{m.invalidateQueries({queryKey:["ListPage"]})},N=async(s,t)=>{j(s);try{t?(await b.mutate(ee,{id:s}),u.success("已禁用该全局优惠券")):(await b.mutate(_,{id:s}),u.success("已启用该全局优惠券")),y()}catch(i){u.error("操作失败: "+(i?.message??"未知错误"))}finally{j(null)}},v=async s=>{if(window.confirm("确定要删除这张优惠券吗？此操作不可撤销。")){j(s);try{await b.mutate(ne,{id:s}),u.success("删除成功"),y()}catch(t){u.error("删除失败: "+(t?.message??"未知错误"))}finally{j(null)}}},a=s=>{p({to:`/coupons/${s}`})};return e.jsx(W,{pageId:"coupon-list",title:e.jsx(o,{id:"7J14Nc"}),listQuery:Y,route:r,defaultVisibility:{name:!0,couponType:!0,discountValue:!0,minSpend:!0,startAt:!0,endAt:!0,totalQuantity:!0,claimedCount:!0,isActive:!0,isGlobal:!0,enabledInCurrentChannel:!0},customizeColumns:{name:{header:"优惠券名称",cell:({row:s})=>{const t=s.original;return t.isGlobal?e.jsx("span",{className:"font-medium",children:t.name}):e.jsx(g,{variant:"ghost",className:"h-auto p-0 font-medium",onClick:()=>a(t.id),children:t.name})}},couponType:{header:"类型",cell:({row:s})=>{const t=s.original.couponType;return e.jsx("span",{className:"text-sm",children:t==="fixed"?"固定金额":t==="percentage"?"百分比":t})}},discountValue:{header:"优惠值",cell:({row:s})=>{const{couponType:t,discountValue:i}=s.original;return e.jsx("span",{className:"text-sm",children:t==="percentage"?`${i}%`:`¥${i}`})}},isActive:{header:"状态",cell:({row:s})=>{const t=s.original.isActive,i=t?"bg-green-100 text-green-800":"bg-gray-100 text-gray-800";return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${i}`,children:t?"启用":"停用"})}},isGlobal:{header:"范围",cell:({row:s})=>{const t=s.original.isGlobal;return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t?"bg-blue-100 text-blue-800":"bg-purple-100 text-purple-800"}`,children:t?"全局":"租户"})}},enabledInCurrentChannel:{header:"渠道启用",cell:({row:s})=>{const t=s.original;if(!t.isGlobal)return e.jsx("span",{className:"text-xs text-muted-foreground",children:"—"});const i=t.enabledInCurrentChannel,D=i?"bg-green-100 text-green-800":"bg-red-100 text-red-800";return e.jsx("span",{className:`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${D}`,children:i?"已启用":"未启用"})}}},additionalColumns:{actions:{header:"操作",cell:({row:s})=>{const t=s.original,i=d===t.id;return t.isGlobal?e.jsx(g,{variant:"outline",size:"sm",disabled:i,onClick:()=>N(t.id,t.enabledInCurrentChannel),children:i?"处理中...":t.enabledInCurrentChannel?"禁用":"启用"}):e.jsxs("div",{className:"flex gap-2",children:[e.jsx(g,{variant:"outline",size:"sm",disabled:i,onClick:()=>a(t.id),children:"编辑"}),e.jsx(g,{variant:"destructive",size:"sm",disabled:i,onClick:()=>v(t.id),children:"删除"})]})}}},children:e.jsx(S,{children:e.jsxs(g,{render:e.jsx(E,{to:"/coupons/new"}),children:[e.jsx(q,{className:"mr-2 h-4 w-4"}),e.jsx(o,{id:"a4dpHk"})]})})})}const L=h(`
    query GetCouponDetail($id: ID!) {
        coupon(id: $id) {
            id
            name
            description
            couponType
            discountValue
            minSpend
            maxDiscount
            startAt
            endAt
            totalQuantity
            claimedCount
            limitPerUser
            isActive
            applicableProductIds
            applicableCategoryIds
            isNewUserOnly
            isGlobal
            ownerChannelId
            enabledInCurrentChannel
            createdAt
            updatedAt
        }
    }
`),w=h(`
    mutation CreateCoupon($input: CreateCouponInput!) {
        createCoupon(input: $input) {
            id
            name
        }
    }
`),T=h(`
    mutation UpdateCoupon($id: ID!, $input: UpdateCouponInput!) {
        updateCoupon(id: $id, input: $input) {
            id
            name
        }
    }
`),ae={path:"/coupons/$id",loader:O({queryDocument:L,breadcrumb:(r,m)=>[{path:"/coupons",label:"优惠券"},r?"新建优惠券":m?.name??"优惠券详情"]}),component:r=>e.jsx(oe,{route:r})};function oe({route:r}){const m=r.useParams(),p=k(),d=m.id==="new",{hasPermissions:j}=Q(),y=j(["SuperAdmin"]),[N,v]=F.useState(!1),{form:a,entity:s,isPending:t,resetForm:i}=B({queryDocument:L,createDocument:w,updateDocument:T,setValuesForUpdate:n=>({name:n.name,description:n.description,startAt:n.startAt,endAt:n.endAt,totalQuantity:n.totalQuantity,limitPerUser:n.limitPerUser,isActive:n.isActive,minSpend:n.minSpend,maxDiscount:n.maxDiscount,isNewUserOnly:n.isNewUserOnly}),params:{id:m.id},onSuccess:async n=>{d&&n?.id&&(u.success("优惠券创建成功"),await p({to:`/coupons/${n.id}`}))},onError:n=>{u.error("保存失败: "+(n?.message??"未知错误"))}}),D=a.handleSubmit(async n=>{v(!0);try{if(d){const x=Object.fromEntries(Object.entries(n).filter(([,P])=>P!=null&&P!=="")),G=await b.mutate(w,{input:x});u.success("优惠券创建成功"),await p({to:`/coupons/${G.createCoupon.id}`})}else await b.mutate(T,{id:m.id,input:n}),u.success("优惠券更新成功"),i()}catch(x){u.error("保存失败: "+(x?.message??"未知错误"))}finally{v(!1)}}),c=s;return e.jsxs(V,{pageId:"coupon-detail",form:a,submitHandler:D,entity:s,children:[e.jsx(K,{children:d?"新建优惠券":c?.name??"优惠券详情"}),e.jsx(R,{children:e.jsx(S,{children:e.jsx(g,{type:"submit",disabled:!a.formState.isDirty||t||N,children:d?"创建":"保存"})})}),e.jsxs(H,{children:[e.jsx(f,{column:"side",blockId:"status",children:e.jsxs(I,{children:[e.jsx(l,{control:a.control,name:"isActive",label:e.jsx(o,{id:"o8Oabk"}),description:e.jsx(o,{id:"MbONrZ"}),render:({field:n})=>e.jsx(A,{value:n.value,onChange:n.onChange})}),e.jsx(l,{control:a.control,name:"isNewUserOnly",label:e.jsx(o,{id:"D12nyx"}),render:({field:n})=>e.jsx(A,{value:n.value,onChange:n.onChange})}),d&&y&&e.jsx(l,{control:a.control,name:"isGlobal",label:e.jsx(o,{id:"uX7KJi"}),description:e.jsx(o,{id:"46ZuMq"}),render:({field:n})=>e.jsx(A,{value:n.value,onChange:n.onChange})}),!d&&c?.isGlobal&&e.jsxs("div",{className:"space-y-1",children:[e.jsx("span",{className:"font-medium text-muted-foreground text-xs",children:"全局优惠券"}),e.jsx("div",{className:"text-sm",children:e.jsx("span",{className:"inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800",children:"是"})})]})]})}),e.jsxs(f,{column:"main",blockId:"basic-info",title:"基本信息",children:[e.jsxs(I,{children:[e.jsx(l,{control:a.control,name:"name",label:e.jsx(o,{id:"ZnEX+t"}),render:({field:n})=>e.jsx(z,{value:n.value??"",onChange:n.onChange,placeholder:"如：满100减20"})}),e.jsx("div",{})]}),e.jsx("div",{className:"mb-4 mt-4",children:e.jsx(l,{control:a.control,name:"description",label:e.jsx(o,{id:"9hSn8x"}),render:({field:n})=>e.jsx(J,{value:n.value??"",onChange:n.onChange})})})]}),e.jsx(f,{column:"main",blockId:"discount-rules",title:"优惠规则",children:e.jsxs(I,{children:[d?e.jsxs(e.Fragment,{children:[e.jsx(l,{control:a.control,name:"couponType",label:e.jsx(o,{id:"1KnXIl"}),render:({field:n})=>e.jsxs("select",{value:n.value??"fixed",onChange:n.onChange,className:"w-full rounded border px-2 py-1 text-sm",children:[e.jsx("option",{value:"fixed",children:"固定金额（元）"}),e.jsx("option",{value:"percentage",children:"百分比（%）"})]})}),e.jsx(l,{control:a.control,name:"discountValue",label:e.jsx(o,{id:"82TmEK"}),render:({field:n})=>e.jsx(C,{value:n.value??"",onChange:n.onChange,min:0})})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx("span",{className:"font-medium text-muted-foreground text-xs",children:"优惠类型"}),e.jsx("div",{className:"text-sm",children:c?.couponType==="fixed"?"固定金额":c?.couponType==="percentage"?"百分比":c?.couponType})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("span",{className:"font-medium text-muted-foreground text-xs",children:"优惠值"}),e.jsx("div",{className:"text-sm",children:c?.couponType==="percentage"?`${c?.discountValue}%`:`¥${c?.discountValue}`})]})]}),e.jsx(l,{control:a.control,name:"minSpend",label:e.jsx(o,{id:"8iHWXD"}),render:({field:n})=>e.jsx(C,{value:n.value??"",onChange:n.onChange,min:0})}),e.jsx(l,{control:a.control,name:"maxDiscount",label:e.jsx(o,{id:"xa82Ql"}),description:e.jsx(o,{id:"gWxkfL"}),render:({field:n})=>e.jsx(C,{value:n.value??"",onChange:n.onChange,min:0})})]})}),e.jsxs(f,{column:"main",blockId:"validity",title:"有效期与数量",children:[e.jsxs(I,{children:[e.jsx(l,{control:a.control,name:"startAt",label:e.jsx(o,{id:"jUCvOC"}),render:({field:n})=>e.jsx($,{value:n.value,onChange:x=>n.onChange(x)})}),e.jsx(l,{control:a.control,name:"endAt",label:e.jsx(o,{id:"5BDmOn"}),render:({field:n})=>e.jsx($,{value:n.value,onChange:x=>n.onChange(x)})}),e.jsx(l,{control:a.control,name:"totalQuantity",label:e.jsx(o,{id:"vwnKBq"}),render:({field:n})=>e.jsx(C,{value:n.value??"",onChange:n.onChange,min:1})}),e.jsx(l,{control:a.control,name:"limitPerUser",label:e.jsx(o,{id:"R1Ki+H"}),render:({field:n})=>e.jsx(C,{value:n.value??"",onChange:n.onChange,min:1})})]}),!d&&c?.claimedCount!=null&&e.jsxs("div",{className:"mt-4 text-sm text-muted-foreground",children:["已领取数量：",c.claimedCount," / ",c.totalQuantity]})]})]})]})}M({routes:[te,ae],pageBlocks:[Z]});
