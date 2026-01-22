/**
 * Example: Server Module Template
 *
 * This template shows the standard pattern for creating a new server-side module.
 * All server modules follow this structure for consistency.
 *
 * Key Patterns:
 * - @singleton decorator for dependency injection
 * - container.resolve() for dependencies
 * - MongoDB transactions for data consistency
 * - Subject pattern for pub/sub
 * - Error handling with try/catch
 */

import { singleton } from "tsyringe";
import { container } from "tsyringe";
import { MDBClient } from "../../utils/MDB";
import { Subject } from "../../utils/subject";
import { ObjectId, WithId } from "mongodb";

/**
 * MongoDB Collection Setup
 * Define in a separate file: <moduleName>Store.ts
 */

// Store file: /server/src/modules/exampleModule/exampleStore.ts
export interface ExampleData {
  _id?: ObjectId;
  chatId: number;
  threadId: number | undefined;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  seq: number;  // For optimistic concurrency control
  deleted?: boolean;  // Soft delete flag
}

export type SavedExample = WithId<ExampleData>;

// MongoDB collection accessor
export const EXAMPLES = () =>
  MDBClient.db("tg-clndr").collection<ExampleData>("examples");

// Create indexes immediately (runs once on server start)
EXAMPLES().createIndex({ chatId: 1, threadId: 1 });
EXAMPLES().createIndex({ chatId: 1, createdAt: -1 });
EXAMPLES().createIndex({ deleted: 1 });

/**
 * Module Implementation
 * Module file: /server/src/modules/exampleModule/ExampleModule.ts
 */
@singleton()
export class ExampleModule {
  // Dependency injection
  private otherModule = container.resolve(OtherModule);

  // MongoDB collection
  private examples = EXAMPLES();

  // Pub/sub for broadcasting updates
  readonly updateSubject = new Subject<{
    chatId: number;
    threadId: number | undefined;
    example: SavedExample;
    type: 'create' | 'update' | 'delete';
  }>();

  /**
   * Create a new example
   * Pattern: Transaction with optimistic concurrency
   */
  createExample = async (
    chatId: number,
    threadId: number | undefined,
    data: Partial<ExampleData>
  ): Promise<SavedExample> => {
    const session = MDBClient.startSession();
    let _id: ObjectId;

    try {
      await session.withTransaction(async () => {
        // Insert with initial sequence number
        const result = await this.examples.insertOne(
          {
            ...data,
            chatId,
            threadId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            seq: 0,
            deleted: false,
          } as ExampleData,
          { session }
        );
        _id = result.insertedId;

        // Other transactional operations
        await this.otherModule.onExampleCreated(_id, session);
      });
    } finally {
      await session.endSession();
    }

    // Fetch created document
    const created = await this.examples.findOne({ _id });
    if (!created) {
      throw new Error("Example lost during creation");
    }

    // Broadcast update (non-blocking)
    this.updateSubject.next({
      chatId,
      threadId,
      example: created,
      type: 'create',
    });

    return created;
  };

  /**
   * Update an existing example
   * Pattern: Optimistic concurrency control with sequence numbers
   */
  updateExample = async (
    id: string,
    updates: Partial<ExampleData>
  ): Promise<SavedExample> => {
    const _id = new ObjectId(id);
    const session = MDBClient.startSession();
    let updated: SavedExample | null = null;

    try {
      await session.withTransaction(async () => {
        // Read current version
        const current = await this.examples.findOne(
          { _id, deleted: { $ne: true } },
          { session }
        );

        if (!current) {
          throw new Error("Example not found");
        }

        // Update with sequence check
        const result = await this.examples.findOneAndUpdate(
          { _id, seq: current.seq },  // Only update if seq matches
          {
            $set: { ...updates, updatedAt: Date.now() },
            $inc: { seq: 1 },  // Increment sequence
          },
          { returnDocument: 'after', session }
        );

        if (!result.value) {
          throw new Error("Example was modified by another operation");
        }

        updated = result.value;

        // Other transactional operations
        await this.otherModule.onExampleUpdated(_id, session);
      });
    } finally {
      await session.endSession();
    }

    if (!updated) {
      throw new Error("Update failed");
    }

    // Broadcast update
    this.updateSubject.next({
      chatId: updated.chatId,
      threadId: updated.threadId,
      example: updated,
      type: 'update',
    });

    return updated;
  };

  /**
   * Delete an example (soft delete)
   * Pattern: Never hard-delete user data
   */
  deleteExample = async (id: string): Promise<SavedExample> => {
    const _id = new ObjectId(id);
    const session = MDBClient.startSession();
    let deleted: SavedExample | null = null;

    try {
      await session.withTransaction(async () => {
        // Check if already deleted
        const current = await this.examples.findOne({ _id }, { session });
        if (!current) {
          throw new Error("Example not found");
        }
        if (current.deleted) {
          // Already deleted, just return it
          deleted = current;
          return;
        }

        // Soft delete
        const result = await this.examples.findOneAndUpdate(
          { _id },
          {
            $set: { deleted: true, updatedAt: Date.now() },
            $inc: { seq: 1 },
          },
          { returnDocument: 'after', session }
        );

        deleted = result.value!;

        // Cascade delete to related data
        await this.otherModule.onExampleDeleted(_id, session);
      });
    } finally {
      await session.endSession();
    }

    if (!deleted) {
      throw new Error("Delete failed");
    }

    // Broadcast delete
    this.updateSubject.next({
      chatId: deleted.chatId,
      threadId: deleted.threadId,
      example: deleted,
      type: 'delete',
    });

    return deleted;
  };

  /**
   * Query examples for a chat
   * Pattern: Exclude deleted, use indexes, limit results
   */
  getExamples = async (
    chatId: number,
    threadId: number | undefined,
    limit = 100
  ): Promise<SavedExample[]> => {
    return await this.examples
      .find(
        {
          chatId,
          threadId,
          deleted: { $ne: true },  // Exclude soft-deleted
        },
        {
          limit,
          sort: { createdAt: -1 },  // Most recent first
        }
      )
      .toArray();
  };

  /**
   * Get single example by ID
   */
  getExample = async (id: string): Promise<SavedExample> => {
    const example = await this.examples.findOne({ _id: new ObjectId(id) });
    if (!example) {
      throw new Error("Example not found");
    }
    return example;
  };

  /**
   * Get examples in date range
   * Pattern: Range queries for calendar/timeline features
   */
  getExamplesInRange = async (
    chatId: number,
    threadId: number | undefined,
    from: number,
    to: number
  ): Promise<SavedExample[]> => {
    return await this.examples
      .find({
        chatId,
        threadId,
        createdAt: { $gte: from, $lt: to },
        deleted: { $ne: true },
      })
      .toArray();
  };

  /**
   * Cached query with fallback
   * Pattern: In-memory caching with expiration
   */
  private cache = new Map<string, { data: SavedExample[]; expires: number }>();

  getExamplesCached = async (
    chatId: number,
    threadId: number | undefined
  ): Promise<SavedExample[]> => {
    const cacheKey = `${chatId}-${threadId}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expires > now) {
      // Return cached data
      return cached.data;
    }

    // Fetch fresh data
    const data = await this.getExamples(chatId, threadId);

    // Cache for 5 minutes
    this.cache.set(cacheKey, {
      data,
      expires: now + 5 * 60 * 1000,
    });

    return data;
  };

  /**
   * Clear cache on updates
   */
  private clearCache(chatId: number, threadId: number | undefined) {
    const cacheKey = `${chatId}-${threadId}`;
    this.cache.delete(cacheKey);
  }
}

/**
 * Integration with Socket.io
 * In /server/src/api/ClientAPI.ts
 */
const exampleModule = container.resolve(ExampleModule);

// Subscribe to updates and broadcast to clients
exampleModule.updateSubject.subscribe((update) => {
  const { chatId, threadId, example, type } = update;

  // Broadcast to all clients in the same chat
  io.to(`chat:${chatId}:${threadId ?? 'main'}`).emit("example_update", {
    example,
    type,
  });
});

// Handle client commands
socket.on("create_example", async (data: Partial<ExampleData>, ack) => {
  try {
    const created = await exampleModule.createExample(
      chatId,
      threadId,
      data
    );
    ack({ example: created });
  } catch (error) {
    ack({ error: error.message });
  }
});

/**
 * Best Practices Checklist:
 *
 * ✅ Use @singleton decorator for module lifecycle
 * ✅ Inject dependencies via container.resolve()
 * ✅ Use MongoDB transactions for multi-document operations
 * ✅ Always end session in finally block
 * ✅ Use optimistic concurrency control (seq field)
 * ✅ Soft delete instead of hard delete
 * ✅ Exclude deleted in queries ({ deleted: { $ne: true } })
 * ✅ Create indexes for all query filters
 * ✅ Use Subject pattern for pub/sub
 * ✅ Broadcast updates to Socket.io clients
 * ✅ Return descriptive error messages
 * ✅ Log errors with console.error
 * ✅ Use in-memory caching with expiration
 * ✅ Limit query results
 * ✅ Use types from shared/entity.ts
 */
