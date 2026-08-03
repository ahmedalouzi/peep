// Feature flag for IPC Batching
export const ENABLE_IPC_BATCHING = true;

export class IpcBatcher {
  private stringBuffers: Record<string, string[]> = {};
  private stringTimers: Record<string, NodeJS.Timeout> = {};

  private throttleTimers: Record<string, NodeJS.Timeout | null> = {};
  private throttlePending: Record<string, boolean> = {};

  /**
   * Throttles an event to fire at most once every `delayMs`.
   * Guarantees that if an event fires during the cooldown, it will execute exactly once after the cooldown.
   */
  public throttle(channel: string, delayMs: number, callback: () => void) {
    if (!ENABLE_IPC_BATCHING) {
      callback();
      return;
    }

    if (this.throttleTimers[channel]) {
      this.throttlePending[channel] = true;
      return;
    }

    // Fire immediately on leading edge
    callback();

    this.throttleTimers[channel] = setTimeout(() => {
      this.throttleTimers[channel] = null;
      if (this.throttlePending[channel]) {
        this.throttlePending[channel] = false;
        // Fire again since there were pending events
        this.throttle(channel, delayMs, callback);
      }
    }, delayMs);
  }

  /**
   * Buffers string output for a specific ID and flushes it via `flushCallback` after `delayMs`.
   * Preserves exact ordering.
   */
  public bufferString(
    channel: string,
    id: string,
    data: string,
    delayMs: number,
    flushCallback: (id: string, accumulated: string) => void
  ) {
    if (!ENABLE_IPC_BATCHING) {
      flushCallback(id, data);
      return;
    }

    const key = `${channel}:${id}`;
    if (!this.stringBuffers[key]) {
      this.stringBuffers[key] = [];
    }
    this.stringBuffers[key].push(data);

    if (!this.stringTimers[key]) {
      this.stringTimers[key] = setTimeout(() => {
        const accumulated = this.stringBuffers[key].join('');
        this.stringBuffers[key] = [];
        delete this.stringTimers[key];
        
        if (accumulated.length > 0) {
          flushCallback(id, accumulated);
        }
      }, delayMs);
    }
  }
}

export const globalIpcBatcher = new IpcBatcher();
