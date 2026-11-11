import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../control-panel/public/banking.mjs',import.meta.url),'utf8');

test('treasury help text does not require a linked Minecraft identity',()=>{
 assert(source.includes('Treasury access requires the appropriate Control Panel staff permission.'));
 assert(source.includes('A linked Minecraft UUID is required for your personal bank.'));
 assert(!source.includes('A linked Minecraft UUID is required. Bank access follows your linked in-game identity.'));
});

test('bank navigation accepts only an array of session permissions',()=>{
 assert(source.includes('permissions=Array.isArray(user?.permissions)?user.permissions:[];'));
 assert(!source.includes('permissions=user?.permissions||[];'));
});
