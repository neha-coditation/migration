import {load} from 'cheerio';
import {publicFetch} from './http-capture.mjs';
export async function recoverCollections(html,url,{policy,signal,maxPaginationPages=8}={}){
 const $=load(html),lists=$('[fs-cmsload-element="list"]'),results=[],additionalHTML=[];
 for(let index=0;index<lists.length;index++){
  const list=lists.eq(index);let cards=list.children('.w-dyn-item');if(!cards.length)continue;
  const countVisible=cards.filter((_,e)=>!$(e).is('[hidden]')&&!/display\s*:\s*none/.test($(e).attr('style')||'')).length;
  const size=countVisible||cards.length,items=cards.map((_,e)=>$.html(e)).get();const seen=new Set(items);const wrapper=list.closest('.w-dyn-list');const next=wrapper.find('.w-pagination-next').first();let nextURL=next.attr('href'),pagesFetched=0;const visited=new Set();let complete=!nextURL||nextURL==='#';
  while(nextURL&&nextURL!=='#'&&pagesFetched<maxPaginationPages){
   const pageURL=new URL(nextURL,url);if(pageURL.origin!==new URL(url).origin||visited.has(pageURL.href))break;visited.add(pageURL.href);
   try{const response=await publicFetch(pageURL.href,{policy,signal,limit:8*1024*1024});const text=response.buffer.toString();const other=load(text);const otherList=other('[fs-cmsload-element="list"]').eq(index);if(!otherList.length)break;
    additionalHTML.push({url:response.url,html:text});otherList.children('.w-dyn-item').each((_,e)=>{const item=other.html(e);if(!seen.has(item)){seen.add(item);items.push(item);}});pagesFetched++;nextURL=otherList.closest('.w-dyn-list').find('.w-pagination-next').attr('href');complete=!nextURL||nextURL==='#';
   }catch{complete=false;break;}
  }
  list.empty();for(const item of items)list.append(item);list.attr('data-migration-list',String(index)).attr('data-migration-page-size',String(size));
  if(next.length)next.attr('data-migration-more',String(index)).attr('href','#').attr('role','button');
  else $('[fs-cmsload-element="load-more"]').eq(index).attr('data-migration-more',String(index));
  results.push({index,records:items.length,initialPageSize:size,paginationPagesFetched:pagesFetched,publicPaginationExhausted:complete});
 }
 if(results.length){
  $('script[src]').each((_,e)=>{if(/finsweet.*(?:cmsload|cmsfilter)|@finsweet\/attributes-(?:cmsload|cmsfilter)/i.test($(e).attr('src')))$(e).remove();});
  $('[fs-cmsfilter-element="filters"] .w-tabs').each((_,e)=>$(e).removeClass('w-tabs').addClass('migration-filter-tabs'));
  $('head').append('<script src="/migration-collections.js" defer></script>');
 }
 return {html:$.html(),lists:results,additionalHTML};
}
