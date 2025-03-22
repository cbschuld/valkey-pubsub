import { ValkeyPubSub, PubSubGenericQueue } from "../src";
import { GlideClient, GlideClusterClient } from "@valkey/valkey-glide";

// Mock the Glide clients
jest.mock("@valkey/valkey-glide", () => ({
  GlideClient: {
    createClient: jest.fn(),
  },
  GlideClusterClient: {
    createClient: jest.fn(),
  },
  ProtocolVersion: {
    RESP3: "RESP3",
  },
}));

describe("ValkeyPubSub", () => {
  let pubsub: ValkeyPubSub;
  let mockClient: Partial<GlideClient>; // Use Partial<GlideClient> for flexibility

  beforeEach(async () => {
    mockClient = {
      publish: jest.fn().mockResolvedValue(1) as (
        message: any,
        channel: any
      ) => Promise<number>,
      getPubSubMessage: jest.fn(),
      close: jest.fn(),
    };

    (GlideClient.createClient as jest.Mock).mockResolvedValue(mockClient);
    (GlideClusterClient.createClient as jest.Mock).mockResolvedValue(
      mockClient
    );

    pubsub = await ValkeyPubSub.create({ clusterMode: false });
  });

  afterEach(() => {
    pubsub.cleanup();
    jest.clearAllMocks();
  });

  test("create initializes properly", async () => {
    expect(pubsub).toBeInstanceOf(ValkeyPubSub);
    expect(GlideClient.createClient).toHaveBeenCalled();
  });

  test("subscribe creates client and manages subscriptions", async () => {
    const queue = new PubSubGenericQueue<string>();
    await pubsub.subscribe("test-topic", queue);

    expect(GlideClient.createClient).toHaveBeenCalledTimes(2); // Once for publish, once for subscribe
    expect(pubsub["subscriptions"].has("test-topic")).toBe(true);
  });

  test("publish sends message successfully", async () => {
    const callback = jest.fn();
    await pubsub.publish(
      { topic: "test-topic", payload: { data: "test" } },
      callback
    );

    expect(mockClient.publish).toHaveBeenCalledWith(
      JSON.stringify({ data: "test" }),
      "test-topic"
    );
    expect(callback).toHaveBeenCalled();
  });

  test("cleanup closes all clients", () => {
    pubsub.cleanup();
    expect(mockClient.close).toHaveBeenCalled();
  });

  test("subscription test", async () => {
    const queue = new PubSubGenericQueue<string>();
    await pubsub.subscribe("test-topic", queue);

    const mockMessage = {
      topic: "test-topic",
      payload: Buffer.from("test-message"),
    };

    queue.onItem((message) => {
      expect(message).toBe("test-message");
    });

    pubsub.publish(mockMessage);
  });
});

declare module "@valkey/valkey-glide" {
  interface GlideClient {
    publish(message: any, channel: any): Promise<number>;
    getPubSubMessage: jest.Mock;
    close: jest.Mock;
  }
  interface GlideClusterClient {
    publish(message: any, channel: any): Promise<number>;
    getPubSubMessage: jest.Mock;
    close: jest.Mock;
  }
}
