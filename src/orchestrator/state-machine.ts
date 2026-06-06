import type { OrchestratorState } from './types.js';

export class StateMachine {
  private currentState: OrchestratorState = 'IDLE';
  private history: Array<{ from: OrchestratorState; to: OrchestratorState; timestamp: string }> = [];

  constructor(initialState: OrchestratorState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): OrchestratorState {
    return this.currentState;
  }

  public getHistory() {
    return this.history;
  }

  /**
   * Defines valid transitions for the orchestrator.
   */
  private static readonly VALID_TRANSITIONS: Record<OrchestratorState, Set<OrchestratorState>> = {
    IDLE: new Set(['RESEARCHING', 'FAILED']),
    RESEARCHING: new Set(['SPECIFYING', 'FAILED']),
    SPECIFYING: new Set(['GENERATING', 'FAILED']),
    GENERATING: new Set(['VALIDATING', 'FAILED']),
    VALIDATING: new Set(['GATING', 'FAILED']),
    GATING: new Set(['DEPLOYING', 'REWRITING', 'ROLLBACK', 'COMPLETED', 'FAILED']),
    DEPLOYING: new Set(['MONITORING', 'FAILED']),
    MONITORING: new Set(['RECOVERING', 'COMPLETED', 'FAILED']),
    REWRITING: new Set(['VALIDATING', 'FAILED']),
    RECOVERING: new Set(['MONITORING', 'FAILED']),
    COMPLETED: new Set(['MONITORING', 'FAILED']),
    FAILED: new Set(['IDLE']),
  } as any;

  /**
   * Transition to a new target state.
   * @param to - The target state.
   */
  public transitionTo(to: OrchestratorState): boolean {
    const from = this.currentState;
    
    // Check validation rules
    const allowed = StateMachine.VALID_TRANSITIONS[from];
    if (!allowed || (!allowed.has(to) && to !== 'FAILED')) {
      throw new Error(`Invalid state transition: Cannot transition from ${from} to ${to}`);
    }

    this.currentState = to;
    this.history.push({
      from,
      to,
      timestamp: new Date().toISOString(),
    });

    return true;
  }
}
