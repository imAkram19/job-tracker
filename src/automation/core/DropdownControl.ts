import type { Locator } from 'playwright';

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

async function optionList(control: Locator): Promise<Locator> {
  const handle = await control.elementHandle();
  const frame = await handle?.ownerFrame();
  await handle?.dispose();
  if (!frame) throw new Error('The dropdown is no longer on this page. Choose it again.');
  const ids = `${await control.getAttribute('aria-controls') || ''} ${await control.getAttribute('aria-owns') || ''}`.trim().split(/\s+/).filter(Boolean);
  const linked = Array.from(new Set(ids));
  const list = linked.length
    ? frame.locator(linked.map(id => `[id=${JSON.stringify(id)}]`).join(',')).filter({ visible: true })
    : frame.locator('[role="listbox"]:visible');
  await list.first().waitFor({ state: 'visible', timeout: 3000 });
  if (await list.count() !== 1) throw new Error('More than one option list is open. Close other dropdowns and try again.');
  return list;
}

async function choices(list: Locator) {
  return list.getByRole('option').evaluateAll(elements => elements.map((element, index) => ({
    label: ((element as HTMLElement).innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: !!element.closest('[aria-disabled="true"],[disabled]'), index,
  })).filter(option => option.label));
}

async function scrollList(list: Locator, reset = false): Promise<boolean> {
  return list.evaluate((element, reset) => {
    const scrollable = [element, ...Array.from(element.querySelectorAll('*'))].find(node => {
      const style = getComputedStyle(node);
      return node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(style.overflowY);
    });
    if (!scrollable) return false;
    const before = scrollable.scrollTop;
    scrollable.scrollTop = reset ? 0 : before + Math.max(1, scrollable.clientHeight - 16);
    return scrollable.scrollTop !== before;
  }, reset);
}

/** Capture native and ARIA dropdowns, including portal lists and virtualized options. */
export async function readDropdownOptions(control: Locator): Promise<string[]> {
  if (await control.evaluate(el => el instanceof HTMLSelectElement)) {
    return control.evaluate(el => Array.from((el as HTMLSelectElement).options)
      .filter(option => option.value && !option.disabled && !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled))
      .map(option => option.text.trim()));
  }
  await control.click({ timeout: 5000 });
  try {
    const list = await optionList(control);
    await list.getByRole('option').first().waitFor({ state: 'visible', timeout: 3000 });
    await scrollList(list, true);
    await list.page().waitForTimeout(100);
    const labels = new Set<string>();
    for (let pass = 0; pass < 60; pass++) {
      for (const option of await choices(list)) if (!option.disabled) labels.add(option.label);
      if (!await scrollList(list)) {
        if (!labels.size) throw new Error('No dropdown options are loaded. Filter the dropdown in the browser, then choose it again.');
        return Array.from(labels);
      }
      await list.page().waitForTimeout(100);
    }
    throw new Error('This list is too long to capture completely. Filter it in the browser, then choose it again.');
  } finally {
    await control.press('Escape').catch(() => {});
  }
}

export async function fillDropdown(control: Locator, answer: string): Promise<void> {
  await control.click({ timeout: 5000 });
  const editable = await control.evaluate(el => el instanceof HTMLInputElement && !el.readOnly);
  const previous = editable ? await control.inputValue() : '';
  let selected = false;
  try {
    if (editable) await control.fill(answer, { timeout: 5000 });
    const list = await optionList(control);
    await scrollList(list, true);
    await list.page().waitForTimeout(100);
    for (let pass = 0; pass < 60; pass++) {
      const options = await choices(list);
      const matches = options.filter(option => !option.disabled && normalize(option.label) === normalize(answer));
      if (matches.length > 1) throw new Error('Dropdown choice is ambiguous. Select it manually.');
      if (matches.length === 1) {
        await list.getByRole('option', { name: matches[0].label, exact: true }).click({ timeout: 5000 });
        selected = true; return;
      }
      if (!await scrollList(list)) break;
      await list.page().waitForTimeout(100);
    }
    throw new Error('The remembered option is unavailable in this dropdown. Choose an answer manually.');
  } finally {
    if (!selected) {
      if (editable) await control.fill(previous).catch(() => {});
      await control.press('Escape').catch(() => {});
    }
  }
}
