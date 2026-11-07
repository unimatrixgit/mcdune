import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
export function mysqlSql(sql) {
  return sql.replace(/ON CONFLICT\(user_id\) DO UPDATE SET /gi,'ON DUPLICATE KEY UPDATE ')
    .replace(/excluded\.([a-z_]+)/gi,'VALUES($1)');
}
export async function openDatabase(env) {
  const pool=mysql.createPool({host:env.DB_HOST||'127.0.0.1',port:Number(env.DB_PORT||3306),user:env.DB_USER,
    password:env.DB_PASSWORD,database:env.DB_NAME,connectionLimit:5,charset:'utf8mb4',supportBigNumbers:true,
    connectTimeout:10000,multipleStatements:false});
  async function connection() {
    const c=await pool.getConnection();
    try {await c.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,NO_BACKSLASH_ESCAPES'");return c;}
    catch(error){c.release();throw error;}
  }
  const db={
    async query(sql,values=[]) {const c=await connection();try{return (await c.execute(mysqlSql(sql),values))[0];}finally{c.release();}},
    prepare(sql) {
      let values=[];
      const statement={bind(...args){values=args;return statement;},
        async first(){return (await db.query(sql,values))[0]||null;},
        async all(){return {results:await db.query(sql,values)};},
        async run(c){const result=c?(await c.execute(mysqlSql(sql),values))[0]:await db.query(sql,values);return {success:true,meta:{changes:result.affectedRows}};}};
      return statement;
    },
    async batch(statements){const c=await connection();try{await c.beginTransaction();const results=[];for(const s of statements)results.push(await s.run(c));await c.commit();return results;}catch(e){await c.rollback();throw e;}finally{c.release();}},
    async close(){await pool.end();}
  };
  const schema=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) await db.query(statement);
  return db;
}
