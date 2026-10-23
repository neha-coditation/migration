// Only proxy the existing Neon API with the caller's bearer token.
// Never use a shared service secret or allow arbitrary proxy targets.
const ORIGIN='https://br-quiet-hat-b5fslf7n-migrationapi.compute.c-7.us-east-2.aws.neon.tech';
export async function onRequest({request}) {
 const url=new URL(request.url);
 if(!/^\/api\/neon\/(projects(?:\/[0-9a-f-]+(?:\/pages)?)?)$/i.test(url.pathname))
  return Response.json({error:'Unknown API route'},{status:404});
 if(!['GET','POST'].includes(request.method))
  return Response.json({error:'Method not allowed'},{status:405});
 const authorization=request.headers.get('authorization');
 if(!/^Bearer [^\s]+$/.test(authorization||''))
  return Response.json({error:'Authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const headers=new Headers({Authorization:authorization,Accept:'application/json'});
 if(request.method==='POST')headers.set('content-type','application/json');
 let response;
 try{response=await fetch(ORIGIN+url.pathname,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual'});}
 catch{return Response.json({error:'Migration backend unavailable'},{status:502,headers:{'Cache-Control':'no-store'}});}
 const contentType=response.headers.get('content-type')||'';
 if(!contentType.includes('application/json'))return Response.json({error:'Migration backend returned an invalid response'},{status:502,headers:{'Cache-Control':'no-store'}});
 return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
