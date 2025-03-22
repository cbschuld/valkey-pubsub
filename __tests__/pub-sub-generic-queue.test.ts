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

describe("PubSubGenericQueue", () => {
  let queue: PubSubGenericQueue<string>;

  beforeEach(() => {
    queue = new PubSubGenericQueue<string>();
  });

  test("push adds items and notifies listeners", () => {
    const listener = jest.fn();
    queue.onItem(listener);

    queue.push("test1");
    queue.push("test2");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith("test1");
    expect(listener).toHaveBeenCalledWith("test2");
  });

  test("isEmpty returns correct with listener consuming", () => {
    const listener = jest.fn();
    queue.onItem(listener);
    expect(queue.isEmpty()).toBe(true);
    queue.push("test");
    queue.push("test");
    queue.push("test");
    // all three message should have been eaten by the listeners and the queue does not care
    expect(queue.isEmpty()).toBe(true); //
  });

  test("isEmpty returns correct with no listener consuming", () => {
    expect(queue.isEmpty()).toBe(true);
    queue.push("test");
    queue.push("test");
    queue.push("test");
    expect(queue.isEmpty()).toBe(false); //
  });

  test("size returns correct count - (with backpressure)", () => {
    expect(queue.size()).toBe(0);
    queue.push("test");
    queue.push("test");
    queue.push("test");
    queue.push("test");
    expect(queue.size()).toBe(4);
  });

  test("size returns correct count - (no backpressure)", () => {
    const listener = jest.fn();
    queue.onItem(listener);
    expect(queue.size()).toBe(0);
    queue.push("test");
    queue.push("test");
    queue.push("test");
    queue.push("test");
    expect(queue.size()).toBe(0);
  });

  test("destroy cleans up properly", async () => {
    const closeFn = jest.fn();
    queue.close = [closeFn];
    await queue.destroy();

    expect(closeFn).toHaveBeenCalled();
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });
});
