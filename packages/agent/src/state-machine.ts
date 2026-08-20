import type { AgentPhase } from '@peep/shared';

/**
 * Valid transitions map: for each current phase, the set of allowed next phases.
 * The SM enforces these to prevent invalid lifecycle sequences.
 */
const VALID_TRANSITIONS: Record<AgentPhase, ReadonlyArray<AgentPhase>> = {
  idle:          ['initializing'],
  initializing:  ['thinking', 'error', 'cancelled'],
  thinking:      ['tool_executing', 'summarizing', 'done', 'error', 'cancelled'],
  tool_executing:['thinking', 'error', 'cancelled'],
  summarizing:   ['done', 'error', 'cancelled'],
  done:          ['idle'],
  error:         ['idle'],
  cancelled:     ['idle'],
};

/**
 * AgentStateMachine — enforces the runtime execution phases of a single
 * send() invocation. Instantiate once per invocation; reset() when the run
 * is fully resolved.
 *
 * Distinct from task-state.ts / AgentState which is a task-planning concern.
 */
export class AgentStateMachine {
  private _phase: AgentPhase = 'idle';
  private readonly _onPhaseChange: ((phase: AgentPhase) => void) | undefined;

  constructor(onPhaseChange?: (phase: AgentPhase) => void) {
    this._onPhaseChange = onPhaseChange;
  }

  get phase(): AgentPhase {
    return this._phase;
  }

  /**
   * Transition to a new phase. Throws if the transition is not valid.
   * If the SM is already in the target phase, the call is a no-op (idempotent).
   */
  transition(next: AgentPhase): void {
    if (this._phase === next) {
      // Idempotent: already in target phase, nothing to do.
      return;
    }
    const allowed = VALID_TRANSITIONS[this._phase];
    if (!allowed.includes(next)) {
      throw new Error(
        `[AgentStateMachine] Invalid transition: ${this._phase} → ${next}. ` +
        `Allowed: [${allowed.join(', ')}]`
      );
    }
    this._phase = next;
    this._onPhaseChange?.(next);
  }

  /**
   * Unconditionally resets the SM to 'idle'.
   * Safe to call from a finally block regardless of current phase.
   * If already idle, this is a no-op.
   */
  reset(): void {
    if (this._phase === 'idle') return;
    // Drive through a terminal state if not already there
    if (this._phase !== 'done' && this._phase !== 'error' && this._phase !== 'cancelled') {
      // Force to 'error' phase first so the transition to idle is valid
      this._phase = 'error';
    }
    this._phase = 'idle';
    this._onPhaseChange?.('idle');
  }
}
