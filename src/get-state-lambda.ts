import { createDynamoDbStateStorage } from "./stateStorage";

// TODO: type this
type Event = any;

export async function handler(event: Event) {
  const stateStorage = createDynamoDbStateStorage();
  const machineId = getMachineIdFromEvent(event);

  const state = await stateStorage.get(machineId);

  if (!state) {
    return {
      status: 404,
      body: "No state found",
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(state),
  };
}

function getMachineIdFromEvent(event: Event): string {}
