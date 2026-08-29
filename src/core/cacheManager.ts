export interface FileCacheEntry {
  filePath: string;
  mtime: number;
  size: number;
  tokensByModel: Record<string, number>;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, FileCacheEntry> = new Map();

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public get(filePath: string, mtime: number, modelId: string): number | undefined {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return undefined;
    }
    // If file was modified on disk, invalidate cache entry
    if (entry.mtime !== mtime) {
      return undefined;
    }
    return entry.tokensByModel[modelId];
  }

  public set(filePath: string, mtime: number, size: number, modelId: string, count: number): void {
    let entry = this.cache.get(filePath);
    if (!entry || entry.mtime !== mtime) {
      entry = {
        filePath,
        mtime,
        size,
        tokensByModel: {}
      };
      this.cache.set(filePath, entry);
    }
    entry.tokensByModel[modelId] = count;
  }

  public invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  public clear(): void {
    this.cache.clear();
  }

  public getEntry(filePath: string): FileCacheEntry | undefined {
    return this.cache.get(filePath);
  }

  public getAllEntries(): FileCacheEntry[] {
    return Array.from(this.cache.values());
  }

  public getTotalTokens(modelId: string): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.tokensByModel[modelId] || 0;
    }
    return total;
  }
}
