const core = require("@actions/core");
const github = require("@actions/github");
const getOctokit = require("./lib/actions/octokit");
const {
  updateAsanaTask,
  getTask,
  moveTaskToProjectSection,
  getProjectSections,
} = require("./lib/actions/asana");
const { getMobsuccessYMLFromRepo } = require("./lib/mobsuccessyml");

const customFieldLive = require("./lib/asana/custom-fields/live");
const customFieldStorybook = require("./lib/asana/custom-fields/storybook");
const customFieldPR = require("./lib/asana/custom-fields/asana-pr");
const customFieldPRStatus = require("./lib/asana/custom-fields/asana-pr-status");
const asanaMagics = require("@mobsuccess-devops/asana-magics");

const asanaSprintProjectId = asanaMagics.projects.currentSprint.gid;
const asanaSprintSectionIds = asanaMagics.projects.currentSprint.sections;

const octokit = getOctokit();

exports.getPullReviewStatuses = async function getPullReviewStatuses({
  pullRequest,
}) {
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
  const repository = github.context.payload.repository;
  const pullRequest = github.context.payload.pull_request;
  const mergeGroup = github.context.payload.merge_group;
  const action = core.getInput("action", { required: true });
  const triggerPhrase = core.getInput("trigger-phrase") || "";
  const amplifyUri = core.getInput("amplify-uri") || "";
  const storybookAmplifyUri = core.getInput("storybook-amplify-uri") || "";
  return {
    repository,
    pullRequest,
    action,
    triggerPhrase,
    amplifyUri,
    storybookAmplifyUri,
    mergeGroup,
  };
};

async function getTaskDestination({ taskId, pullRequest }) {
  const { merged_at: mergedAt } = pullRequest;
  if (mergedAt) {
    // do not move pulls in draft or already merged
    return;
  }
  const { requested_reviewers: requestedReviewers, assignees } = pullRequest;
  console.log("Requested reviewers:", requestedReviewers);

  // if review has been requested from ms-testers, this is probably bogus:
  // someone wanted to assign the task to them and failed- update the
  // task for them
  if (requestedReviewers.some(({ login }) => login === "ms-testers")) {
    console.log(
      `Found the pull requested to have a review requested from ms-testers, fix it`
    );
    await octokit.pulls.removeRequestedReviewers({
      ...github.context.repo,
      pull_number: pullRequest.number,
      reviewers: ["ms-testers"],
    });
    await octokit.issues.addAssignees({
      ...github.context.repo,
      issue_number: pullRequest.number,
      assignees: ["ms-testers"],
    });

    assignees.push({ login: "ms-testers" });
  }

  if (assignees.some(({ login }) => login === "ms-testers")) {
    // user ms-testers has been assigned
    // just to make sure, what is the current section of this task?
    const task = await getTask(taskId, {
      opt_fields: ["memberships", "completed"],
    });
    const { completed, memberships } = task;
    if (completed) {
      console.log(`Task ${taskId} is completed, not moving task`);
      return;
    }

    const sprintProjectMembership = memberships.find(
      ({ project: { gid: projectId } }) => projectId === asanaSprintProjectId
    );
    if (!sprintProjectMembership) {
      console.log(
        `Task ${taskId} is not included in the current sprint, not moving task`
      );
      return;
    }

    const {
      section: { gid: sprintSectionId },
    } = sprintProjectMembership;
    if (sprintSectionId === asanaSprintSectionIds.toTest) {
      console.log(
        `Task ${taskId} is already in the To Test section of the current sprint, not moving task`
      );
      return;
    }
    if (sprintSectionId === asanaSprintSectionIds.ready) {
      console.log(
        `Task ${taskId} is in the Ready section of the current sprint, not moving task`
      );
      return;
    }

    return {
      destination: asanaSprintSectionIds.toTest,
      shouldRemoveAssignee: true,
      shouldAssignToAsanaCreator: true,
    };
  } else {
    // user ms-testers is not currently assigned
    // if the PR is still open and the task is in the section “to test”, move it back
    // to “in progress”
    const task = await getTask(taskId, {
      opt_fields: ["memberships", "completed"],
    });
    const { completed, memberships } = task;
    if (completed) {
      console.log(`Task ${taskId} is completed, not moving task`);
      return;
    }

    const sprintProjectMembership = memberships.find(
      ({ project: { gid: projectId } }) => projectId === asanaSprintProjectId
    );
    if (!sprintProjectMembership) {
      console.log(
        `Task ${taskId} is not included in the current sprint, not moving task`
      );
      return;
    }

    const {
      section: { gid: sprintSectionId },
    } = sprintProjectMembership;
    if (sprintSectionId === asanaSprintSectionIds.toTest) {
      console.log(
        `Task ${taskId} is still in the “To Test” section of the current sprint, moving task to “In Progress”`
      );
      return {
        destination: asanaSprintSectionIds.inProgress,
        shouldRemoveAssignee: true,
      };
    }
    if (
      sprintSectionId === asanaSprintSectionIds.design ||
      sprintSectionId === asanaSprintSectionIds.readyToDo
    ) {
      console.log(
        `Task ${taskId} is still in the ${sprintSectionId} section of the current sprint, moving task to “In Progress”`
      );
      return {
        destination: asanaSprintSectionIds.inProgress,
        shouldRemoveAssignee: false,
      };
    }
  }
}

async function moveTaskToSprintAndEpicSection({ taskId, sectionId }) {
  console.log(`Moving task ${taskId} to section ${sectionId}`);
  const task = await getTask(taskId, {
    opt_fields: ["memberships"],
  });
  const { memberships } = task;
  console.log(
    `Found the following memberships: ${JSON.stringify(memberships)}`
  );
  for (const {
    project: { gid: projectId },
  } of memberships) {
    if (projectId === asanaSprintProjectId) {
      // move task to section
      console.log(
        `Found the Current Sprint project, moving to section ${sectionId}`
      );
      await moveTaskToProjectSection({ taskId, projectId, sectionId });
    } else {
      console.log(
        `Found a project that is not the Current Sprint: ${projectId}`
      );
      // this project is not the current sprint, see if we have a matching section
      const sections = await getProjectSections({ projectId });
      console.log(`Sections for this project: ${JSON.stringify(sections)}`);
      const matchingSection = sections.find(({ name }) => {
        switch (sectionId) {
          case asanaSprintSectionIds.design:
            return name.match(/design/i);
          case asanaSprintSectionIds.readyToDo:
            return name.match(/to ?do/i);
          case asanaSprintSectionIds.inProgress:
            return name.match(/in ?progress/i);
          case asanaSprintSectionIds.toTest:
            return name.match(/test/i);
          case asanaSprintSectionIds.ready:
            return name.match(/^ready$/i);
        }
      });
      console.log(`Matching section: ${JSON.stringify(matchingSection)}`);
      if (!matchingSection) {
        console.log(
          `Could not find a matching section, skipping to next project`
        );
        continue;
      }
      const { gid: matchingSectionId } = matchingSection;
      console.log(`Moving task to section ${matchingSectionId}`);
      await moveTaskToProjectSection({
        taskId,
        projectId,
        sectionId: matchingSectionId,
      });
    }
  }
}

async function checkIfCanMergeWithoutAsanaTask({ repository, pullRequest }) {
  const { assignees } = pullRequest;
  const assigneeLogins = assignees.map(({ login }) => login);
  if (!assigneeLogins.some((login) => login === "ms-testers")) {
    return false;
  }

  // if mobsuccess.yml has the `accept_ms_testers_without_closed_task` flag set to true, we can merge
  const mobsuccessyml = await getMobsuccessYMLFromRepo({
    owner: repository.owner.login,
    repo: repository.name,
    branch: pullRequest.head ? pullRequest.head.ref : "master",
  });
  const asanaSettings = mobsuccessyml.asana || {};
  if (asanaSettings.accept_ms_testers_without_closed_task) {
    console.log(
      "accept_ms_testers_without_closed_task is set to true, ok to merge"
    );
    return true;
  }
  return false;
}

function getAwsAmplifyLiveUrls({ id, labels, amplifyUri }) {
  if (!amplifyUri) {
    return [];
  }
  const result = [];
  if (amplifyUri.match(/^{/)) {
    const amplifyUris = JSON.parse(amplifyUri);
    for (const label of labels) {
      if (amplifyUris[label]) {
        result.push(amplifyUris[label].replace("%", id));
      }
    }
  } else {
    result.push(amplifyUri.replace("%", id));
  }
  return result;
}

exports.action = async function action() {
  try {
    return await actionImpl();
  } catch (error) {
    console.error(
      "Caught error while running action, is the Asana ticket in the Current Sprint board?"
    );
    console.error(error, JSON.stringify(error.value));
    core.setFailed(error.message);
    throw error;
  }
};

async function actionImpl() {
  // check if we run on a merge_group
  const {
    mergeGroup,
    repository,
    pullRequest,
    action,
    triggerPhrase,
    amplifyUri,
    storybookAmplifyUri,
  } = exports.getActionParameters();

  console.log("GitHub Context", github.context.payload);

  if (mergeGroup) {
    console.log("Running on a merge group - skipping Asana integration");
    return;
  }

  const taskId = exports.findAsanaTaskId({ triggerPhrase, pullRequest });

  const asanaPRStatus = await exports.getAsanaPRStatus({
    pullRequest,
  });
  //console.log("pull", pullRequest);
  console.log("asanaPRStatus", asanaPRStatus);
  const labels = (pullRequest.labels || []).map(({ name }) => name);

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
        const pullRequestNumber =
          pullRequest.number || pullRequest.html_url.split("/").pop();
        const amplifyLiveUrls = getAwsAmplifyLiveUrls({
          id: pullRequestNumber,
          labels,
          amplifyUri,
        });
        const updateOptions = {
          custom_fields: {
            ...(amplifyLiveUrls.length
              ? {
                  [customFieldLive.gid]: amplifyLiveUrls.join("\n"),
                }
              : {}),
            ...(storybookAmplifyUri
              ? {
                  [customFieldStorybook.gid]: storybookAmplifyUri.replace(
                    "%",
                    pullRequestNumber
                  ),
                }
              : {}),
            [customFieldPR.gid]: pullRequest.html_url,
            [customFieldPRStatus.gid]: asanaPRStatus,
          },
        };

        const {
          destination,
          shouldRemoveAssignee,
          shouldAssignToAsanaCreator = false,
        } = (await getTaskDestination({ taskId, pullRequest })) || {};
        console.log("Got destination", {
          destination,
          shouldRemoveAssignee,
          shouldAssignToAsanaCreator,
        });

        if (shouldAssignToAsanaCreator) {
          const taskForCreator = await getTask(taskId, {
            opt_fields: "created_by",
          });
          updateOptions["assignee"] = taskForCreator.created_by.gid;
        } else if (shouldRemoveAssignee) {
          updateOptions["assignee"] = null;
        }
        if (destination) {
          console.log(`Moving Asana task to section ${destination}`);
          await moveTaskToSprintAndEpicSection({
            taskId,
            sectionId: destination,
          });
        }

        console.log(`Updating Asana task: ${taskId}`, updateOptions);
        await updateAsanaTask(taskId, updateOptions);

        // fail the Action if the task is not draft and the task is not complete
        const isDraft = await exports.getPullIsDraft({ pullRequest });
        if (isDraft) {
          console.log(
            "Pull request in draft mode, not checking Asana task for completion"
          );
        } else {
          const { completed } = await getTask(taskId, {
            opt_fields: ["completed"],
          });
          console.log("Task is completed?", completed);
          if (!completed) {
            // check if can merge without a completed asana task
            const canMergeWithoutAsanaTask = await checkIfCanMergeWithoutAsanaTask(
              { repository, pullRequest }
            );
            if (!canMergeWithoutAsanaTask) {
              throw new Error(
                "Asana task is not yet completed, blocking merge"
              );
            }
          }
        }
      }
      break;
    }
  }
}
