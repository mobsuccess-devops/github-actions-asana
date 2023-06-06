const core = require("@actions/core");
const action = require("./action");

async function run() {
  try {
    await action.action();
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

run();
