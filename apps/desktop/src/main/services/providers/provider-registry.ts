import { FrameworkProvider } from './base-provider';

export class ProviderRegistry {
  private providers: FrameworkProvider[] = [];

  register(provider: FrameworkProvider) {
    this.providers.push(provider);
  }

  getProviders(): FrameworkProvider[] {
    return this.providers;
  }

  getProvider(id: string): FrameworkProvider {
    const provider = this.providers.find(p => p.id === id);
    if (!provider) {
      throw new Error(`Provider not found: ${id}`);
    }
    return provider;
  }

  async detectProvider(projectPath: string): Promise<FrameworkProvider | null> {
    for (const provider of this.providers) {
      if (await provider.detect(projectPath)) {
        return provider;
      }
    }
    return null;
  }
}
