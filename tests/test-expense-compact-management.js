const fs=require('fs'); const vm=require('vm');
const html=fs.readFileSync('work/expense.html','utf8');
for(const m of ['EXP_CAT_DEFS','expenseAutoCategory','quickExpenseCategory','openExpenseEdit','deleteExpenseRow','expenseTelegramText','EXP_TG_SUMMARY_MODE','exp-row-electric','exp-row-water','function doExpenseImport(files)']) if(!html.includes(m)) throw new Error('Missing '+m);
if(/function\s+importFiles\s*\(/.test(html)) throw new Error('Legacy importFiles returned');
const cnt=(html.match(/function\s+doExpenseImport\s*\(/g)||[]).length; if(cnt!==1) throw new Error('doExpenseImport declarations='+cnt);
const scripts=[]; const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi; let x; while((x=re.exec(html)))scripts.push(x[1]); scripts.forEach((src,i)=>new vm.Script(src,{filename:'expense-inline-'+i}));
console.log(JSON.stringify({ok:true,doExpenseImport:cnt,scripts:scripts.length}));
