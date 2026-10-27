import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, Page } from 'playwright';
import { FieldPicker } from '../src/automation/core/FieldPicker';
import { FormAnalyzer } from '../src/automation/core/FormAnalyzer';
import { fillField } from '../src/automation/core/FieldFiller';
import { readDropdownOptions } from '../src/automation/core/DropdownControl';
import { SelectedAnswerMemory } from '../src/automation/core/SelectedAnswerMemory';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => { (window as any).__name = (fn: unknown) => fn; });
  let html = '';
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  let passed = 0;
  async function test(name: string, markup: string, run: (page: Page) => Promise<void>) {
    html = markup;
    const page = await context.newPage();
    try { await page.goto('https://dropdown-fixture.invalid'); await run(page); passed++; console.log('PASS', name); }
    finally { await page.close(); }
  }
  async function pick(page: Page, selector = '#choice', iframe?: string) {
    const picker = new FieldPicker(); await picker.start(page);
    await (iframe ? page.frameLocator(iframe).locator(selector) : page.locator(selector)).click();
    for (let i = 0; i < 150 && picker.status().active; i++) await page.waitForTimeout(50);
    assert(!picker.status().error, picker.status().error);
    assert(picker.status().selected, 'Picker did not capture the dropdown');
    return picker.status().selected!;
  }
  const custom = (attributes = 'role="combobox" aria-controls="options" readonly', listAttributes = '') => `
    <label for="choice">Preferred office</label><input id="choice" ${attributes} value="Alpha">
    <div id="options" role="listbox" hidden ${listAttributes}><div role="option">Alpha</div><div role="option">Beta</div><div role="option" aria-disabled="true">Disabled</div></div>
    <script>choice.onclick=()=>options.hidden=false;choice.onkeydown=e=>{if(e.key==='Escape')options.hidden=true};options.onclick=e=>{if(e.target.getAttribute('role')==='option'&&e.target.getAttribute('aria-disabled')!=='true'){choice.value=e.target.textContent;options.hidden=true}}</script>`;
  try {
    await test('native dropdown captures its question and enabled options', '<label for="choice">Preferred office</label><select id="choice"><option value="">Choose</option><option value="a">Alpha</option><option value="b">Beta</option><optgroup label="Unavailable" disabled><option value="c">Disabled</option></optgroup></select>', async page => {
      const selected = await pick(page); assert.equal(selected.type, 'select'); assert.equal(selected.label, 'Preferred office'); assert.deepEqual(selected.options, ['Alpha', 'Beta']);
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dropdown-memory-')); const previous = process.env.LOCALAPPDATA; process.env.LOCALAPPDATA = temp;
      try {
        const memory = new SelectedAnswerMemory(); const saved = memory.save(selected, 'Beta'); memory.promote(saved.id);
        const field = (await new FormAnalyzer(page).discoverFields())[0];
        assert.equal(new SelectedAnswerMemory().find({ ...field, pageOrigin: 'https://another.invalid' })?.answer, 'Beta');
        assert.equal(memory.find({ ...field, type: 'combobox' })?.answer, 'Beta');
        await fillField(page.locator('#choice'), 'select', memory.find(field)!.answer); assert.equal(await page.locator('#choice').inputValue(), 'b');
        assert.throws(() => memory.save(selected, 'Not an option'));
      } finally { if (previous === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = previous; }
    });
    await test('readonly custom dropdown opens and captures all options', custom(), async page => {
      const selected = await pick(page); assert.equal(selected.type, 'combobox'); assert.equal(selected.label, 'Preferred office'); assert.deepEqual(selected.options, ['Alpha', 'Beta']);
      assert.equal(await page.locator('#choice').inputValue(), 'Alpha');
      const field = (await new FormAnalyzer(page).discoverFields())[0]; assert.equal(field.type, 'combobox');
      await fillField(page.locator('#choice'), 'combobox', 'beta'); assert.equal(await page.locator('#choice').inputValue(), 'Beta');
    });
    await test('aria-owns dropdown supports portal options', custom('role="combobox" aria-owns="options" readonly'), async page => {
      assert.deepEqual((await pick(page)).options, ['Alpha', 'Beta']); await fillField(page.locator('#choice'), 'combobox', 'Beta'); assert.equal(await page.locator('#choice').inputValue(), 'Beta');
    });
    await test('button dropdown with a unique visible list is supported', '<label id="q">Preferred office</label><button id="choice" type="button" aria-haspopup="listbox" aria-labelledby="q">Alpha</button><div id="options" role="listbox" hidden><div role="option">Alpha</div><div role="option">Beta</div></div><script>choice.onclick=()=>options.hidden=false;choice.onkeydown=e=>{if(e.key==="Escape")options.hidden=true};options.onclick=e=>{choice.textContent=e.target.textContent;options.hidden=true}</script>', async page => {
      const selected = await pick(page); assert.equal(selected.type, 'combobox'); assert.deepEqual(selected.options, ['Alpha', 'Beta']); await fillField(page.locator('#choice'), 'combobox', 'Beta'); assert.equal(await page.locator('#choice').innerText(), 'Beta');
    });
    await test('a missing remembered option does not select another answer', custom(), async page => {
      await assert.rejects(fillField(page.locator('#choice'), 'combobox', 'Missing')); assert.equal(await page.locator('#choice').inputValue(), 'Alpha');
    });
    await test('custom dropdown inside an iframe captures and fills its own options', '<iframe id="embedded"></iframe>', async page => {
      await page.frames()[1].setContent(custom());
      assert.deepEqual((await pick(page, '#choice', '#embedded')).options, ['Alpha', 'Beta']);
      const control = page.frameLocator('#embedded').locator('#choice'); await fillField(control, 'combobox', 'Beta'); assert.equal(await control.inputValue(), 'Beta');
    });
    await test('custom dropdown in an open shadow root captures and fills', '<div id="host"></div>', async page => {
      await page.evaluate(() => {
        const root = document.querySelector('#host')!.attachShadow({ mode: 'open' });
        root.innerHTML = '<label for="choice">Preferred office</label><input id="choice" role="combobox" aria-controls="shadow-options" readonly><div id="shadow-options" role="listbox" hidden><div role="option">Alpha</div><div role="option">Beta</div></div>';
        const control = root.querySelector<HTMLInputElement>('#choice')!; const list = root.querySelector<HTMLElement>('[role=listbox]')!;
        control.onclick = () => { list.hidden = false; }; control.onkeydown = event => { if (event.key === 'Escape') list.hidden = true; };
        list.onclick = event => { control.value = (event.target as HTMLElement).textContent || ''; list.hidden = true; };
      });
      assert.deepEqual((await pick(page)).options, ['Alpha', 'Beta']); await fillField(page.locator('#choice'), 'combobox', 'Beta'); assert.equal(await page.locator('#choice').inputValue(), 'Beta');
    });
    await test('multiple visible unlinked option lists require manual selection', custom('role="combobox" readonly') + '<div role="listbox"><div role="option">Other</div></div>', async page => {
      await assert.rejects(readDropdownOptions(page.locator('#choice')), /More than one/);
    });
    await test('virtualized options are captured beyond the first visible page', '<label for="choice">Preferred office</label><input id="choice" role="combobox" aria-controls="options" readonly><div id="options" role="listbox" hidden style="height:100px;overflow-y:auto;position:relative"><div id="space" style="height:600px"></div></div><script>function render(){options.querySelectorAll("[role=option]").forEach(e=>e.remove());const start=Math.floor(options.scrollTop/20);for(let i=start;i<Math.min(start+6,30);i++){const e=document.createElement("div");e.setAttribute("role","option");e.textContent="Office "+i;e.style.cssText="position:absolute;top:"+(i*20)+"px;height:20px";e.onclick=()=>{choice.value=e.textContent;options.hidden=true};options.append(e)}}options.onscroll=render;choice.onclick=()=>{options.hidden=false;render()};choice.onkeydown=e=>{if(e.key==="Escape")options.hidden=true}</script>', async page => {
      const selected = await pick(page); assert.equal(selected.options?.length, 30); assert(selected.options?.includes('Office 29')); await fillField(page.locator('#choice'), 'combobox', 'Office 29'); assert.equal(await page.locator('#choice').inputValue(), 'Office 29');
    });
    console.log(JSON.stringify({ passed, failed: 0 }));
  } finally { await browser.close(); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
