import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {prepareFidelity,controlContract,compareFidelity} from '../server/fidelity.mjs';
test('Coditation blog repair removes rejected controls while preserving card content and layout',()=>{
 const doc={url:'https://www.coditation.com/resources/blogs',html:'<html><head></head><body><div class="insight-cat-wp"><input type="search" placeholder="Search blogs"><button>Topic</button></div><a>Search all published blog posts</a><div class="blogs_main_block"><article>Original article</article></div></body></html>'};
 prepareFidelity(doc);const $=load(doc.html);assert.equal($('.insight-cat-wp,input,button').length,0);assert.equal($('.blogs_main_block article').text(),'Original article');assert.equal($('a').length,0);assert.equal(doc.fidelity.profile,'coditation');
});
test('Other sites retain their legitimate search and topic controls',()=>{
 const html='<html><head></head><body><input type="search" placeholder="Search blogs"><button>Topic</button><div class="insight-cat-wp">Keep</div></body></html>';const doc={url:'https://example.com/resources/blogs',html};prepareFidelity(doc);assert.deepEqual(controlContract(doc.html),controlContract(html));assert.ok(doc.html.includes('Keep'));assert.equal(doc.fidelity.repairs.length,0);
});
test('Source-driven QA rejects missing motion, sticky pinning, added UI and clipped testimonial peeks',()=>{
 const source={controls:['button::next'],motion:{present:true,changed:true,scrollChanged:true,canvasChanged:true},sticky:[{pinned:true}],slider:{visibleCards:3,left:-50,right:1490,activeCentered:true}};
 const broken={controls:['button::next','input:search:search blogs'],motion:{present:true,changed:false,scrollChanged:false,canvasChanged:false},sticky:[{pinned:false}],slider:{visibleCards:1,left:100,right:1340,activeCentered:true}};
 assert.equal(compareFidelity(source,broken).filter(c=>c.status==='fail').length,6);assert.ok(compareFidelity(source,source).every(c=>['pass','not-applicable'].includes(c.status)));
});
test('Still or unavailable motion baseline is never reported as a verified animation',()=>{
 const source={controls:[],motion:{present:true,changed:false,scrollChanged:false,canvasChanged:false},sticky:[],slider:null};assert.equal(compareFidelity(source,source).find(c=>c.name==='Animation activity').status,'not-tested');assert.equal(compareFidelity(null,source)[0].status,'not-tested');
});
test('Known particle repair preserves source script dependencies and isolates scene startup',()=>{
 const doc={url:'https://www.coditation.com/',html:'<html><head><script src="three.js" defer></script></head><body><script>const sceneUpdates=[];function createParticleBG(){}</script></body></html>'};prepareFidelity(doc);assert.ok(doc.html.includes('src="three.js" defer'));assert.ok(doc.html.includes('prefers-reduced-motion'));assert.ok(doc.html.includes('try'));assert.ok(doc.fidelity.repairs.some(x=>x.includes('particle')));
});
test('Renamed Webflow chunks resolve locally through the generated runtime guard',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),vm=await import('node:vm');const {generateAstro}=await import('../server/transform.mjs');const root=await fs.mkdtemp(path.join(os.tmpdir(),'fidelity-chunk-'));try{const disk=path.join(root,'source.js');await fs.writeFile(disk,'/* chunk */');const name='webflow.achunk.80677ea19e4284e5.js';const resources=new Map([['https://cdn.example.com/js/'+name,{file:'renamed.js',disk,type:'application/javascript'}]]);const project=await generateAstro(root,[{url:'https://example.com/',html:'<html><head></head><body></body></html>'}],resources);const guard=await fs.readFile(path.join(project,'public/migration-guard.js'),'utf8');class E{setAttribute(){}}class X{open(){}}const sandbox={window:{fetch:value=>value},URL,location:{href:'http://127.0.0.1:1234/',origin:'http://127.0.0.1:1234',pathname:'/'},XMLHttpRequest:X,Element:E,document:{addEventListener(){}}};for(const key of ['HTMLScriptElement','HTMLImageElement','HTMLLinkElement','HTMLIFrameElement','HTMLSourceElement','HTMLMediaElement'])sandbox[key]=class extends E{};vm.runInNewContext(guard,sandbox);assert.equal(sandbox.window.fetch('http://127.0.0.1:1234/migrated/'+name),'/migrated/renamed.js');assert.equal(sandbox.window.fetch('https://unknown.example.com/other.js'),'https://unknown.example.com/other.js');}finally{await fs.rm(root,{recursive:true,force:true});}
});
