export async function readModerationResponse(response,{upload=false}={}){
 const fallback=response.status===413&&upload?'The upload was rejected as too large. Choose a file up to 5 MB.':response.status>=500?'The moderation service is temporarily unavailable. Please retry; your form has been kept.':'The server returned an unexpected response. Please retry; your form has been kept.';
 try{const value=JSON.parse(await response.text());if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}
 catch{throw Error(fallback);}
}
export function unbanReasonError(value){return typeof value!=='string'||value.trim().length<5||value.length>500||/[\x00-\x1f\x7f]/.test(value)?'Enter a single-line reason of 5–500 characters.':'';}
export function evidenceDraftErrors({title,notes,sourceUrl,file}){
 const errors={};const controls=/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
 if(typeof title!=='string'||title.trim().length<3||title.length>120||controls.test(title))errors.title='Enter an evidence title of 3–120 characters.';
 if(typeof notes!=='string'||notes.length>10000||controls.test(notes))errors.notes='Use up to 10,000 characters of notes without control characters.';
 if(typeof sourceUrl!=='string'||sourceUrl.length>2000)errors.source='Use an HTTPS source link of up to 2,000 characters.';
 else if(sourceUrl.trim()){try{const url=new URL(sourceUrl.trim());if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{errors.source='Use an HTTPS source link without a username or password.';}}
 if(file&&(!Number.isSafeInteger(file.size)||file.size<1||file.size>5*1024*1024))errors.file='Choose a non-empty attachment up to 5 MB.';
 if(!errors.notes&&typeof notes==='string'&&!notes.trim()&&typeof sourceUrl==='string'&&!sourceUrl.trim()&&!file)errors.notes='Add notes, a source link or an attachment.';
 return errors;
}
