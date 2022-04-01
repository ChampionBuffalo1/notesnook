import Database from "../../index";
import { NodeStorageInterface } from "../../../__mocks__/node-storage.mock";
import FS from "../../../__mocks__/fs.mock";
import { EV, EVENTS } from "../../../common";
import EventSource from "eventsource";
import { delay } from "../../../__tests__/utils";

test.skip(
  "case 1: device A & B should only download the changes from device C (no uploading)",
  async () => {
    const types = [];
    function onSyncProgress({ type }) {
      types.push(type);
    }

    const deviceA = await initializeDevice("deviceA");
    const deviceB = await initializeDevice("deviceB");

    deviceA.eventManager.subscribe(EVENTS.syncProgress, onSyncProgress);
    deviceB.eventManager.subscribe(EVENTS.syncProgress, onSyncProgress);

    const deviceC = await initializeDevice("deviceC");

    await deviceC.notes.add({ title: "new note 1" });
    await syncAndWait(deviceC, deviceC);

    expect(types.every((t) => t === "download")).toBe(true);

    await cleanup(deviceA, deviceB, deviceC);
  },
  600 * 1000
);

test.skip(
  "case 3: Device A & B have unsynced changes but server has nothing",
  async () => {
    const deviceA = await initializeDevice("deviceA");
    const deviceB = await initializeDevice("deviceB");

    const note1Id = await deviceA.notes.add({
      title: "Test note from device A",
    });
    const note2Id = await deviceB.notes.add({
      title: "Test note from device B",
    });

    await syncAndWait(deviceA, deviceB);

    expect(deviceA.notes.note(note2Id)).toBeTruthy();
    expect(deviceB.notes.note(note1Id)).toBeTruthy();
    expect(deviceA.notes.note(note1Id)).toBeTruthy();
    expect(deviceB.notes.note(note2Id)).toBeTruthy();

    await cleanup(deviceA, deviceA);
  },
  30 * 1000
);

test.skip(
  "case 4: Device A's sync is interrupted halfway and Device B makes some changes afterwards and syncs.",
  async () => {
    const deviceA = await initializeDevice("deviceA");
    const deviceB = await initializeDevice("deviceB");

    const unsyncedNoteIds = [];
    for (let i = 0; i < 10; ++i) {
      const id = await deviceA.notes.add({
        title: `Test note ${i} from device A`,
      });
      unsyncedNoteIds.push(id);
    }

    const half = unsyncedNoteIds.length / 2 + 1;
    deviceA.eventManager.subscribe(
      EVENTS.syncProgress,
      async ({ type, current }) => {
        if (type === "upload" && current === half) {
          await deviceA.syncer.stop();
        }
      }
    );

    await expect(deviceA.sync(true)).rejects.toThrow();

    let syncedNoteIds = [];
    for (let i = 0; i < unsyncedNoteIds.length; ++i) {
      const expectedNoteId = unsyncedNoteIds[i];
      if (deviceB.notes.note(expectedNoteId))
        syncedNoteIds.push(expectedNoteId);
    }
    expect(
      syncedNoteIds.length === half - 1 || syncedNoteIds.length === half
    ).toBe(true);

    const deviceBNoteId = await deviceB.notes.add({
      title: "Test note of case 4 from device B",
    });

    await deviceB.sync(true);

    await syncAndWait(deviceA, deviceB);

    expect(deviceA.notes.note(deviceBNoteId)).toBeTruthy();
    expect(
      unsyncedNoteIds
        .map((id) => !!deviceB.notes.note(id))
        .every((res) => res === true)
    ).toBe(true);

    await cleanup(deviceA, deviceB);
  },
  60 * 1000
);

test.skip(
  "case 5: Device A's sync is interrupted halfway and Device B makes changes on the same note's content that didn't get synced on Device A due to interruption.",
  async () => {
    const deviceA = await initializeDevice("deviceA");
    const deviceB = await initializeDevice("deviceB");

    const noteIds = [];
    for (let i = 0; i < 10; ++i) {
      const id = await deviceA.notes.add({
        content: {
          type: "tiny",
          data: `<p>deviceA=true</p>`,
        },
      });
      noteIds.push(id);
    }

    await deviceA.sync(true);
    await deviceB.sync(true);

    const unsyncedNoteIds = [];
    for (let id of noteIds) {
      const noteId = await deviceA.notes.add({
        id,
        content: {
          type: "tiny",
          data: `<p>deviceA=true+changed=true</p>`,
        },
      });
      unsyncedNoteIds.push(noteId);
    }

    deviceA.eventManager.subscribe(
      EVENTS.syncProgress,
      async ({ type, total, current }) => {
        const half = total / 2 + 1;
        if (type === "upload" && current === half) {
          await deviceA.syncer.stop();
        }
      }
    );

    await expect(deviceA.sync(true)).rejects.toThrow();

    await delay(10 * 1000);

    for (let id of unsyncedNoteIds) {
      await deviceB.notes.add({
        id,
        content: {
          type: "tiny",
          data: "<p>changes from device B</p>",
        },
      });
    }

    const error = await withError(async () => {
      await deviceB.sync(true);
      await deviceA.sync(true);
    });

    expect(error).not.toBeInstanceOf(NoErrorThrownError);
    expect(error.message.includes("Merge")).toBeTruthy();

    await cleanup(deviceA, deviceB);
  },
  60 * 1000
);

test.skip(
  "issue: running force sync from device A makes device B always download everything",
  async () => {
    const deviceA = await initializeDevice("deviceA");
    const deviceB = await initializeDevice("deviceB");

    await syncAndWait(deviceA, deviceB, true);

    const handler = jest.fn();
    deviceB.eventManager.subscribe(EVENTS.syncProgress, handler);

    await deviceB.sync(true);

    expect(handler).not.toHaveBeenCalled();

    await cleanup(deviceB);
  },
  60 * 1000
);

/**
 *
 * @param {string} id
 * @returns {Promise<Database>}
 */
async function initializeDevice(id, isUserPremium = false) {
  EV.subscribe(EVENTS.userCheckStatus, async (type) => ({
    type,
    result: isUserPremium,
  }));

  const device = new Database(new NodeStorageInterface(), EventSource, FS);
  device.host({
    API_HOST: "http://192.168.10.29:5264",
    AUTH_HOST: "http://192.168.10.29:8264",
    SSE_HOST: "http://192.168.10.29:7264",
    ISSUES_HOST: "http://192.168.10.29:2624",
    SUBSCRIPTIONS_HOST: "http://192.168.10.29:9264",
  });

  device.eventManager.subscribe(
    EVENTS.databaseSyncRequested,
    async (full, force) => {
      await device.sync(full, force);
    }
  );

  await device.init(id);
  await device.user.login("enkaboot@gmail.com", "Allatonce1.1");

  await waitForSyncCompleted(device);
  return device;
}

async function cleanup(...devices) {
  for (let device of devices) {
    await device.user.logout();
    device.eventManager.unsubscribeAll();
  }
  EV.unsubscribeAll();
}

/**
 *
 * @param {Database} device
 * @returns
 */
function waitForSyncCompleted(device) {
  return new Promise((resolve) =>
    device.eventManager.subscribe(EVENTS.syncCompleted, () => resolve())
  );
}

/**
 *
 * @param {Database} deviceA
 * @param {Database} deviceB
 * @returns
 */
function syncAndWait(deviceA, deviceB, force = false) {
  return new Promise((resolve) => {
    const ref = deviceB.eventManager.subscribe(EVENTS.syncCompleted, () => {
      ref.unsubscribe();
      resolve();
    });
    deviceA.sync(true, force);
  });
}

class NoErrorThrownError extends Error {}

/**
 *
 * @param {Function} call
 * @returns {Promise<Error>}
 */
async function withError(call) {
  try {
    await call();

    throw new NoErrorThrownError();
  } catch (error) {
    return error;
  }
}
