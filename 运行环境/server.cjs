const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../网页'),port=Number(process.env.BJD_PORT||4312),prefix='/bjd-decal-studio/';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname==='/'){res.writeHead(302,{Location:prefix+'index.html'}).end();return;}
 if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 const file=path.resolve(root,pathname.slice(prefix.length)||'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'端口已被占用。若工作台已启动，请使用原窗口；否则关闭占用端口的程序后重试。':err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const url=`http://127.0.0.1:${server.address().port}${prefix}index.html`;console.log('工作台已启动：'+url+'\n关闭此窗口即可停止服务。');if(!process.env.BJD_NO_OPEN)cp.spawn('explorer.exe',[url],{stdio:'ignore'}).on('error',()=>console.log('请手动在浏览器打开上述地址。'));});
