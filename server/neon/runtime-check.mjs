// Deployment preflight only. No migration APIs, project data or credentials are exposed.
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
export default {
 async fetch(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/') return new Response('Not found', {status:404});
  const result = spawnSync('/sbin/ldconfig', ['-p'], {encoding:'utf8', timeout:3000});
  const libraryNames = ['libnss3.so','libnspr4.so','libatk-1.0.so','libatk-bridge-2.0.so','libX11.so','libxcb.so','libxkbcommon.so','libgbm.so','libasound.so'];
  const libraries = result.status === 0 ? Object.fromEntries(libraryNames.map(name=>[name,result.stdout.includes(name)])) : null;
  let chromiumInstalled = false;
  for (const file of ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome']) {
   try {await access(file);chromiumInstalled=true;} catch {}
  }
  return Response.json({service:'Migration Studio deployment preflight',appDeployed:false,platform:process.platform,architecture:process.arch,node:process.versions.node,chromiumInstalled,libraries,browserQAVerified:false,nextStep:'Deploy the authenticated app, durable job and asset storage, and verify a Chromium worker before enabling migrations.'}, {headers:{'Cache-Control':'no-store'}});
 }
};
