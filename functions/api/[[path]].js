export async function onRequest(context) {
 return Response.json({error:'The migration API is not yet connected to this Cloudflare Pages deployment. Run migrations in the local Studio until a protected cloud backend is configured.',code:'BACKEND_NOT_CONNECTED',ready:false},{status:503,headers:{'Cache-Control':'no-store'}});
}
