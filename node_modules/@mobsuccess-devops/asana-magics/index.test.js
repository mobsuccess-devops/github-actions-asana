it("exposes magics", () => {
  const magics = require("./index");
  expect(typeof magics).toBe("object");
  expect(typeof magics.customFields.live.gid).toBe("string");
});
