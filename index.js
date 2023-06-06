const core = require("@actions/core");
const action = require("./action");

async function run() {
  try {
    await action.action();
  } catch (error) {
    console.error(error);
    if (error.message.includes("Resource not accessible by integration")) {
      console.info(
        `⚠️💡👉 This error might be due to the Github repository settings: make sure that the checkbox "Read and write permissions" is checked here under "Workflows": 
        https://github.com/mobsuccess-devops/${
          process.env.GITHUB_REPOSITORY.split("/")[1]
        }/settings/actions`
      );
    }
    core.setFailed(error.message);
  }
}

run();
