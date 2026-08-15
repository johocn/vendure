import{az as l,j as s,eh as c,F as m,G as u,H as x,Q as d,I as p,ei as g,J as h,L as j,aA as C}from"./index-CfivDxyc.js";const S=j(`
    query TaxCategories($options: TaxCategoryListOptions) {
        taxCategories(options: $options) {
            items {
                id
                name
                isDefault
            }
        }
    }
`);function y({value:t,onChange:i}){const{data:a,isLoading:n,isPending:r,status:f}=l({queryKey:["taxCategories"],staleTime:3e5,queryFn:()=>C.query(S,{options:{take:100}})});return n||r?s.jsx(c,{className:"h-10 w-full"}):s.jsxs(m,{items:a?Object.fromEntries(a.taxCategories.items.map(e=>[e.id,e.name])):{},value:t??"",onValueChange:e=>e&&i(e),children:[s.jsx(u,{children:s.jsx(x,{placeholder:s.jsx(d,{id:"LWiFS0"}),children:e=>a?.taxCategories.items.find(o=>o.id===e)?.name})}),s.jsx(p,{children:a&&s.jsx(g,{children:a?.taxCategories.items.map(e=>s.jsx(h,{value:e.id,children:e.name},e.id))})})]})}export{y as T};
