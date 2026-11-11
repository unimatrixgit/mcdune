import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../control-panel/public/banking.mjs',import.meta.url),'utf8');

test('treasury help text does not require a linked Minecraft identity',()=>{
 assert.match(source,/id==='staff-bank'\?'\* Treasury access requires the appropriate Control Panel staff permission\.'/);
 assert.match(source,/A linked Minecraft UUID is required for your personal bank/);
});
