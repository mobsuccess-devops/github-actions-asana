const core = require("@actions/core");
const github = require("@actions/github");
const getOctokit = require("./lib/actions/octokit");
const {
  updateAsanaTask,
  getTask,
  moveTaskToProjectSection,
} = require("./lib/actions/asana");

const customFieldPR = require("./lib/asana/custom-fields/asana-pr");
const customFieldPRStatus = require("./lib/asana/custom-fields/asana-pr-status");

const asanaSprintProjectId = "1200175269622723";
const asanaSprintSectionIds = {
  design: "1200175269622814",
  readyToDo: "1200175269622815",
  inProgress: "1200175269622840",
  toTest: "1200175269622816",
  ready: "1200175269622817",
};

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
  const numberOfRequestedReviewers = (
    pullRequest.requested_reviewers || []
  ).filter(({ login }) => login !== "ms-testers").length;
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

async function getTaksDestination({ taskId, pullRequest }) {
  const { draft, merged_at: mergedAt } = pullRequest;
  if (draft || !!mergedAt) {
    // do not move pulls in draft or already merged
    return;
  }
  const { requested_reviewers: requestedReviewers } = pullRequest;
  console.log("Requested reviewers:", requestedReviewers);

  if (requestedReviewers.some(({ login }) => login === "ms-testers")) {
    // user ms-testers has been requested a review
    // just to make sure, what is the current section of this task?
    const task = await getTask(taskId, {
      opt_fields: ["memberships", "completed"],
    });
    const { completed, memberships } = task;
    if (completed) {
      console.log(`Task ${taskId} is completed, not moving task`);
      return false;
    }

    const sprintProjectMembership = memberships.find(
      ({ project: { gid: projectId } }) => projectId === asanaSprintProjectId
    );
    if (!sprintProjectMembership) {
      console.log(
        `Task ${taskId} is not included in the current sprint, not moving task`
      );
      return false;
    }

    const {
      section: { gid: sprintSectionId },
    } = sprintProjectMembership;
    if (sprintSectionId === asanaSprintSectionIds.toTest) {
      console.log(
        `Task ${taskId} is already in the To Test section of the current sprint, not moving task`
      );
      return false;
    }
    if (sprintSectionId === asanaSprintSectionIds.ready) {
      console.log(
        `Task ${taskId} is in the Ready section of the current sprint, not moving task`
      );
      return false;
    }

    return asanaSprintSectionIds.toTest;
  } else {
    // user ms-testers is not currently requested
    // if the PR is still open and the task is in the section “to test”, move it back
    // to “in progress”
    const task = await getTask(taskId, {
      opt_fields: ["memberships", "completed"],
    });
    const { completed, memberships } = task;
    if (completed) {
      console.log(`Task ${taskId} is completed, not moving task`);
      return false;
    }

    const sprintProjectMembership = memberships.find(
      ({ project: { gid: projectId } }) => projectId === asanaSprintProjectId
    );
    if (!sprintProjectMembership) {
      console.log(
        `Task ${taskId} is not included in the current sprint, not moving task`
      );
      return false;
    }

    const {
      section: { gid: sprintSectionId },
    } = sprintProjectMembership;
    if (sprintSectionId === asanaSprintSectionIds.toTest) {
      console.log(
        `Task ${taskId} is still in the To Test section of the current sprint, moving task to “in progress”`
      );
      return asanaSprintSectionIds.inProgress;
    }
  }
}

exports.action = async function action() {
  const { pullRequest, action, triggerPhrase } = exports.getActionParameters();
  const taskId = exports.findAsanaTaskId({ triggerPhrase, pullRequest });

  const asanaPRStatus = await exports.getAsanaPRStatus({
    pullRequest,
  });
  //console.log("pull", pullRequest);
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
        const updateOptions = {
          custom_fields: {
            [customFieldPR.gid]: pullRequest.html_url,
            [customFieldPRStatus.gid]: asanaPRStatus,
          },
        };

        const destination = await getTaksDestination({ taskId, pullRequest });
        if (destination === asanaSprintSectionIds.toTest) {
          console.log(`Moving Asana task to “to test” and remove assignments`);
          await moveTaskToProjectSection({
            taskId,
            projectId: asanaSprintProjectId,
            sectionId: asanaSprintSectionIds.toTest,
          });
          updateOptions.assignee = null;
        } else if (destination === asanaSprintSectionIds.inProgress) {
          console.log(
            `Moving Asana task to “in progress” and remove assignments`
          );
          await moveTaskToProjectSection({
            taskId,
            projectId: asanaSprintProjectId,
            sectionId: asanaSprintSectionIds.inProgress,
          });
          updateOptions.assignee = null;
        }

        console.log(`Updating Asana task: ${taskId}`);
        await updateAsanaTask(taskId, updateOptions);
      }
      break;
    }
  }
};
