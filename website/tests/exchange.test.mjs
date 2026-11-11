import test from 'node:test';
import assert from 'node:assert/strict';
import {demoListings,validListings,filterListings,listingInstruction,categories,planets} from '../web/exchange-data.js';
import {handleExchange} from '../worker/exchange-api.mjs';
test('Demo market covers every category and planet, with enough listings for pagination',()=>{
  assert.ok(demoListings.length>24);
  assert.equal(validListings(demoListings).length,demoListings.length);
  for(const category of Object.keys(categories)) assert.ok(filterListings(demoListings,{category}).length,category);
  for(const planet of Object.keys(planets)) assert.ok(filterListings(demoListings,{planet}).length,planet);
  for(const row of demoListings){assert.match(row.seller,/demo/);assert.doesNotMatch(listingInstruction(row,true),/exchange buy/);}
});
test('Search includes material names, categories, planets and sellers without mutating source',()=>{
  const original=demoListings.map(x=>x.id);
  assert.ok(filterListings(demoListings,{search:'iron ingot'}).length);
  assert.equal(filterListings(demoListings,{search:'Vrijduin reclaimer suit'}).length,1);
  assert.equal(filterListings(demoListings,{search:'pelareth'}).length,filterListings(demoListings,{planet:'caladan'}).length);
  assert.equal(filterListings(demoListings,{search:'kaladam'}).length,filterListings(demoListings,{planet:'caladan'}).length);
  assert.ok(filterListings(demoListings,{search:'ores & minerals'}).length);
  const sorted=filterListings(demoListings,{sort:'price'});
  assert.ok(sorted.every((x,i)=>i===0||x.price>=sorted[i-1].price));
  assert.deepEqual(demoListings.map(x=>x.id),original);
  assert.equal(filterListings(demoListings,{category:'equipment',planet:'arrakis'}).length,2);
});
test('Live validation rejects invalid data and duplicate IDs; empty live market stays empty',()=>{
  const good=demoListings[0];
  assert.deepEqual(validListings([]),[]);
  assert.throws(()=>validListings(null));
  assert.equal(validListings([good,good,null,{...good,id:2,quantity:0},{...good,id:3,origin:'unknown'}]).length,1);
  assert.match(listingInstruction(good,false),/exchange buy 1$/);
});
test('Unconnected API stays unavailable, never fabricates live listings or allows trading',async()=>{
  const offline=await handleExchange(new Request('https://example.test/api/exchange/listings'),{});
  assert.equal(offline.status,503);assert.equal((await offline.json()).error,'market_not_configured');
  const write=await handleExchange(new Request('https://example.test/api/exchange/listings',{method:'POST'}),{});
  assert.equal(write.status,405);
});
test('Connected gateway sends the token only upstream and exposes sanitized read-only offers',async()=>{
  const original=globalThis.fetch;let received;
  globalThis.fetch=async(url,options)=>{received={url:String(url),options};return Response.json({listings:[{...demoListings[0],seller:'Trader',secret:'never expose'}]});};
  try {
    const response=await handleExchange(new Request('https://example.test/api/exchange/listings'),{EXCHANGE_LISTINGS_URL:'https://game.test/listings',EXCHANGE_READ_TOKEN:'test-token'});
    assert.equal(response.status,200);assert.equal(received.options.headers.Authorization,'Bearer test-token');
    const body=await response.text();assert.ok(!body.includes('test-token'));assert.ok(!body.includes('never expose'));
    const rows=JSON.parse(body).listings;assert.equal(validListings(rows).length,1);assert.match(listingInstruction(rows[0],false),/exchange buy/);
  } finally {globalThis.fetch=original;}
});
