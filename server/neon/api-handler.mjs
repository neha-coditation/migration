import {randomUUID} from 'node:crypto';

/**
 * Request handler for a trusted server/Neon Function.
 * authenticate(token) MUST validate the bearer token with an identity provider,
 * returning {subject} only for an authenticated user. No fallback identity.
 * Do not serve this handler without TLS and trusted authentication.
 */
export function createNeonApi({state, authenticate}) {
  if (!state || typeof state.createProject !== 'function' || typeof authenticate !== 'function') {
    throw new TypeError('State adapter and authentication verifier are required');
  }
  const json = (value, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
  const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  return async function handle(request) {
    try {
      const auth = request.headers.get('authorization') || '';
      const token = /^Bearer ([^\s]+)$/.exec(auth)?.[1];
      if (!token) return json({error:'Authentication required'},401);
      const identity = await authenticate(token);
      if (typeof identity?.subject !== 'string' || !identity.subject.trim()) return json({error:'Authentication required'},401);
      const ownerSubject = identity.subject;
      const url = new URL(request.url);
      const project = /^\/api\/neon\/projects\/([0-9a-f-]{36})$/.exec(url.pathname);
      const pages = /^\/api\/neon\/projects\/([0-9a-f-]{36})\/pages$/.exec(url.pathname);
      const parseBody = async () => {
        if (Number(request.headers.get('content-length') || 0) > 16384) throw new TypeError('Request too large');
        const body = await request.text();
        if (body.length > 16384) throw new TypeError('Request too large');
        return JSON.parse(body || '{}');
      };
      if (url.pathname === '/api/neon/projects' && request.method === 'POST') {
        const input = await parseBody();
        const source = new URL(input.sourceUrl);
        if (source.protocol !== 'https:' || source.username || source.password || !source.hostname) return json({error:'Invalid source URL'},400);
        const result = await state.createProject({id:randomUUID(),ownerSubject,sourceUrl:source.href,approvalMode:input.approvalMode || 'batch'});
        return json({project:result},201);
      }
      if (project && request.method === 'GET' && uuid(project[1])) {
        const result = await state.getProject({id:project[1],ownerSubject});
        return result ? json({project:result}) : json({error:'Not found'},404);
      }
      if (pages && uuid(pages[1])) {
        if (request.method === 'GET') return json({pages:await state.listPages({projectId:pages[1],ownerSubject})});
        if (request.method === 'POST') {
          const input = await parseBody();
          const parent = await state.getProject({id:pages[1],ownerSubject});
          if (!parent) return json({error:'Not found'},404);
          const source = new URL(input.sourceUrl,parent.source_url);
          const root = new URL(parent.source_url);
          if (!['http:','https:'].includes(source.protocol) || source.origin !== root.origin || source.username || source.password) return json({error:'Page must belong to project website'},400);
          const route = source.pathname + source.search;
          const result = await state.queuePage({id:randomUUID(),projectId:pages[1],ownerSubject,route,sourceUrl:source.href});
          return result ? json({page:result},201) : json({error:'Page already queued'},409);
        }
      }
      return json({error:'Not found'},404);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) return json({error:'Invalid request'},400);
      // Never leak SQL error detail or credentials in HTTP responses.
      return json({error:'Internal server error'},500);
    }
  };
}
