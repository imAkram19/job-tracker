import type { Locator } from 'playwright';
import type { InputElementType } from '../types/automation';
import { fillDropdown } from './DropdownControl';

/** Fill only an unambiguous control/option. Never fall back to the first choice. */
export async function fillField(locator: Locator, type: InputElementType, answer: string): Promise<void> {
  const count = await locator.count();
  if (!count) throw new Error('Field is no longer present. Rescan the page.');
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
  const wanted = normalize(answer);
  if (type === 'radio' || (type === 'checkbox' && count > 1)) {
    const choices = await locator.evaluateAll(elements => elements.map(el => {
      const input = el as HTMLInputElement;
      return { value: input.value, label: Array.from(input.labels || []).map(l => l.textContent || '').join(' '), disabled: input.disabled };
    }));
    const labelled = choices.map((choice, index) => ({ choice, index })).filter(({ choice }) => !choice.disabled && normalize(choice.label) === wanted);
    const matches = labelled.length ? labelled : choices.map((choice, index) => ({ choice, index })).filter(({ choice }) => !choice.disabled && normalize(choice.value) === wanted);
    if (matches.length !== 1) throw new Error('No unique matching choice. Select an answer manually.');
    const selected = matches[0].index;
    await locator.nth(selected).check({ timeout: 5000 });
    if (type === 'checkbox') {
      for (let i = 0; i < count; i++) if (i !== selected && await locator.nth(i).isChecked()) await locator.nth(i).uncheck({ timeout: 5000 });
    }
    return;
  }
  if (count !== 1) throw new Error('Multiple fields match this question. Rescan before filling.');
  if (type === 'combobox') {
    await fillDropdown(locator, answer);
  } else if (type === 'select') {
    const options = await locator.evaluate(el => Array.from((el as HTMLSelectElement).options).map((o, index) => ({ label: o.text, value: o.value, disabled: o.disabled || (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled), index })));
    const labelled = options.filter(o => !o.disabled && normalize(o.label) === wanted);
    const matches = labelled.length ? labelled : options.filter(o => !o.disabled && normalize(o.value) === wanted);
    if (matches.length !== 1) throw new Error('No unique matching dropdown option. Select an answer manually.');
    // Index comes from the actual DOM, including placeholders, not filtered labels.
    await locator.selectOption({ index: matches[0].index }, { timeout: 5000 });
  } else if (type === 'checkbox') {
    if (!['yes','true','1','no','false','0'].includes(wanted)) throw new Error('Checkbox requires Yes or No.');
    await locator.setChecked(['yes','true','1'].includes(wanted), { timeout: 5000 });
  } else {
    await locator.fill(answer, { timeout: 5000 });
  }
}
