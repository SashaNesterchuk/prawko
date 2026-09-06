import { hideModalAndWait } from "../hide-modal-and-wait";

describe("hideModalAndWait", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves immediately when the modal is not visible", async () => {
    const hide = jest.fn();
    const resolverRef = { current: null as (() => void) | null };

    await expect(hideModalAndWait(hide, resolverRef, false)).resolves.toBeUndefined();
    expect(hide).not.toHaveBeenCalled();
  });

  it("hides then resolves on onDismiss", async () => {
    const hide = jest.fn();
    const resolverRef = { current: null as (() => void) | null };

    const promise = hideModalAndWait(hide, resolverRef, true);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(resolverRef.current).toEqual(expect.any(Function));

    resolverRef.current?.();
    await expect(promise).resolves.toBeUndefined();
    expect(resolverRef.current).toBeNull();
  });

  it("resolves via fallback if onDismiss never fires", async () => {
    const hide = jest.fn();
    const resolverRef = { current: null as (() => void) | null };

    const promise = hideModalAndWait(hide, resolverRef, true);
    await jest.advanceTimersByTimeAsync(450);
    await expect(promise).resolves.toBeUndefined();
  });
});
