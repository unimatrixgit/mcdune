const workspace=document.getElementById('clan-workspace');
window.addEventListener('message',event=>{if(event.origin!=='https://cp.dunerealms.com'||event.source!==workspace?.contentWindow||event.data?.type!=='dunerealms-clan-height')return;const height=Number(event.data.height);if(Number.isFinite(height)&&height>=300&&height<=30000)workspace.height=String(Math.ceil(height)+4);});
