import { createMachine, actions } from "xstate";
import { createInterpreter } from "./interpreter";
import { createDynamoDbStateStorage } from "./stateStorage";
import type { SQSEvent, SQSRecord } from "aws-lambda";
import { DynamoDB } from "aws-sdk";

export async function handler(event: SQSEvent) {
  console.log("Received event", event);
  const record = event.Records[0];
  if (!record || event.Records.length > 1) {
    throw new Error("Expected exactly one record");
  }

  const machineId = getMachineIdFromRecord(record);
  const payload = getXStateEventPayloadFromRecord(record);

  console.log("machine id", machineId);
  console.log("payload", payload);

  const stateStorage = createDynamoDbStateStorage(
    process.env.DYNAMO_TABLE!,
    new DynamoDB.DocumentClient()
  );

  const intepreter = createInterpreter(machineId, countMachine, stateStorage);

  const state = await intepreter.settleMachine(payload);

  await stateStorage.set(machineId, state);

  return {
    status: 200,
    body: "OK",
  };
}

function getMachineIdFromRecord(record: SQSRecord): string {
  const id = record.attributes.MessageGroupId;

  if (!id) {
    throw new Error("Expected record to have a MessageGroupId");
  }

  return id;
}

function getXStateEventPayloadFromRecord(record: SQSRecord): any {
  const body = record.body;

  if (!body) {
    throw new Error("Expected record to have a body");
  }

  return JSON.parse(body);
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

const countMachine = createMachine({
  initial: "idle",
  context: {
    count: 0,
  },
  states: {
    idle: {
      on: {
        COUNT: "even",
      },
    },
    even: {
      on: {
        COUNT: "counting_even",
      },
      meta: {
        settled: true,
      },
    },
    counting_even: {
      invoke: {
        src: () => wait(1000),
        onDone: {
          target: "odd",
          actions: actions.assign({ count: (ctx) => (ctx as any).count + 1 }),
        },
      },
    },
    odd: {
      invoke: {
        src: () => wait(1000),
        onDone: {
          target: "even",
          actions: actions.assign({ count: (ctx) => (ctx as any).count + 1 }),
        },
      },
    },
  },
});
