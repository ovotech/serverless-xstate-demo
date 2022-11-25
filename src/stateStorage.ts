import { DynamoDB } from "aws-sdk";
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

export function createDynamoDbStateStorage(
  tableName: string,
  ddbClient: DynamoDB.DocumentClient
): StateStorage<any, any, any, any, any> {
  return {
    async get(key) {
      const result = await ddbClient
        .get({
          TableName: tableName,
          Key: {
            machineId: key,
          },
        })
        .promise();

      if (!result.Item) {
        return null;
      }

      return JSON.parse(result.Item.state);
    },

    async set(key, value) {
      await ddbClient
        .put({
          TableName: tableName,
          Item: {
            machineId: key,
            state: JSON.stringify(value),
          },
        })
        .promise();
    },

    async cleanUp(key) {
      await ddbClient
        .delete({
          TableName: tableName,
          Key: {
            machineId: key,
          },
        })
        .promise();
    },
  };
}
