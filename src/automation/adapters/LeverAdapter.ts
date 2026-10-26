import { BasePlatformAdapter } from './BasePlatformAdapter';
import { GenericFormAdapter } from './GenericFormAdapter';

export class LeverAdapter extends BasePlatformAdapter {
  public readonly name = 'Lever';
  public async matches(url: string): Promise<boolean> {
    try { return new URL(url).hostname === 'jobs.lever.co'; } catch { return false; }
  }
  public async execute(): Promise<boolean> {
    const { page, stateManager } = this.ctx;
    if (!await page.locator('form#application-form,.application-form').count()) {
      const link = page.getByRole('link', { name: /apply for this job/i }).first();
      if (await link.count() && await link.isVisible()) {
        stateManager.log('info', 'Opening the Lever application form');
        await link.click();
        await page.locator('form#application-form,.application-form').first().waitFor({ timeout: 10000 });
      }
    }
    return new GenericFormAdapter(this.ctx).execute();
  }
}
