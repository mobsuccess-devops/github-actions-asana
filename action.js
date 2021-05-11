const core = require("@actions/core");
const github = require("@actions/github");
const getOctokit = require("./lib/actions/octokit");
const { updateAsanaTask } = require("./lib/actions/asana");

const customFieldPR = require("./lib/asana/custom-fields/asana-pr");
const customFieldPRStatus = require("./lib/asana/custom-fields/asana-pr-status");

exports.getPullReviewStatuses = async function getPullReviewStatuses({
  pullRequest,
}) {
  const octokit = getOctokit();
  const { data: reviews } = await octokit.pulls.listReviews({
    ...github.context.repo,
    pull_number: pullRequest.number,
  });

  reviews.sort(({ submitted_at: a }, { submitted_at: b }) => {
    return -a.localeCompare(b);
  });
  console.log("Sorted Reviews", JSON.stringify(reviews, undefined, 4));

  const stateByUserId = reviews
    .filter(
      ({ state }) => ["APPROVED", "CHANGES_REQUESTED"].indexOf(state) >= 0
    )
    .reduce(
      (s, { user: { id: userId }, state }) => ({ [userId]: state, ...s }),
      {}
    );
  console.log("State by user ID", stateByUserId);

  return Object.entries(stateByUserId).reduce(
    (s, [, state]) => ({
      ...s,
      ...(state === "APPROVED" ? { isApproved: true } : {}),
      ...(state === "CHANGES_REQUESTED" ? { isRejected: true } : {}),
    }),
    {}
  );
};

exports.getPullIsMerged = async function getPullIsMerged({ pullRequest }) {
  const { merged_at: mergedAt } = pullRequest;
  return !!mergedAt;
};

exports.getPullIsDraft = async function getPullIsDraft({ pullRequest }) {
  const { draft } = pullRequest;
  return !!draft;
};

exports.getAsanaPRStatus = async function getAsanaPRStatus({ pullRequest }) {
  const { isApproved, isRejected } = await exports.getPullReviewStatuses({
    pullRequest,
  });
  const numberOfRequestedReviewers = (pullRequest.requested_reviewers || [])
    .length;
  const isMerged = await exports.getPullIsMerged({ pullRequest });
  const isDraft = await exports.getPullIsDraft({ pullRequest });

  console.log("Asana status", {
    isApproved,
    isRejected,
    isMerged,
    numberOfRequestedReviewers,
    isDraft,
  });

  if (isMerged) {
    return customFieldPRStatus.values.merged;
  } else if (isDraft) {
    return customFieldPRStatus.values.inProgress;
  } else if (isRejected) {
    return customFieldPRStatus.values.rejected;
  } else if (numberOfRequestedReviewers) {
    return customFieldPRStatus.values.inReview;
  } else if (isApproved) {
    return customFieldPRStatus.values.approved;
  } else {
    return customFieldPRStatus.values.inProgress;
  }
};

exports.findAsanaTaskId = function findAsanaTaskId({
  triggerPhrase,
  pullRequest,
}) {
  const { body } = pullRequest;
  const regexString = `${triggerPhrase}(?:\\s*)https:\\/\\/app.asana.com\\/(\\d+)\\/(?<project>\\d+)\\/(?<task>\\d+)`;
  const regex = new RegExp(regexString, "gi");

  console.info("looking in body", body, "regex", regexString);
  let foundAsanaTasks = [];
  let parseAsanaURL;
  while ((parseAsanaURL = regex.exec(body)) !== null) {
    const taskId = parseAsanaURL.groups.task;
    foundAsanaTasks.push(taskId);
  }
  console.info(
    `found ${foundAsanaTasks.length} taskIds:`,
    foundAsanaTasks.join(",")
  );
  return foundAsanaTasks.shift();
};

exports.getActionParameters = function getActionParameters() {
  const pullRequest = github.context.payload.pull_request;
  const action = core.getInput("action", { required: true });
  const triggerPhrase = core.getInput("trigger-phrase") || "";
  return { pullRequest, action, triggerPhrase };
};

exports.action = async function action() {
  const { pullRequest, action, triggerPhrase } = exports.getActionParameters();
  const taskId = exports.findAsanaTaskId({ triggerPhrase, pullRequest });

  const asanaPRStatus = await exports.getAsanaPRStatus({
    pullRequest,
  });
  console.log("asanaPRStatus", asanaPRStatus);

  console.info(`Calling action ${action}`);
  switch (action) {
    case "debug":
      console.log(
        "payload",
        JSON.stringify(github.context.payload, undefined, 4)
      );
      break;
    case "synchronize": {
      if (!taskId) {
        console.log("Cannot update Asana task: no taskId was found");
      } else {
        console.log(`Updating Asana task: ${taskId}`);
        await updateAsanaTask(taskId, {
          custom_fields: {
            [customFieldPR.gid]: pullRequest.html_url,
            [customFieldPRStatus.gid]: asanaPRStatus,
          },
        });
      }
      break;
    }
  }
};
