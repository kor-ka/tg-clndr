import { MongoClient, Db } from "mongodb";

// Connection URL
const url = process.env.MONGODB_URI!;

// Database Name
const dbName = "tg-clndr";

export const MDBClient = new MongoClient(url, { minPoolSize: 100 });

export let MDB: Db;

let connect = (resolve: (db: Db) => void) => {
  MDBClient.connect((error) => {
    console.warn("[MDB]", "connect", url);
    if (error) {
      console.warn("[MDB]", error);
      setTimeout(() => connect(resolve), 500);
    } else {
      console.warn("[MDB]", "inited");
      resolve(MDBClient.db(dbName));
    }
  });
};

let mdbPromise: Promise<void> | undefined;

export const initMDB = () => {
  if (!mdbPromise) {
    mdbPromise = _initMDB();
  }
  return mdbPromise;
};

const _initMDB = async () => {

  try {
    MDB = await new Promise<Db>((resolve) => {
      connect(resolve);
    });

    await MDB.collection("latest_events").createIndex(
      { chatId: 1, threadId: 1 },
      {
        name: "latest_events:chatUnique",
        unique: true,
      }
    );

    await MDB.collection("events").createIndex(
      { chatId: 1, threadId: 1, idempotencyKey: 1 },
      {
        name: "events:idempotencyUnique",
        unique: true,
      }
    );

    await MDB.collection("users").createIndex(
      { id: 1 },
      {
        name: "users:unique",
        unique: true,
      }
    );

    await MDB.collection("settings").createIndex(
      { chatId: 1 },
      {
        name: "chat_meta:unique",
        unique: true,
      }
    );

    await MDB.collection("notifications").createIndex(
      { userId: 1, eventId: 1 },
      {
        name: "notifications:unique",
        unique: true,
      }
    );

    await MDB.collection("notifications").createIndex(
      { sent: 1, time: 1 },
      {
        name: "notifications:time",
      }
    );

    await MDB.collection("stats").createIndex(
      { type: 1 },
      {
        name: "stats:type",
      }
    );

    await MDB.collection("stats").createIndex(
      { start: 1 },
      {
        name: "stats:ws_session:start",
        partialFilterExpression: { type: 'ws_session' }
      },
    );

  } catch (e) {
    console.error(e)
    throw (e)
  }

};
