import {DatabaseSync} from 'node:sqlite';
export class LocalD1 {
 constructor(schema,filename=':memory:'){this.sqlite=new DatabaseSync(filename);this.sqlite.exec('PRAGMA foreign_keys=ON');if(schema)this.sqlite.exec(schema)}
 prepare(sql){const db=this.sqlite;let values=[];return {bind(...args){values=args;return this},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){const r=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}}}
 async batch(statements){this.sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());this.sqlite.exec('COMMIT');return results}catch(error){this.sqlite.exec('ROLLBACK');throw error}}
 close(){this.sqlite.close()}
}
