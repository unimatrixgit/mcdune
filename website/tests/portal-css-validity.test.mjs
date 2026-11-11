import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../web/portal-design.css',import.meta.url),'utf8');

test('portal CSS does not prefix at-rules with element selectors',()=>{
 assert.doesNotMatch(css,/body\.portal-redesign main\s+@(?:media|keyframes|supports)/);
});

test('portal theme variables are defined on an existing element',()=>{
 assert.match(css,/body\.portal-redesign main\s*\{--bg:/);
 assert.doesNotMatch(css,/body\.portal-redesign main\s+:root/);
});

test('portal responsive breakpoints remain available',()=>{
 assert.match(css,/@media\s*\(max-width:/);
});
