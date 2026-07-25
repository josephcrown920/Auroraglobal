/**
 * Collection Runtime — batch execution engine for the Canvas workflow builder.
 *
 * Separates the visual workflow (XYFlow canvas) from execution concerns.
 * A Collection is a first-class runtime object that holds N items and executes
 * them with configurable concurrency, pause/resume, and cancel.
 */

export type CollectionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type ItemStatus = "queued" | "running" | "done" | "failed";

export interface CollectionItem {
  index: number;
  status: ItemStatus;
}

export interface Collection<T = unknown> {
  id: string;
  type: string;
  items: T[];
  status: CollectionStatus;
  /** 0–1 */
  progress: number;
  completed: number;
  running: number;
  queued: number;
  failed: number;
  /** wall-clock ms since execution started */
  elapsedMs: number;
  /** estimated ms remaining, undefined until ≥2 items complete */
  estimatedMs: number | undefined;
  startedAt: number | undefined;
  metadata: Record<string, unknown>;
}

export interface CollectionRunOptions<T, R> {
  /** Max simultaneous in-flight jobs */
  concurrency: number;
  execute: (item: T, index: number) => Promise<R>;
  onItemStart?: (index: number) => void;
  onItemDone?: (index: number, result: R) => void;
  onItemError?: (index: number, error: Error) => void;
  onProgress?: (snapshot: Collection<T>) => void;
}

export function formatEtr(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `~${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

export class CollectionRunner<T = unknown, R = unknown> {
  private col: Collection<T>;
  private _cancelled = false;
  private _paused = false;
  private _pauseResolvers: (() => void)[] = [];
  private _completionTimes: number[] = [];

  constructor(id: string, type: string, items: T[]) {
    this.col = {
      id,
      type,
      items,
      status: "queued",
      progress: 0,
      completed: 0,
      running: 0,
      queued: items.length,
      failed: 0,
      elapsedMs: 0,
      estimatedMs: undefined,
      startedAt: undefined,
      metadata: {},
    };
  }

  get isCancelled() { return this._cancelled; }
  get isPaused() { return this._paused; }

  snapshot(): Collection<T> {
    const now = Date.now();
    return {
      ...this.col,
      elapsedMs: this.col.startedAt ? now - this.col.startedAt : 0,
    };
  }

  cancel() {
    this._cancelled = true;
    this.resume(); // unblock any paused waiters so the run loop exits cleanly
  }

  pause() {
    if (this._paused || this._cancelled) return;
    this._paused = true;
    this.col.status = "paused";
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    if (this.col.status === "paused") this.col.status = "running";
    const resolvers = this._pauseResolvers.splice(0);
    resolvers.forEach((r) => r());
  }

  private async waitIfPaused() {
    while (this._paused && !this._cancelled) {
      await new Promise<void>((res) => this._pauseResolvers.push(res));
    }
  }

  async run(opts: CollectionRunOptions<T, R>): Promise<Collection<T>> {
    const { concurrency, execute, onItemStart, onItemDone, onItemError, onProgress } = opts;
    const total = this.col.items.length;

    this.col.status = "running";
    this.col.startedAt = Date.now();
    onProgress?.(this.snapshot());

    await new Promise<void>((resolveRun) => {
      let active = 0;
      let index = 0;

      const dispatch = () => {
        if (this._cancelled) {
          if (active === 0) resolveRun();
          return;
        }

        while (active < concurrency && index < total && !this._cancelled && !this._paused) {
          const i = index++;
          active++;
          this.col.running++;
          this.col.queued = Math.max(0, this.col.queued - 1);
          onItemStart?.(i);
          onProgress?.(this.snapshot());

          (async () => {
            await this.waitIfPaused();
            if (this._cancelled) return;
            return execute(this.col.items[i], i);
          })()
            .then((result) => {
              if (result === undefined) return; // cancelled path
              this.col.running--;
              this.col.completed++;

              const now = Date.now();
              this._completionTimes.push(now);
              if (this._completionTimes.length >= 2 && this.col.startedAt) {
                const elapsed = now - this.col.startedAt;
                const rate = this._completionTimes.length / elapsed; // items/ms
                const remaining = total - this.col.completed;
                this.col.estimatedMs = remaining / rate;
              }
              this.col.progress = this.col.completed / total;
              onItemDone?.(i, result as R);
              onProgress?.(this.snapshot());
            })
            .catch((err: unknown) => {
              this.col.running--;
              this.col.failed++;
              this.col.progress = this.col.completed / total;
              onItemError?.(i, err instanceof Error ? err : new Error(String(err)));
              onProgress?.(this.snapshot());
            })
            .finally(() => {
              active--;
              dispatch();
              if (active === 0 && (index >= total || this._cancelled)) resolveRun();
            });
        }

        if (active === 0 && (index >= total || this._cancelled)) resolveRun();
      };

      dispatch();

      // When unpaused externally, restart dispatching
      const origResume = this.resume.bind(this);
      this.resume = () => {
        origResume();
        dispatch();
      };
    });

    this.col.status = this._cancelled
      ? "cancelled"
      : this.col.failed === total
      ? "failed"
      : "completed";

    return this.snapshot();
  }
}
