import{bk as l,j as s,fE as m,aY as c,aZ as u,a_ as x,T as d,a$ as p,fF as g,b0 as j,br as h,bm as f}from"./index-DY5P-GzJ.js";const C=h(`
    query TaxCategories($options: TaxCategoryListOptions) {
        taxCategories(options: $options) {
            items {
                id
                name
                isDefault
            }
        }
    }
`);function y({value:t,onChange:i}){const{data:a,isLoading:r,isPending:n,status:S}=l({queryKey:["taxCategories"],staleTime:3e5,queryFn:()=>f.query(C,{options:{take:100}})});return r||n?s.jsx(m,{className:"h-10 w-full"}):s.jsxs(c,{items:a?Object.fromEntries(a.taxCategories.items.map(e=>[e.id,e.name])):{},value:t??"",onValueChange:e=>e&&i(e),children:[s.jsx(u,{children:s.jsx(x,{placeholder:s.jsx(d,{id:"LWiFS0"}),children:e=>a?.taxCategories.items.find(o=>o.id===e)?.name})}),s.jsx(p,{children:a&&s.jsx(g,{children:a?.taxCategories.items.map(e=>s.jsx(j,{value:e.id,children:e.name},e.id))})})]})}export{y as T};
