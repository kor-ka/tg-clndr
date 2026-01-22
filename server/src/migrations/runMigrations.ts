import { MDB } from "../utils/MDB";

const HOUR_IN_MS = 1000 * 60 * 60;

/**
 * Run all pending database migrations
 * This function is called automatically on server startup
 */
export async function runMigrations() {
  console.log("\n=== Running database migrations ===");

  try {
    await migrateAddEndDate();
    console.log("=== All migrations completed successfully ===\n");
  } catch (error) {
    console.error("=== Migration failed ===");
    throw error;
  }
}

/**
 * Migration: Add endDate field to events and latest_events
 * TODO: Remove this migration after deployment is complete
 */
async function migrateAddEndDate() {
  const eventsCollection = MDB.collection("events");
  const latestEventsCollection = MDB.collection("latest_events");

  // === Migrate events collection ===
  const eventsWithoutEndDate = await eventsCollection.countDocuments({
    endDate: { $exists: false },
  });

  if (eventsWithoutEndDate > 0) {
    console.log(`Migrating ${eventsWithoutEndDate} events...`);

    const result = await eventsCollection.updateMany(
      { endDate: { $exists: false } },
      [
        {
          $set: {
            endDate: { $add: ["$date", HOUR_IN_MS] },
          },
        },
      ]
    );

    console.log(`✓ Migrated ${result.modifiedCount} events`);
  }

  // === Migrate latest_events collection ===
  const latestEventsWithoutEndDate = await latestEventsCollection.countDocuments(
    {
      endDate: { $exists: false },
    }
  );

  if (latestEventsWithoutEndDate > 0) {
    console.log(`Migrating ${latestEventsWithoutEndDate} latest_events...`);

    const latestResult = await latestEventsCollection.updateMany(
      { endDate: { $exists: false } },
      [
        {
          $set: {
            endDate: { $add: ["$date", HOUR_IN_MS] },
          },
        },
      ]
    );

    console.log(`✓ Migrated ${latestResult.modifiedCount} latest_events`);
  }

  if (eventsWithoutEndDate === 0 && latestEventsWithoutEndDate === 0) {
    console.log("✓ No migrations needed (endDate already present)");
  }
}
