import { signTestAnalytics } from "../sign-test-entry";

describe("sign test analytics", () => {
  it("names the catalog test and a category test separately", () => {
    expect(signTestAnalytics({ entry: "signs_home" })).toEqual({
      category_id: null,
      sign_test_entry: "signs_home",
    });
    expect(
      signTestAnalytics({ categoryId: "E", entry: "category" })
    ).toEqual({
      category_id: "E",
      sign_test_entry: "category",
    });
  });
});
