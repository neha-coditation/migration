export async function onRequest(context) {
 const endpoint = new URL(context.request.url).pathname;
 if (!['/api/browser/status','/api/browser/recheck','/api/browser/setup'].includes(endpoint)) return Response.json({error:'Unknown browser endpoint'}, {status:404,headers:{'Cache-Control':'no-store'}});
 const result = {status:'unavailable',ready:false,message:'Cloud browser migration worker is not connected to this Cloudflare Pages deployment.',action:'A protected migration backend and browser worker must be deployed before browser QA can run. Local Studio remains available.',checkedAt:new Date().toISOString()};
 return Response.json(result,{status:endpoint.endsWith('/setup')?503:200,headers:{'Cache-Control':'no-store'}});
}
