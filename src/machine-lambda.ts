import { createMachine, actions } from "xstate";
import { createInterpreter } from "./interpreter";
import { createDynamoDbStateStorage } from "./stateStorage";

// TODO: type this
type Event = any;

export async function handler(event: Event) {
  const machineId = getMachineIdFromEvent(event);
  const payload = getXStateEventPayloadFromEvent(event);
  const stateStorage = createDynamoDbStateStorage();

  const intepreter = createInterpreter(machineId, countMachine, stateStorage);

  const state = await intepreter.settleMachine(payload);

  await stateStorage.set(machineId, state);

  return {
    status: 200,
    body: "OK",
  };
}

function getMachineIdFromEvent(event: Event): string {}
function getXStateEventPayloadFromEvent(event: Event): any {}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

const countMachine = createMachine({
  id: "count",
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
      tags: ["resolve"],
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
