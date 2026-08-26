const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const mods=['expense','receiving','fuel','maintenance','damage','procurement'];
function must(cond,msg){if(!cond){console.error('FAIL:',msg);process.exitCode=1;}}
for(const m of mods){
  const f=path.join(root,m+'.html'),s=fs.readFileSync(f,'utf8');
  must(s.includes('shared/ga-auto-sync.js'),'missing ga-auto-sync include: '+m);
  must(s.includes("GAAutoSync.install({key:'"+m+"'") || s.includes("GAAutoSync.install({key:\""+m+"\""),'missing install: '+m);
  let n=0;for(const x of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){if(!x[1].trim())continue;n++;try{new vm.Script(x[1],{filename:m+'#'+n})}catch(e){must(false,'syntax '+m+': '+e.message)}}
}
const auto=fs.readFileSync(path.join(root,'shared/ga-auto-sync.js'),'utf8');
must(/PFX='gaexp:auto2:'/.test(auto),'pending state must persist in localStorage');
must(/visibilitychange/.test(auto)&&/pageshow/.test(auto)&&/addEventListener\('online'/.test(auto),'resume/network retry hooks missing');
must(/await s\.opts\.pull/.test(auto)&&/await s\.opts\.push/.test(auto),'controller must pull before push');
must(/Math\.min\(d,60\)/.test(auto),'important actions must start <=60ms');
const fuel=fs.readFileSync(path.join(root,'fuel.html'),'utf8');
must(/DB=fuelMergeRecords\(DB,d\.data\)/.test(fuel),'fuel download must merge, not replace');
const dmg=fs.readFileSync(path.join(root,'damage.html'),'utf8');
must(/DB=damageMerge\(DB,rr\)/.test(dmg),'damage download must merge, not replace');
const proc=fs.readFileSync(path.join(root,'procurement.html'),'utf8');
must(/local-first/.test(proc)&&/procMergeState/.test(proc),'procurement must be local-first and merge-aware');
must(/saveState\('submit-review'\)/.test(proc)&&/saveState\('review'\)/.test(proc)&&/saveState\('approval'\)/.test(proc),'procurement workflow must trigger fast sync reasons');
if(process.exitCode)process.exit(process.exitCode);console.log('PASS auto-sync consistency: '+mods.join(', '));
