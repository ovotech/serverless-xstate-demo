import {
  EventObject,
  interpret,
  State,
  StateMachine,
  StateSchema,
  Typestate,
  Event,
  TypegenDisabled,
  BaseActionObject,
  ServiceMap,
  ResolveTypegenMeta,
  MarkAllImplementationsAsProvided,
} from "xstate";
import { StateStorage } from "./stateStorage";
import { toStatePaths } from "xstate/lib/utils";

export function createInterpreter<
  TContext,
  TStateSchema extends StateSchema,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  },
  TAction extends BaseActionObject = BaseActionObject,
  TServiceMap extends ServiceMap = ServiceMap,
  TResolvedTypesMeta = ResolveTypegenMeta<
    TypegenDisabled,
    TEvent,
    TAction,
    TServiceMap
  >
>(
  key: string,
  machine: StateMachine<
    TContext,
    TStateSchema,
    TEvent,
    TTypestate,
    TAction,
    TServiceMap,
    MarkAllImplementationsAsProvided<TResolvedTypesMeta>
  >,
  storage: StateStorage<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    MarkAllImplementationsAsProvided<TResolvedTypesMeta>
  >
): {
  settleMachine: (
    event: Event<TEvent>
  ) => Promise<
    State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      MarkAllImplementationsAsProvided<TResolvedTypesMeta>
    >
  >;
} {
  function toMetaKey(pathArray: Array<string> = []): string {
    return [machine.id].concat(pathArray).join(".");
  }

  function isSettled(
    state: State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      MarkAllImplementationsAsProvided<TResolvedTypesMeta>
    >
  ): boolean {
    const keys = toStatePaths(state.value).map(toMetaKey);
    if (keys.length > 0) {
      const settled: Array<boolean> = keys.map((key) => {
        if (state.meta[key] && state.meta[key].settled !== undefined) {
          return state.meta[key].settled;
        } else {
          return false;
        }
      });

      return settled.length > 0 ? settled.every((s) => s) : false;
    } else {
      return false;
    }
  }

  const settleMachine = async (event: Event<TEvent>) => {
    const persistedCurrentState = await storage.get(key);

    if (persistedCurrentState) {
      // Prevent actions being taken more than once since they were already done
      // before we persisted.
      persistedCurrentState.actions = [];
    }

    const initialState = persistedCurrentState
      ? machine.resolveState(persistedCurrentState)
      : machine.initialState;

    const eventWillTransition = machine.transition(initialState, event).changed;

    if (!eventWillTransition) {
      return initialState;
    }

    const service = interpret(machine.withContext(initialState.context));

    // When a state is hydrated it is guaranteed to be settled.
    // This is used so that we don't immediately exit when restoring the state.
    let hasTransitioned = false;

    const nextState = await new Promise<
      State<
        TContext,
        TEvent,
        TStateSchema,
        TTypestate,
        MarkAllImplementationsAsProvided<TResolvedTypesMeta>
      >
    >((resolve) => {
      service
        .onTransition((state, receivedEvent) => {
          if (!hasTransitioned) {
            hasTransitioned = true;
            return;
          }

          if (isSettled(state) || state.done) {
            service.stop();
            return resolve(state);
          }
        })
        .start(initialState)
        .send(event);
    });

    if (nextState.done) {
      await storage.cleanUp(key);
    } else if (nextState.changed) {
      await storage.set(key, nextState);
    }

    return nextState;
  };

  return { settleMachine };
}
