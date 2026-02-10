import {
  collectUsedIds,
  createDefaultCheckpoint,
  createDefaultCondition,
  createDefaultStep,
  createInitialState,
  type CheckpointDraft,
  type CoachDraft,
  type CoachDraftState,
  type ConditionDraft,
  type ConditionType,
  type DraftMeta,
  type StepDraft,
} from './draftTypes'

type StepPatch = Partial<Omit<StepDraft, 'checkpoints'>>
type CheckpointPatch = Partial<Omit<CheckpointDraft, 'conditions'>>
type ConditionPatch = Partial<ConditionDraft>

export type CoachDraftAction =
  | { type: 'meta/set'; field: keyof DraftMeta; value: string }
  | { type: 'step/add' }
  | { type: 'step/remove'; stepId: string }
  | { type: 'step/select'; stepId: string | null }
  | { type: 'step/update'; stepId: string; patch: StepPatch }
  | { type: 'step/rename'; stepId: string; nextId: string }
  | { type: 'checkpoint/select'; checkpointId: string | null }
  | { type: 'checkpoint/add'; stepId: string }
  | { type: 'checkpoint/remove'; stepId: string; checkpointId: string }
  | { type: 'checkpoint/update'; stepId: string; checkpointId: string; patch: CheckpointPatch }
  | {
      type: 'condition/add'
      stepId: string
      checkpointId: string
      conditionType?: ConditionType
    }
  | {
      type: 'condition/remove'
      stepId: string
      checkpointId: string
      conditionId: string
    }
  | {
      type: 'condition/update'
      stepId: string
      checkpointId: string
      conditionId: string
      patch: ConditionPatch
    }
  | { type: 'checkpoint/toggleExpert'; checkpointId: string; enabled: boolean }
  | { type: 'draft/replace'; draft: CoachDraft }
  | { type: 'draft/reset' }

const updateStep = (steps: StepDraft[], stepId: string, fn: (step: StepDraft) => StepDraft): StepDraft[] =>
  steps.map((step) => (step.id === stepId ? fn(step) : step))

const updateCheckpoint = (
  steps: StepDraft[],
  stepId: string,
  checkpointId: string,
  fn: (checkpoint: CheckpointDraft) => CheckpointDraft
): StepDraft[] =>
  updateStep(steps, stepId, (step) => ({
    ...step,
    checkpoints: step.checkpoints.map((checkpoint) =>
      checkpoint.id === checkpointId ? fn(checkpoint) : checkpoint
    ),
  }))

const ensureSelection = (state: CoachDraftState): CoachDraftState => {
  const hasSelectedStep =
    state.selectedStepId != null && state.draft.steps.some((step) => step.id === state.selectedStepId)

  const selectedStepId = hasSelectedStep ? state.selectedStepId : (state.draft.steps[0]?.id ?? null)

  const selectedStep =
    selectedStepId == null ? null : state.draft.steps.find((step) => step.id === selectedStepId) ?? null

  const hasSelectedCheckpoint =
    state.selectedCheckpointId != null &&
    selectedStep?.checkpoints.some((checkpoint) => checkpoint.id === state.selectedCheckpointId)

  const selectedCheckpointId = hasSelectedCheckpoint
    ? state.selectedCheckpointId
    : (selectedStep?.checkpoints[0]?.id ?? null)

  return {
    ...state,
    selectedStepId,
    selectedCheckpointId,
  }
}

const updateStepReferences = (steps: StepDraft[], oldStepId: string, newStepId: string): StepDraft[] =>
  steps.map((step) => ({
    ...step,
    checkpoints: step.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      signalRefStepId:
        checkpoint.signalRefStepId === oldStepId ? newStepId : checkpoint.signalRefStepId,
      signalDefaultPhase:
        checkpoint.signalDefaultPhase === oldStepId ? newStepId : checkpoint.signalDefaultPhase,
    })),
  }))

export const coachDraftReducer = (
  state: CoachDraftState,
  action: CoachDraftAction
): CoachDraftState => {
  switch (action.type) {
    case 'meta/set': {
      return {
        ...state,
        draft: {
          ...state.draft,
          metadata: {
            ...state.draft.metadata,
            [action.field]: action.value,
          },
        },
      }
    }

    case 'step/add': {
      const usedIds = collectUsedIds(state.draft)
      const step = createDefaultStep(usedIds.stepIds, usedIds.checkpointIds, usedIds.conditionIds)
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: [...state.draft.steps, step],
        },
        selectedStepId: step.id,
        selectedCheckpointId: step.checkpoints[0]?.id ?? null,
      }
    }

    case 'step/remove': {
      const nextState = {
        ...state,
        draft: {
          ...state.draft,
          steps: state.draft.steps.filter((step) => step.id !== action.stepId),
        },
      }
      return ensureSelection(nextState)
    }

    case 'step/select': {
      return ensureSelection({
        ...state,
        selectedStepId: action.stepId,
      })
    }

    case 'step/update': {
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: updateStep(state.draft.steps, action.stepId, (step) => ({
            ...step,
            ...action.patch,
          })),
        },
      }
    }

    case 'step/rename': {
      const trimmed = action.nextId.trim()
      if (trimmed.length === 0) return state

      const exists = state.draft.steps.some((step) => step.id === trimmed)
      if (exists && trimmed !== action.stepId) return state

      const renamedSteps = state.draft.steps.map((step) =>
        step.id === action.stepId ? { ...step, id: trimmed } : step
      )

      const nextSteps = updateStepReferences(renamedSteps, action.stepId, trimmed)
      return ensureSelection({
        ...state,
        draft: {
          ...state.draft,
          steps: nextSteps,
        },
        selectedStepId: state.selectedStepId === action.stepId ? trimmed : state.selectedStepId,
      })
    }

    case 'checkpoint/select': {
      return {
        ...state,
        selectedCheckpointId: action.checkpointId,
      }
    }

    case 'checkpoint/add': {
      const usedIds = collectUsedIds(state.draft)
      const checkpoint = createDefaultCheckpoint(action.stepId, usedIds.checkpointIds, usedIds.conditionIds)

      return ensureSelection({
        ...state,
        draft: {
          ...state.draft,
          steps: updateStep(state.draft.steps, action.stepId, (step) => ({
            ...step,
            checkpoints: [...step.checkpoints, checkpoint],
          })),
        },
        selectedStepId: action.stepId,
        selectedCheckpointId: checkpoint.id,
      })
    }

    case 'checkpoint/remove': {
      const nextState: CoachDraftState = {
        ...state,
        draft: {
          ...state.draft,
          steps: updateStep(state.draft.steps, action.stepId, (step) => ({
            ...step,
            checkpoints: step.checkpoints.filter((checkpoint) => checkpoint.id !== action.checkpointId),
          })),
        },
        expertCheckpointIds: state.expertCheckpointIds.filter((id) => id !== action.checkpointId),
      }

      return ensureSelection(nextState)
    }

    case 'checkpoint/update': {
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: updateCheckpoint(
            state.draft.steps,
            action.stepId,
            action.checkpointId,
            (checkpoint) => ({
              ...checkpoint,
              ...action.patch,
            })
          ),
        },
      }
    }

    case 'condition/add': {
      const usedIds = collectUsedIds(state.draft)
      const nextCondition = createDefaultCondition(usedIds.conditionIds, action.conditionType)

      return {
        ...state,
        draft: {
          ...state.draft,
          steps: updateCheckpoint(
            state.draft.steps,
            action.stepId,
            action.checkpointId,
            (checkpoint) => ({
              ...checkpoint,
              conditions: [...checkpoint.conditions, nextCondition],
            })
          ),
        },
      }
    }

    case 'condition/remove': {
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: updateCheckpoint(
            state.draft.steps,
            action.stepId,
            action.checkpointId,
            (checkpoint) => ({
              ...checkpoint,
              conditions: checkpoint.conditions.filter((condition) => condition.id !== action.conditionId),
            })
          ),
        },
      }
    }

    case 'condition/update': {
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: updateCheckpoint(
            state.draft.steps,
            action.stepId,
            action.checkpointId,
            (checkpoint) => ({
              ...checkpoint,
              conditions: checkpoint.conditions.map((condition) =>
                condition.id === action.conditionId ? { ...condition, ...action.patch } : condition
              ),
            })
          ),
        },
      }
    }

    case 'checkpoint/toggleExpert': {
      const enabled = state.expertCheckpointIds.includes(action.checkpointId)
      if (enabled === action.enabled) return state

      return {
        ...state,
        expertCheckpointIds: action.enabled
          ? [...state.expertCheckpointIds, action.checkpointId]
          : state.expertCheckpointIds.filter((id) => id !== action.checkpointId),
      }
    }

    case 'draft/replace': {
      return ensureSelection({
        ...state,
        draft: action.draft,
      })
    }

    case 'draft/reset': {
      return createInitialState()
    }

    default:
      return state
  }
}
