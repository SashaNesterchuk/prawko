import {
  areNotificationsAllowed,
  IOS_PROVISIONAL_AUTHORIZATION_STATUS,
} from "../permission";

describe("areNotificationsAllowed", () => {
  it("accepts granted root status", () => {
    expect(
      areNotificationsAllowed({
        status: "granted",
        granted: true,
      }),
    ).toBe(true);
  });

  it("accepts provisional iOS authorization", () => {
    expect(
      areNotificationsAllowed({
        status: "undetermined",
        granted: false,
        ios: {
          status: IOS_PROVISIONAL_AUTHORIZATION_STATUS,
        },
      }),
    ).toBe(true);
  });

  it("rejects denied status", () => {
    expect(
      areNotificationsAllowed({
        status: "denied",
        granted: false,
      }),
    ).toBe(false);
  });
});
