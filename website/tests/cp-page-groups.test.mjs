import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageArea} from '../control-panel/public/page-groups.mjs';
test('personal tickets and account tools stay separate from staff administration',()=>{
 for(const key of ['game','planetary-inventory','rewards','security','tickets','exchange'])assert.equal(pageArea(key),'user');
 for(const key of ['staff-tickets','permissions','server-operations','forum-admin','exchange-admin','website-posts','staff-manual','luckperms'])assert.equal(pageArea(key),'staff');
});
