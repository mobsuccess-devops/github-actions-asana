const { buildClient } = require("../asana");
const core = require("@actions/core");

async function getAsanaClient() {
  const ASANA_PAT = core.getInput("asana-pat", { required: true });
  const client = await buildClient(ASANA_PAT);
  if (client === null) {
    throw new Error("client authorization failed");
  }
  return client;
}

exports.updateAsanaTask = async function updateAsanaTask(taskId, data) {
  const client = await getAsanaClient();
  await client.tasks.updateTask(taskId, data);
};
