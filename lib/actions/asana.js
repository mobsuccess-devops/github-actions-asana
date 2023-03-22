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

const retryExponential = async (fn, maxRetries = 5, current = 1) => {
  try {
    return await fn();
  } catch (err) {
    if (current > maxRetries) {
      throw err;
    }
    console.log("Invalid Request", err);
    const waitingTime = 2 * current;
    console.log("Retry in", waitingTime, "s");
    await new Promise((resolve) => setTimeout(resolve, waitingTime * 1000));
    return retryExponential(fn, maxRetries, current + 1);
  }
};

exports.updateAsanaTask = async function updateAsanaTask(taskId, data) {
  const client = await getAsanaClient();
  await retryExponential(async () => {
    await client.tasks.updateTask(taskId, data);
  });
};

exports.getTask = async function getTask(taskId, opts) {
  const client = await getAsanaClient();
  return await client.tasks.getTask(taskId, opts);
};

exports.moveTaskToProjectSection = async function moveTaskToProjectSection({
  taskId,
  projectId,
  sectionId,
}) {
  const client = await getAsanaClient();
  await retryExponential(async () => {
    await client.tasks.addProjectForTask(taskId, {
      project: projectId,
      section: sectionId,
    });
  });
};

exports.getProjectSections = async function getProjectSections({ projectId }) {
  const client = await getAsanaClient();
  return (await client.sections.getSectionsForProject(projectId)).data;
};
