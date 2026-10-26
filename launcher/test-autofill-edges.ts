import { FieldMapper } from '../src/automation/core/FieldMapper';
import { FieldPicker } from '../src/automation/core/FieldPicker';
import { FileUploader } from '../src/automation/core/FileUploader';
import { BrowserManager } from '../src/automation/core/BrowserManager';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, Page } from 'playwright';
import { FormAnalyzer } from '../src/automation/core/FormAnalyzer';
import { fillField } from '../src/automation/core/FieldFiller';
import { GenericFormAdapter } from '../src/automation/adapters/GenericFormAdapter';
import { ApplicationStateManager } from '../src/automation/core/ApplicationStateManager';
import { ValidationHandler } from '../src/automation/core/ValidationHandler';

async function main() {
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(()=>{(window as any).__name=(fn:unknown)=>fn;});
 let html='';await context.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));
 let passed=0,failed=0;
 async function test(name:string,markup:string,run:(p:Page)=>Promise<void>){
   html=markup;const p=await context.newPage();p.setDefaultTimeout(1500);
   try{await p.goto('https://autofill-fixture.invalid');await run(p);console.log('PASS',name);passed++;}
   catch(e){console.log('FAIL',name,'—',(e as Error).message.split('\n')[0]);failed++;}
   finally{await p.close();}
 }
 const fields=(p:Page)=>new FormAnalyzer(p).discoverFields();
 const target=(p:Page,f:any)=>{let scope:any=p;for(const frame of f.framePath||[])scope=scope.frameLocator(frame);return scope.locator(f.selector);};
 async function adapter(p:Page,result:any,upload?:Function){
   const state=new ApplicationStateManager('fixture','Fixture','Fixture','https://autofill-fixture.invalid',false);
   const prompts:string[]=[];
   const ctx:any={page:p,candidate:{resumePath:'fixture.pdf'},stateManager:state,classifier:{classifyAndResolve:()=>result},humanManager:{promptHuman:async(f:any)=>{prompts.push(f.label);return {action:'SKIP_FIELD'};}},fileUploader:{uploadResume:async(...args:any[])=>upload?upload(...args):true},validationHandler:new ValidationHandler(p,state)};
   await new GenericFormAdapter(ctx).execute();return {state,prompts};
 }
 await test('hidden ancestors, disabled and readonly excluded','<div hidden><input aria-label="Hidden"></div><input disabled aria-label="Disabled"><input readonly aria-label="Readonly"><label>Visible<input></label>',async p=>assert.deepEqual((await fields(p)).map(f=>f.label),['Visible']));
 await test('anonymous controls target their own element','<div><label>First name<input></label></div><div><label>Last name<input></label></div>',async p=>{const f=await fields(p);assert.equal(f.length,2);await fillField(target(p,f[1]),f[1].type,'Example');assert.equal(await p.locator('input').nth(0).inputValue(),'');assert.equal(await p.locator('input').nth(1).inputValue(),'Example');});
 await test('duplicate ids do not merge different fields','<label>First name<input id="same"></label><label>Last name<input id="same"></label>',async p=>{const f=await fields(p);await fillField(target(p,f[1]),f[1].type,'Second');assert.equal(await p.locator('input').nth(1).inputValue(),'Second');assert.equal(await p.locator('input').nth(0).inputValue(),'');});
 await test('checkbox group selector fills checkbox, not radio','<fieldset><legend>Availability</legend><label><input type="checkbox" name="a" value="Yes">Yes</label><label><input type="checkbox" name="a" value="No">No</label></fieldset>',async p=>{const f=(await fields(p))[0];await fillField(target(p,f),f.type,'No');assert.equal(await p.locator('input:checked').inputValue(),'No');});
 await test('same radio name in separate forms stays separate','<form><fieldset><legend>First choice</legend><label><input type="radio" name="same" value="Yes">Yes</label></fieldset></form><form><fieldset><legend>Second choice</legend><label><input type="radio" name="same" value="No">No</label></fieldset></form>',async p=>{const f=await fields(p);assert.equal(f.length,2);await fillField(target(p,f[1]),f[1].type,'No');assert.equal(await p.locator('form').nth(0).locator('input').isChecked(),false);});
 await test('question label beats generic placeholder','<div class="form-group"><label>Notice period</label><div><input placeholder="Type your response"></div></div>',async p=>assert.equal((await fields(p))[0].label,'Notice period'));
 await test('the word required inside a question is not a required flag','<label>Is sponsorship required?<input></label>',async p=>assert.equal((await fields(p))[0].required,false));
 await test('search and sign-in fields excluded','<input type="search" aria-label="Search"><form><input type="email" aria-label="Email"><input type="password"></form><label>Application email<input type="email"></label>',async p=>assert.deepEqual((await fields(p)).map(f=>f.label),['Application email']));
 await test('disabled dropdown choices excluded','<label>Choice<select><option value="">Select...</option><option disabled>Disabled</option><optgroup disabled><option>Group disabled</option></optgroup><option>Available</option></select></label>',async p=>assert.deepEqual((await fields(p))[0].options,['Available']));
 await test('optional low-confidence answers are not guessed','<label>Question<input id="q"></label>',async p=>{await adapter(p,{value:'guess',confidence:'LOW'});assert.equal(await p.locator('#q').inputValue(),'');});
 await test('manual answers survive another scan','<label>Question<input id="q" value="My answer"></label>',async p=>{await adapter(p,{value:'profile default',confidence:'HIGH'});assert.equal(await p.locator('#q').inputValue(),'My answer');});
 await test('approved bank answer takes priority','<label>Question<input id="q" value="Old answer"></label>',async p=>{await adapter(p,{value:'Approved answer',confidence:'HIGH',fromAnswerBank:true});assert.equal(await p.locator('#q').inputValue(),'Approved answer');});
 await test('resume is not uploaded as a cover letter','<label>Resume<input type="file" id="resume"></label><label>Cover letter<input type="file" id="cover"></label>',async p=>{const uploaded:string[]=[];await adapter(p,{value:null,confidence:'LOW'},(selector:string)=>{uploaded.push(selector);return true;});assert.equal(uploaded.length,1);assert.equal(await p.locator(uploaded[0]).getAttribute('id'),'resume');});
 await test('hidden validation notices ignored','<div hidden><input required><span class="error-message">Old error</span></div><label>Valid<input value="yes"></label>',async p=>{const state=new ApplicationStateManager('f','f','f','https://autofill-fixture.invalid',false);assert.equal((await new ValidationHandler(p,state).validatePage()).hasErrors,false);});
 await test('visible invalid input is reported','<label>Email<input type="email" value="invalid"></label>',async p=>{const state=new ApplicationStateManager('f','f','f','https://autofill-fixture.invalid',false);assert.equal((await new ValidationHandler(p,state).validatePage()).hasErrors,true);});
 await test('open shadow-root field discovered and filled','<div id="host"></div><script>document.querySelector("#host").attachShadow({mode:"open"}).innerHTML="<label>First name<input></label>"</script>',async p=>{const f=await fields(p);assert.equal(f.length,1);await fillField(target(p,f[0]),f[0].type,'Example');assert.equal(await p.locator('input').inputValue(),'Example');});
 await test('iframe field discovered and filled','<iframe srcdoc="&lt;label&gt;First name&lt;input&gt;&lt;/label&gt;"></iframe>',async p=>{await p.frameLocator('iframe').locator('input').waitFor();const f=await fields(p);assert.equal(f.length,1);await fillField(target(p,f[0]),f[0].type,'Example');assert.equal(await p.frameLocator('iframe').locator('input').inputValue(),'Example');});
 await test('ARIA dropdown chooses the exact option','<label id="label">Country</label><button role="combobox" aria-labelledby="label" aria-controls="options" onclick="document.querySelector(\'#options\').hidden=false">Choose</button><div id="options" role="listbox" hidden><div role="option" onclick="document.querySelector(\'button\').textContent=this.textContent;this.parentElement.hidden=true">India</div><div role="option">Indonesia</div></div>',async p=>{const f=(await fields(p))[0];assert(f);await fillField(target(p,f),f.type,'India');assert.equal(await p.getByRole('combobox').innerText(),'India');});

 await test('conditional fields revealed by an answer are filled','<label>Details needed<select id="trigger" onchange="if(!document.querySelector(\'#details\'))this.insertAdjacentHTML(\'afterend\',\'<label>Details<input id=details></label>\')"><option value="">Choose</option><option>Yes</option></select></label>',async p=>{await adapter(p,{value:'Yes',confidence:'HIGH'});assert.equal(await p.locator('#details').inputValue(),'Yes');});
 await test('field identity survives a repeated scan','<label>First<input></label><label>Second<input></label>',async p=>{const first=await fields(p),second=await fields(p);assert.deepEqual(first.map(f=>f.id),second.map(f=>f.id));});
 await test('picker and autofill agree on question text','<div class="form-group"><label>Notice period</label><div><input placeholder="Type your response"></div></div>',async p=>{const picker=new FieldPicker();try{await picker.start(p);await p.locator('input').click();for(let i=0;i<20&&!picker.status().selected;i++)await p.waitForTimeout(50);assert.equal(picker.status().selected?.label,'Notice period');}finally{await picker.cancel();}});
 await test('picker inside inherited-origin iframe works','<iframe srcdoc="&lt;label&gt;First name&lt;input&gt;&lt;/label&gt;"></iframe>',async p=>{await p.frameLocator('iframe').locator('input').waitFor();const picker=new FieldPicker();try{await picker.start(p);await p.frameLocator('iframe').locator('input').click();for(let i=0;i<20&&!picker.status().selected;i++)await p.waitForTimeout(50);assert.equal(picker.status().selected?.label,'First name');assert.equal(picker.status().selected?.origin,'https://autofill-fixture.invalid');}finally{await picker.cancel();}});
 await test('required unknown answers pause instead of guessing','<label>Unknown<input required></label>',async p=>{const result=await adapter(p,{value:null,confidence:'LOW'});assert.equal(result.prompts.length,1);assert.equal(result.state.getState(),'NEEDS_ATTENTION');assert.equal(await p.locator('input').inputValue(),'');});
 await test('unsupported custom dropdown reports attention','<label id="l">Country</label><button role="combobox" aria-labelledby="l">Choose</button>',async p=>{const result=await adapter(p,{value:'India',confidence:'HIGH'});assert.equal(result.state.getState(),'NEEDS_ATTENTION');assert.equal(result.state.getStatus().filledFields.length,0);});
 await test('missing resume input never falls back to a different upload','<label>Cover letter<input type="file" id="cover"></label>',async p=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'akram-upload-fixture-'));const file=path.join(folder,'fake.pdf');fs.writeFileSync(file,'Synthetic test only');const state=new ApplicationStateManager('f','f','f','https://autofill-fixture.invalid',false);assert.equal(await new FileUploader(p,state).uploadResume('#missing',file),false);assert.equal(await p.locator('#cover').evaluate(el=>(el as HTMLInputElement).files?.length),0);});
 await test('current application tab is retained','<label>Name<input></label>',async p=>{const other=await context.newPage();try{await other.goto('https://autofill-fixture.invalid/second');const manager=new BrowserManager(new ApplicationStateManager('f','f','f','https://autofill-fixture.invalid',false));Object.assign(manager,{browser,context,page:other});assert.equal(await manager.ensureActivePage(),other);}finally{await other.close();}});

 await test('plain Name maps to the full name','<label>Name<input name="name"></label>',async p=>{const f=(await fields(p))[0];assert.equal(new FieldMapper({fullName:'Test Candidate'} as any).mapField(f).value,'Test Candidate');});
 await browser.close();console.log(JSON.stringify({passed,failed,total:passed+failed}));if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
