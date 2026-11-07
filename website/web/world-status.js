const panel=document.querySelector('.world-status');
if(panel){
 const list=panel.querySelector('.world-status-list'),note=panel.querySelector('.world-status-note');
 async function update(){
  try{
   const response=await fetch('/api/worlds',{cache:'no-store',signal:AbortSignal.timeout(7000)});if(!response.ok)throw Error();
   const data=await response.json();list.replaceChildren();
   for(const server of data.servers){const row=document.createElement('li'),name=document.createElement('span'),state=document.createElement('span');name.textContent=server.name;state.className='world-state '+server.state;state.textContent=server.state==='online'?'✓ Online':server.state==='offline'?'○ Offline':'— Unknown';if(server.state==='offline'&&!server.configured)state.title='Not deployed yet';row.append(name,state);list.append(row);}
   note.textContent=data.available?'Live check · '+new Date(data.checkedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' · updates every 30s':'Status check unavailable · retrying';
  }catch{for(const state of list.querySelectorAll('.world-state')){state.className='world-state unknown';state.textContent='— Unknown';}note.textContent='Status check unavailable · retrying';}
 }
 update();setInterval(()=>{if(!document.hidden)update();},30000);
}
