import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('legacy staff generator cannot overwrite staff.html without explicit opt-in',()=>{
 const source=readFileSync(new URL('../scripts/build-staff.mjs',import.meta.url),'utf8');
 assert.match(source,/process\.argv\.includes\('--regenerate-staff'\)/);
 assert.match(source,/if\(process\.argv\.includes\('--regenerate-staff'\)\)\s*\{\s*writeFileSync\(new URL\('staff\.html',web\),page\)/);
});
test('staff roster page remains available to the public build',()=>{
 const page=readFileSync(new URL('../web/staff.html',import.meta.url),'utf8');
 assert.match(page,/id="roster-heading"/);
 assert.match(page,/Staff & Contributors/);
});
