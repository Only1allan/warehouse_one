import { loadModel, unloadModel } from "@qvac/sdk";

type Loader = () => Promise<string>;

interface Slot {
  modelId?: string;
  loading?: Promise<string>;
  lastUsed: number;
  resident: boolean;
  loader: Loader;
}

const IDLE_UNLOAD_MS = 5 * 60_000;

export class ModelManager {
  private slots = new Map<string, Slot>();
  private sweeper?: ReturnType<typeof setInterval>;

  register(key: string, loader: Loader, resident: boolean): void {
    if (!this.slots.has(key)) {
      this.slots.set(key, { lastUsed: Date.now(), resident, loader });
    }
    this.startSweeper();
  }

  async get(key: string): Promise<string> {
    const slot = this.slots.get(key);
    if (!slot) throw new Error(`Model slot "${key}" is not registered`);
    slot.lastUsed = Date.now();
    if (slot.modelId) return slot.modelId;
    if (!slot.loading) {
      slot.loading = slot
        .loader()
        .then((id) => {
          slot.modelId = id;
          return id;
        })
        .finally(() => {
          slot.loading = undefined;
        });
    }
    return slot.loading;
  }

  isLoaded(key: string): boolean {
    return Boolean(this.slots.get(key)?.modelId);
  }

  async unload(key: string): Promise<void> {
    const slot = this.slots.get(key);
    if (!slot?.modelId) return;
    const id = slot.modelId;
    slot.modelId = undefined;
    await unloadModel({ modelId: id });
  }

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [key, slot] of this.slots) {
        if (!slot.resident && slot.modelId && now - slot.lastUsed > IDLE_UNLOAD_MS) {
          void this.unload(key);
        }
      }
    }, 30_000);
    this.sweeper.unref?.();
  }
}

const globalForModels = globalThis as unknown as { __qvacModels?: ModelManager };

export function getModelManager(): ModelManager {
  if (!globalForModels.__qvacModels) {
    globalForModels.__qvacModels = new ModelManager();
  }
  return globalForModels.__qvacModels;
}

export { loadModel };
