import dns from 'node:dns/promises';
import net from 'node:net';
export function privateAddress(address) {
  let ip=address.toLowerCase().split('%')[0];
  if(ip.startsWith('::ffff:')) { const tail=ip.slice(7); if(tail.includes('.'))return privateAddress(tail); const m=tail.match(/^([a-f\d]{1,4}):([a-f\d]{1,4})$/); if(m)return privateAddress([parseInt(m[1],16)>>8,parseInt(m[1],16)&255,parseInt(m[2],16)>>8,parseInt(m[2],16)&255].join('.')); }
  if(net.isIPv6(ip))return ip==='::'||ip==='::1'||/^(fc|fd|fe[89ab]|ff)/.test(ip)||ip.startsWith('2001:db8:');
  if(!net.isIPv4(ip))return true;
  const [a,b]=ip.split('.').map(Number);
  return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0;
}
export function canonical(input) { const u=new URL(input);u.hash='';if(u.pathname!=='/')u.pathname=u.pathname.replace(/\/$/,'');return u.href; }
export function routePath(input) { const u=new URL(input);return u.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/'; }
export function createUrlPolicy({allowLocal=false,lookup=dns.lookup}={}) {
  return async input=>{
    const u=new URL(input);
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
    const hostname=u.hostname.replace(/^\[|\]$/g,'');
    const addresses=net.isIP(hostname)?[{address:hostname}]:await lookup(hostname,{all:true});
    if(!addresses.length)throw new Error('The hostname could not be resolved.');
    if(addresses.some(a=>privateAddress(a.address)) && !(allowLocal && addresses.every(a=>a.address==='127.0.0.1'||a.address==='::1')))throw new Error('Private, local and reserved network destinations are not supported.');
    return u;
  };
}
export function crawlable(input,origin) {try{const u=new URL(input);return u.origin===origin&&!u.search&&!/\.(?:pdf|zip|png|jpe?g|gif|avif|webp|svg|mp4|webm|woff2?|css|js|json|xml)$/i.test(u.pathname);}catch{return false;}}
