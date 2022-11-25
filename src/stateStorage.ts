import {
  EventObject,
  MarkAllImplementationsAsProvided,
  State,
  StateSchema,
  TypegenDisabled,
  Typestate,
} from "xstate";

export interface StateStorage<
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  },
  TResolvedTypesMeta = TypegenDisabled
> {
  get: (
    key: string
  ) => Promise<State<
    TContext,
    TEvent,
    TStateSchema,
    TTypestate,
    MarkAllImplementationsAsProvided<TResolvedTypesMeta>
  > | null>;
  set: (
    key: string,
    value: State<
      TContext,
      TEvent,
      TStateSchema,
      TTypestate,
      MarkAllImplementationsAsProvided<TResolvedTypesMeta>
    >
  ) => Promise<void>;
  cleanUp: (key: string) => Promise<void>;
}

export function createDynamoDbStateStorage(): StateStorage<
  any,
  any,
  any,
  any,
  any
> {}
