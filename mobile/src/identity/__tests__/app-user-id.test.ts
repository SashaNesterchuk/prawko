import { secureSessionStorage } from "../../lib/auth-storage";
import {
  APP_USER_ID_STORAGE_KEY,
  createAppUserId,
  getOrCreateAppUserId,
  peekCachedAppUserId,
  resetAppUserIdCacheForTests,
} from "../app-user-id";

jest.mock("../../lib/auth-storage", () => ({
  secureSessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const storage = secureSessionStorage as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

describe("app user id", () => {
  beforeEach(() => {
    resetAppUserIdCacheForTests();
    storage.getItem.mockReset();
    storage.setItem.mockReset();
  });

  it("creates a usr_ prefixed id", () => {
    expect(createAppUserId()).toMatch(
      /^usr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("reuses a stored install id", async () => {
    storage.getItem.mockResolvedValue("usr_existing");

    await expect(getOrCreateAppUserId()).resolves.toBe("usr_existing");
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(peekCachedAppUserId()).toBe("usr_existing");
  });

  it("persists a new install id on first launch", async () => {
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);

    const created = await getOrCreateAppUserId();

    expect(created.startsWith("usr_")).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(APP_USER_ID_STORAGE_KEY, created);
    await expect(getOrCreateAppUserId()).resolves.toBe(created);
  });

  it("dedupes concurrent first-launch reads", async () => {
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);

    const [first, second] = await Promise.all([
      getOrCreateAppUserId(),
      getOrCreateAppUserId(),
    ]);

    expect(first).toBe(second);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
