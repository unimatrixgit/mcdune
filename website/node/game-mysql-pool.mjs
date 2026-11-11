/** Compatibility boundary for the fixed game read queries. SQL and identity values
 * remain separate; repeated PostgreSQL placeholders repeat their bound values.
 * Quest writes are restricted to three fixed, separately granted procedures. */
export function mysqlGameQuery(text,values=[]){
 const routine=/^SELECT (?:outcome|available,discovered,redeemed) FROM public\.(dune_quest_register|dune_quest_claim|dune_quest_status)\(/.exec(text);
 let sql=text,procedure=false;
 if(routine){sql='CALL '+routine[1]+text.slice(text.indexOf('('));procedure=true;}
 else if(!/^SELECT\s/i.test(text)||/[;]|--|\/\*/.test(text))throw Error('Unsupported game database operation');
 const parameters=[];
 sql=sql.replace(/\$(\d+)(?:::(?:uuid|bigint|text))?/g,(_,number)=>{
  const index=Number(number)-1;if(index<0||index>=values.length)throw Error('Missing game query value');
  parameters.push(values[index]);return '?';
 });
 sql=sql.replace(/\b([a-z_][a-z_0-9]*)::text\b/gi,'CAST($1 AS CHAR)')
  .replace(/\bAS "([a-zA-Z][a-zA-Z0-9]*)"/g,'AS `$1`');
 if(/::|\$\d/.test(sql))throw Error('Unsupported game query cast');
 return {sql,values:parameters,procedure};
}
export async function openGameMysqlPool(connectionString,dependencies={}){
 const mysql=dependencies.mysql||await import('mysql2/promise');
 const url=new URL(connectionString);if(url.protocol!=='mysql:')throw Error('MySQL game connection required');
 const pool=mysql.createPool({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),connectionLimit:3,connectTimeout:5000,charset:'utf8mb4',supportBigNumbers:true,bigNumberStrings:true,dateStrings:true,multipleStatements:false});
 return {dialect:'mysql',async query(input,parameters=[]){
  const query=mysqlGameQuery(typeof input==='string'?input:input.text,typeof input==='string'?parameters:input.values||[]);
  const [result]=await pool.query({sql:query.sql,values:query.values,timeout:5000});
  const rows=query.procedure?(Array.isArray(result[0])?result[0]:[]):result;
  return {rows:rows.map(row=>{
   const copy={...row};
   for(const key of ['inventory_updated_at','sold_at','created_at'])if(typeof copy[key]==='string'&&/^\d{4}-\d\d-\d\d /.test(copy[key]))copy[key]=copy[key].replace(' ','T')+'Z';
   if(query.procedure)for(const key of ['available','discovered','redeemed'])if(key in copy)copy[key]=!!copy[key];return copy;
  })};
 },on(event,callback){pool.on(event,callback);},async end(){await pool.end();}};
}
