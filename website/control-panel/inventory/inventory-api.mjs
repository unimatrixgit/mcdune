import {exchangeSaleOgm} from './structured-communication.mjs';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});

/** Mount inside cp.dunerealms.com's existing server. Callbacks are server-owned, never client input. */
export function createInventoryHandler({authenticate,verifiedMinecraftUuid,pool,logger=console}) {
  if(typeof authenticate!=='function'||typeof verifiedMinecraftUuid!=='function'||!pool?.query)
    throw new TypeError('Authenticated account, verified game-link resolver and PostgreSQL pool are required.');
  return async request=>{
    const url=new URL(request.url);
    if(url.pathname!=='/api/inventory')return null;
    if(request.method!=='GET')return reply({message:'Method not allowed.'},405);
    if(url.search)return reply({message:'This endpoint only accepts the signed-in account.'},400);
    try {
      const account=await authenticate(request);
      if(!account?.id)return reply({message:'Sign in to view your inventory.'},401);
      // Resolve the verified link using this account ID. Never trust a submitted UUID or profile name.
      const uuid=await verifiedMinecraftUuid(account.id);
      if(!uuid)return reply({status:'unlinked',message:'Link your Minecraft account to view your inventory.'});
      if(!uuidPattern.test(uuid))return reply({message:'The verified game link is invalid.'},503);
      const result=await pool.query({
        text:'SELECT inventory_view,inventory_updated_at,session_open FROM dune_players WHERE uuid=$1',
        values:[uuid],query_timeout:5000
      });
      const row=result.rows[0];
      if(!row?.inventory_view)return reply({status:'empty',message:'No saved inventory yet. Join a planetary server, then wait for a save.'});
      const snapshot=typeof row.inventory_view==='string'?JSON.parse(row.inventory_view):row.inventory_view;
      if(snapshot?.version!==1)return reply({message:'This inventory snapshot version is unavailable.'},503);
      return reply({status:'ready',snapshot,updatedAt:row.inventory_updated_at,sessionOpen:!!row.session_open});
    } catch(error) {
      // No SQL, addresses, credentials or player UUIDs in client errors.
      logger.error?.('Account inventory unavailable.');
      return reply({status:'unavailable',message:'Inventory is temporarily unavailable. Please try again later.'},503);
    }
  };
}

export function createSalesHistoryHandler({authenticate,verifiedMinecraftUuid,pool,logger=console}) {
  return async request=>{
    const url=new URL(request.url);
    if(url.pathname!=='/api/exchange/sales-history')return null;
    if(request.method!=='GET')return reply({message:'Method not allowed.'},405);
    const keys=[...url.searchParams.keys()],before=url.searchParams.get('before');
    if(keys.some(key=>key!=='before')||keys.length>1||(before!==null&&!/^[1-9][0-9]{0,18}$/.test(before))||(before!==null&&BigInt(before)>9223372036854775807n))return reply({message:'Invalid sales history cursor.'},400);
    try {
      const account=await authenticate(request);
      if(!account?.id)return reply({message:'Sign in to view your sales.'},401);
      const uuid=await verifiedMinecraftUuid(account.id);
      if(!uuid)return reply({status:'unlinked',sales:[],nextCursor:null});
      if(!uuidPattern.test(uuid))return reply({message:'The verified game link is invalid.'},503);
      const result=await pool.query({text:'SELECT id::text,listing_id::text,material,display_name,quantity,unit_price::text,total_price::text,origin,buyer_name,sold_at FROM dune_exchange_sales WHERE seller=$1 AND ($2::bigint IS NULL OR id<$2::bigint) ORDER BY id DESC LIMIT 21',values:[uuid,before],query_timeout:5000});
      const sales=result.rows.slice(0,20).map(row=>({...row,structuredCommunication:exchangeSaleOgm(row.id)}));
      return reply({status:'ready',sales,nextCursor:result.rows.length>20?sales.at(-1).id:null});
    } catch {
      logger.error?.('Account sales history unavailable.');
      return reply({status:'unavailable',message:'Sales history is temporarily unavailable.'},503);
    }
  };
}
