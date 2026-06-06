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
    IDLE: new Set(['APPROVING', 'FAILED']),
    APPROVING: new Set(['BOOTSTRAPPING', 'FAILED']),
    BOOTSTRAPPING: new Set(['RESEARCHING', 'FAILED']),
    RESEARCHING: new Set(['ANALYZING', 'FAILED']),
    ANALYZING: new Set(['SELECTING', 'FAILED']),
    SELECTING: new Set(['SPECIFYING', 'FAILED']),
    SPECIFYING: new Set(['CREATING', 'FAILED']),
    CREATING: new Set(['PAGE_GENERATING', 'FAILED']),
    PAGE_GENERATING: new Set(['SEO_VALIDATING', 'FAILED']),
    SEO_VALIDATING: new Set(['GATING', 'FAILED']),
    GATING: new Set(['COMMITTING', 'REWRITING', 'RECOVERING', 'FAILED']),
    REWRITING: new Set(['SEO_VALIDATING', 'FAILED']),
    COMMITTING: new Set(['DEPLOYING', 'FAILED']),
    DEPLOYING: new Set(['ANALYTICS_QUEUE', 'FAILED']),
    ANALYTICS_QUEUE: new Set(['GSC_QUEUE', 'FAILED']),
    GSC_QUEUE: new Set(['ADSENSE_QUEUE', 'FAILED']),
    ADSENSE_QUEUE: new Set(['MONITORING', 'FAILED']),
    MONITORING: new Set(['RECOVERING', 'COMPLETED', 'FAILED']),
    RECOVERING: new Set(['MONITORING', 'COMPLETED', 'FAILED']),
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
    if (!allowed || (!allowed.has(to) && to !== 'FAILED' && to !== 'RECOVERING')) {
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
