import { BasePlatformAdapter, AdapterContext } from '../adapters/BasePlatformAdapter';
import { LeverAdapter } from '../adapters/LeverAdapter';
import { GenericFormAdapter } from '../adapters/GenericFormAdapter';

export class ApplicationDetector {
  public static async selectAdapter(ctx: AdapterContext, url: string): Promise<BasePlatformAdapter> {
    const lever = new LeverAdapter(ctx);
    if (await lever.matches(url)) {
      return lever;
    }

    // Default universal adapter
    return new GenericFormAdapter(ctx);
  }
}
