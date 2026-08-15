import{b7 as i,j as l,eg as n,Q as o,L as a}from"./index-CfivDxyc.js";const r=a(`
    query SellerList($options: SellerListOptions) {
        sellers(options: $options) {
            items {
                id
                name
            }
            totalItems
        }
    }
`);function c(e){const{_:s}=i();return l.jsx(n,{config:{listQuery:r,idKey:"id",labelKey:"name",placeholder:s({id:"ZPVB4K"})},selectorLabel:e.label??l.jsx(o,{id:"mj8NP+"}),value:e.value??void 0,onChange:t=>{typeof t=="string"&&e.onChange(t)},disabled:e.readOnly})}export{c as S};
