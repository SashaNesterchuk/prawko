import { createIdentityObservationTracker } from "../identity-observation";

describe("install/account link observations", () => {
  it("observes guest, A, unlink and B without conflating switch with access transfer", () => {
    const observe = createIdentityObservationTracker();
    const track = jest.fn();
    observe(track, "usr_install", null);
    observe(track, "usr_install", "account-A");
    observe(track, "usr_install", "account-A");
    observe(track, "usr_install", null);
    observe(track, "usr_install", "account-B");
    expect(track.mock.calls.map(([, props]) => props.identity_observation_reason)).toEqual([
      "initial", "account_link", "account_unlink", "account_link",
    ]);
    expect(track.mock.calls.every(([, props]) => props.app_user_id === "usr_install" &&
      props.identity_scope === "install" && props.identity_link_version === 1)).toBe(true);
  });

  it("records a direct A to B switch with explicit previous/current accounts", () => {
    const observe = createIdentityObservationTracker();
    const track = jest.fn();
    observe(track, "usr_install", "account-A");
    observe(track, "usr_install", "account-B");
    expect(track.mock.calls[1][1]).toMatchObject({
      identity_observation_reason: "account_switch",
      previous_supabase_user_id: "account-A", supabase_user_id: "account-B",
    });
  });

  it("does not treat two installations of one account as one install", () => {
    const observe = createIdentityObservationTracker();
    const track = jest.fn();
    observe(track, "usr_first", "account-A");
    observe(track, "usr_second", "account-A");
    expect(track.mock.calls[1][1]).toMatchObject({
      app_user_id: "usr_second", identity_observation_reason: "initial", previous_supabase_user_id: null,
    });
  });
});
