import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { NextRequest } from 'next/server';
import { requireLocalRequest } from '../src/automation/core/localRequest';
import { fillField } from '../src/automation/core/FieldFiller';
import { FormAnalyzer } from '../src/automation/core/FormAnalyzer';
import { FieldPicker } from '../src/automation/core/FieldPicker';
import { SelectedAnswerMemory } from '../src/automation/core/SelectedAnswerMemory';
async function main() {
 const request=(host:string,origin:string,site='same-origin')=>new NextRequest('http://localhost:3000/api/automation/accounts',{headers:{host,origin,'sec-fetch-site':site}});
 for(const host of ['127.0.0.1:3000','localhost:3000','[::1]:3000']) requireLocalRequest(request(host,`http://${host}`));
 for(const req of [request('127.0.0.1:3000','https://example.com'),request('127.0.0.1:3000','http://127.0.0.1:3001'),request('example.com','http://example.com'),request('127.0.0.1:3000','http://127.0.0.1:3000','cross-site')]) assert.throws(()=>requireLocalRequest(req));
 console.log('PASS loopback and cross-site origin checks');
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 // tsx emits a keepNames helper inside serialized callbacks; production SWC does not.
 await context.addInitScript(()=>{(window as any).__name=(fn:unknown)=>fn;});
 const page=await context.newPage();
 const html=`<form><label for="search">Search jobs</label><input id="search" type="search"><label for="name">Full name</label><input id="name" name="name"><label for="choice">Location</label><select id="choice"><option value="">Select...</option><option value="a">Alpha</option><option value="b">Beta</option></select><fieldset><legend>Permission</legend><input id="r1" name="permission" type="radio" value="1"><label for="r1">No sponsorship required</label><input id="r2" name="permission" type="radio" value="2"><label for="r2">No</label></fieldset><label><input id="single" type="checkbox" checked>Receive updates</label><li class="application-question"><div class="application-label">Availability ✱</div><div class="application-field"><label><input type="checkbox" name="availability" value="yes">Yes</label><label><input type="checkbox" name="availability" value="no">No</label><label><input type="checkbox" name="availability" value="maybe">Maybe</label></div></li></form>`;
 await context.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html; charset=utf-8',body:html}):route.abort());
 await page.goto('https://memory-check.invalid');
 await fillField(page.locator('#choice'),'select',' beta '); assert.equal(await page.locator('#choice').inputValue(),'b');
 await assert.rejects(fillField(page.locator('#choice'),'select','missing')); assert.equal(await page.locator('#choice').inputValue(),'b');
 await fillField(page.locator('[name=permission]'),'radio','No'); assert.equal(await page.locator('#r2').isChecked(),true);
 await assert.rejects(fillField(page.locator('[name=permission]'),'radio','unknown')); assert.equal(await page.locator('#r1').isChecked(),false);
 await fillField(page.locator('#single'),'checkbox','No'); assert.equal(await page.locator('#single').isChecked(),false);
 await fillField(page.locator('[name=availability]'),'checkbox','Maybe'); assert.equal(await page.locator('[name=availability]:checked').inputValue(),'maybe');
 const fields=await new FormAnalyzer(page).discoverFields(); assert(!fields.some(f=>/search/i.test(f.label)));
 const availability=fields.find(f=>f.name==='availability')!; assert.equal(availability.label,'Availability'); assert.deepEqual(availability.options,['Yes','No','Maybe']);
 console.log('PASS exact radio/dropdown matches, unmatched choices unchanged, checkbox clear and grouped choices');
 const picker=new FieldPicker(); await picker.start(page);
 await page.locator('#search').click(); assert.equal(picker.status().selected,null); assert.equal(picker.status().active,true);
 await page.locator('[name=availability]').nth(2).click();
 for(let i=0;i<30 && !picker.status().selected;i++) await new Promise(r=>setTimeout(r,50));
 const selected=picker.status().selected!; assert.equal(selected.label,'Availability'); assert.equal(selected.type,'checkbox');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'akram-memory-check-')); const old=process.env.LOCALAPPDATA; process.env.LOCALAPPDATA=temp;
 try {
   const memory=new SelectedAnswerMemory(); const entry=memory.save(selected,'Maybe');
   assert.equal(entry.scope,'all'); assert.equal(memory.find(availability),undefined);
   memory.promote(entry.id);
   assert.equal(memory.find(availability)?.answer,'Maybe');
   assert.equal(new SelectedAnswerMemory().find({...availability,pageOrigin:'https://another.invalid'})?.answer,'Maybe');
   memory.updateApproved(entry.id,'No'); assert.equal(memory.find(availability)?.answer,'No');
   const replacement=memory.save({...selected,origin:'https://another.invalid'},'Yes');
   memory.promote(replacement.id); assert.equal(memory.list().filter(e=>e.approved).length,1);
   assert.equal(memory.find(availability)?.answer,'Yes');
   memory.unapprove(replacement.id); assert.equal(memory.find(availability),undefined);
   memory.rememberFilled(availability,'Maybe');
   assert.equal(memory.find({...availability,pageOrigin:'https://future.invalid'})?.answer,'Maybe');
   assert.equal(memory.list().filter(e=>e.approved).length,1);
   memory.rememberFilled(availability,'No');
   assert.equal(memory.find(availability)?.answer,'No');
   assert.equal(memory.list().filter(e=>e.approved).length,1);
   memory.rememberFilled({...availability,label:'Search jobs',type:'search' as any},'private search');
   assert.equal(memory.list().filter(e=>e.approved).length,1);
   for (const saved of memory.list()) memory.remove(saved.id);
   assert.equal(memory.list().length,0);
 }
 finally { if(old===undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA=old; }
 await picker.start(page); await page.keyboard.press('Escape'); for(let i=0;i<30&&picker.status().active;i++)await new Promise(r=>setTimeout(r,50)); assert.equal(picker.status().active,false);
 await browser.close(); console.log('PASS picker selection, search exclusion, approval gating, cross-site persistent recall, editing, replacement and removal, deletion and Escape');
 process.exit(0);
}
main().catch(err=>{console.error(err);process.exit(1)});
