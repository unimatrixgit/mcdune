export const priorityOrder=['BUGFIX','P0','P1','P2','P3','PARKEREN'];
const fail=message=>{throw Error(message)};
export function releaseFile(version){if(typeof version!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9._-]{0,48}$/).test(version))fail('Invalid version');return 'patch-note-'+version.toLowerCase().replace(/[._]/g,'-')+'.html'}
export function validatePatchnotes(register,pending,releases){
 if(register.format!==1||!Array.isArray(register.tasks)||!Array.isArray(releases)||!Array.isArray(pending.completed))fail('Invalid register structure');
 if(pending.minimumTasks!==5||pending.maximumTasks!==10)fail('Normal bundles must contain 5–10 product tasks');
 const tasks=new Map();for(const t of register.tasks){if(!/^DUNE-\d{3,}$/.test(t.id)||tasks.has(t.id))fail('Duplicate or invalid task ID');if(!priorityOrder.includes(t.priority)||!['product','workflow'].includes(t.kind))fail('Invalid task metadata');tasks.set(t.id,t)}
 const completed=new Map(),claimed=new Set(),files=new Set(),items=new Set();
 function validateItem(item,kind){if(!item.id||items.has(item.id))fail('A product task occurs more than once');items.add(item.id);if(!item.title||!Array.isArray(item.promptIds)||!item.promptIds.length||!Array.isArray(item.changes)||!item.changes.length)fail('Invalid product record');for(const id of item.promptIds){const task=tasks.get(id);if(!task||task.kind!=='product'||task.status!=='done')fail('Only completed product tasks can enter patchnotes');if(claimed.has(id))fail('A prompt ID occurs more than once');claimed.add(id);if(kind==='bugfix'&&task.priority!=='BUGFIX')fail('Urgent bugfix entries require BUGFIX tasks');if(kind==='normal'&&task.priority==='BUGFIX')fail('BUGFIX must be published separately') }if(kind==='normal'&&item.priority==='BUGFIX')fail('BUGFIX must be separate')}
 for(const r of releases){const file=releaseFile(r.version);if(files.has(file))fail('Duplicate or colliding release version');files.add(file);if(!r.title||!r.synopsis||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['normal','bugfix'].includes(r.kind)||!Array.isArray(r.tasks))fail('Invalid release metadata');if(r.kind==='normal'&&(r.tasks.length<5||r.tasks.length>10))fail('Normal release requires 5–10 product tasks');if(r.kind==='bugfix'&&(!r.tasks.length||!r.problem||!r.fix||!Array.isArray(r.checks)||!r.checks.length))fail('Bugfix needs problem, fix and checks');for(const item of r.tasks)validateItem(item,r.kind)}
 for(const item of pending.completed){validateItem(item,item.priority==='BUGFIX'?'bugfix':'normal');if(item.priority==='BUGFIX')fail('BUGFIX cannot wait in the normal queue');completed.set(item.id,item)}
 return {completed,tasks,files};
}
export function makeRelease(register,pending,releases,input){
 const checked=validatePatchnotes(register,pending,releases);const file=releaseFile(input.version);if(checked.files.has(file))fail('Release version already exists');
 const ids=input.taskIds;if(!Array.isArray(ids)||new Set(ids).size!==ids.length||!ids.length)fail('Select unique product task IDs');
 const selected=ids.map(id=>checked.completed.get(id)||fail('Task is not in the completed pending queue'));
 if(selected.length<5||selected.length>10)fail('Select 5–10 completed product tasks for a normal release');
 const release={version:input.version,date:input.date,title:input.title,synopsis:input.synopsis,kind:'normal',tasks:selected};
 const nextPending={...pending,completed:pending.completed.filter(x=>!ids.includes(x.id))},nextRegister={...register,tasks:register.tasks.map(t=>selected.some(x=>x.promptIds.includes(t.id))?{...t,release:input.version}:t)},nextReleases=[release,...releases];validatePatchnotes(nextRegister,nextPending,nextReleases);return {register:nextRegister,pending:nextPending,releases:nextReleases,release};
}
export function makeBugfix(register,pending,releases,input){
 const checked=validatePatchnotes(register,pending,releases);if(checked.files.has(releaseFile(input.version)))fail('Release version already exists');
 const release={version:input.version,date:input.date,title:input.title,synopsis:input.synopsis,kind:'bugfix',problem:input.problem,fix:input.fix,checks:input.checks,tasks:input.tasks};
 const nextRegister={...register,tasks:register.tasks.map(t=>input.tasks?.some(x=>x.promptIds?.includes(t.id))?{...t,release:input.version}:t)},nextReleases=[release,...releases];validatePatchnotes(nextRegister,pending,nextReleases);return {register:nextRegister,pending,releases:nextReleases,release};
}
