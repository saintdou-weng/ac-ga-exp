const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const {JSDOM,VirtualConsole}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const root=path.resolve(process.env.GA_TEST_ROOT||path.resolve(__dirname,'..')),clone=x=>JSON.parse(JSON.stringify(x)),delay=ms=>new Promise(r=>setTimeout(r,ms));
function backend(){
 const files=new Map(),props=new Map(),poRows=[Array(17).fill('header')];
 const c={console,Date,JSON,Utilities:{formatDate:(d,t,f)=>{const iso=new Date(d).toISOString();return f==='yyyy-MM'?iso.slice(0,7):iso.slice(0,10)},getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest())},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType(){return this},getContent:()=>s})}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'backend/AC_GA_EXP.gs'),'utf8'),c);
 c.nowTimestamp=()=>new Date().toISOString();c.markMonthlyActivity=()=>{};c.activityPeriodsFromData=()=>[];
 c.getSheet=()=>({getDataRange:()=>({getValues:()=>clone(poRows)})});c.readKvObject_=()=>null;c.gaSmartLegacyExists_=()=>false;
 c.gaSmartFolder_=()=>({getFilesByName:n=>({hasNext:()=>files.has(n)})});
 c.gaSmartReadFile_=n=>files.has(n)?clone(files.get(n)):null;c.gaSmartWriteFile_=(n,d)=>{files.set(n,clone(d));return {}};
 function po(id,period,items,status='APPROVED'){const row=Array(17).fill('');row[0]=id;row[1]='PO-'+id;row[2]=+period.slice(0,4);row[3]=+period.slice(5)-1;row[4]=status;row[5]='QA';row[14]=JSON.stringify(items);poRows.push(row);return row;}
 function request(url,opt){const data=opt&&opt.body?JSON.parse(opt.body):null;return JSON.parse((data?c.doPost({postData:{contents:JSON.stringify(data)},parameter:{}}):c.doGet({parameter:Object.fromEntries(new URL(url).searchParams)})).getContent());}
 return {c,files,props,poRows,po,request};
}
async function page(name,server,stored={}){
 let online=false;const requests=[],errors=[],notices=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/getContext|navigation|scrollTo/.test(e.message))errors.push(e.message);});
 const html=fs.readFileSync(path.join(root,name),'utf8').replace(/<script[^>]*src="(shared\/[^"?]+)[^"]*"[^>]*><\/script>/g,(_,src)=>'<script>'+fs.readFileSync(path.join(root,src),'utf8')+'</script>');
 const dom=new JSDOM(html,{url:'https://qa.invalid/'+name,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.indexedDB=new IDBFactory();w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.Chart=class{destroy(){}update(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const [k,v]of Object.entries(stored))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 w.fetch=async(url,opt)=>{if(!online)throw Error('QA offline');requests.push({url,opt});const r=server.request(url,opt);return {ok:true,text:async()=>JSON.stringify(r)}};
 }});await delay(500);const w=dom.window;if(w.toast)w.toast=(s)=>notices.push(s);return {w,errors,notices,requests,online:v=>{online=v},close:()=>dom.window.close()};
}

module.exports={backend,page,delay,clone};
