import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const HOUR_IN_MS = 1000 * 60 * 60;

async function migrateEndDate() {
  const url = process.env.MONGODB_URI;
  if (!url) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const dbName = "tg-clndr";
  const client = new MongoClient(url);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("Connected successfully");

    const db = client.db(dbName);
    const eventsCollection = db.collection("events");

    // Find all events that don't have an endDate field
    const eventsWithoutEndDate = await eventsCollection.countDocuments({
      endDate: { $exists: false },
    });

    console.log(`Found ${eventsWithoutEndDate} events without endDate field`);

    if (eventsWithoutEndDate === 0) {
      console.log("No events to migrate");
      return;
    }

    // Update all events without endDate to set endDate = date + 1 hour
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

    console.log(`Migration completed!`);
    console.log(`- Matched: ${result.matchedCount} events`);
    console.log(`- Modified: ${result.modifiedCount} events`);

    // Verify the migration
    const remainingWithoutEndDate = await eventsCollection.countDocuments({
      endDate: { $exists: false },
    });

    if (remainingWithoutEndDate > 0) {
      console.warn(
        `WARNING: ${remainingWithoutEndDate} events still don't have endDate!`
      );
    } else {
      console.log("✓ All events now have endDate field");
    }

    // Show a sample of migrated events
    console.log("\nSample of migrated events:");
    const samples = await eventsCollection
      .find({ endDate: { $exists: true } })
      .limit(3)
      .toArray();

    samples.forEach((event) => {
      const dateStr = new Date(event.date).toISOString();
      const endDateStr = new Date(event.endDate).toISOString();
      const duration = (event.endDate - event.date) / HOUR_IN_MS;
      console.log(
        `  - Event "${event.title}": ${dateStr} -> ${endDateStr} (${duration}h)`
      );
    });
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await client.close();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run the migration
migrateEndDate()
  .then(() => {
    console.log("\n✓ Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Migration script failed:", error);
    process.exit(1);
  });
