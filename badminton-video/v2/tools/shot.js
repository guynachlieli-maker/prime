const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..','..');const M={'.js':'text/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':M[path.extname(p)]||'application/octet-stream'});r.end(d)})}).listen(8500,async()=>{
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const pg=await b.newPage({viewport:{width:parseInt(process.argv[3]||1500),height:parseInt(process.argv[4]||560)}});
pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('console',m=>{const x=m.text();if(!/GPU stall|GL Driver/.test(x))console.log('c:',x)});
await pg.goto('http://localhost:8500/'+process.argv[2]);await pg.waitForFunction('window.ready===true',null,{timeout:90000});
await pg.screenshot({path:process.argv[5]||'/tmp/shot.png'});await b.close();srv.close()});
