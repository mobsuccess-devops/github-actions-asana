const repo = require("./__fixtures__/repo.js");
const customFieldPRStatus = require("./lib/asana/custom-fields/asana-pr-status");

describe("Asana GitHub actions", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });
  beforeAll(() => {
    jest.mock("./lib/actions/octokit");
    jest.mock("@actions/github", () => ({
      context: {
        repo: require("./__fixtures__/repo.js"),
      },
    }));
    jest.mock("./lib/actions/octokit");
  });

  // add a test that detect if a pull request has a body
  test("detect if pull request has a body", async () => {
    const { getPullDescription } = require("./action");
    const pullRequestDescription = require("./__fixtures__/pullRequest-description.js");
    const string = pullRequestDescription.data.body;
    const array = string.split("Why?")[1].trim().split("###")[0].trim();

    expect(
      await getPullDescription({
        pullRequest: {
          body: array,
        },
      })
    ).toBe("This is a test");
  });

  test("detect if pull request is draft", async () => {
    const { getPullIsDraft } = require("./action");
    expect(
      await getPullIsDraft({
        pullRequest: {
          draft: true,
        },
      })
    ).toBe(true);
    expect(await getPullIsDraft({ pullRequest: { draft: false } })).toBe(false);
  });

  test("detect if pull request is merged", async () => {
    const { getPullIsMerged } = require("./action");
    expect(
      await getPullIsMerged({
        pullRequest: { merged_at: "2021-03-01T12:00:00Z" },
      })
    ).toBe(true);
    expect(
      await getPullIsMerged({ pullRequest: { merged_at: undefined } })
    ).toBe(false);
  });

  describe("detect if pull request approval status", () => {
    const performTest = async (fixture, expectedResult) => {
      jest.resetModules();
      jest.resetAllMocks();
      const listReviews = jest.fn(() => require(`./__fixtures__/${fixture}`));
      jest.mock("./lib/actions/octokit", () => jest.fn());
      require("./lib/actions/octokit").mockReturnValue({
        pulls: {
          listReviews,
        },
      });
      const { getPullReviewStatuses } = require("./action");
      expect(
        await getPullReviewStatuses({ pullRequest: { number: 1234 } })
      ).toEqual(expectedResult);

      expect(listReviews).toHaveBeenCalledTimes(1);
      expect(listReviews).toHaveBeenLastCalledWith({
        ...repo,
        pull_number: 1234,
      });
    };

    test("is approved", async () => {
      await performTest("listReviews-approved", { isApproved: true });
    });
    test("is pending", async () => {
      await performTest("listReviews-pending", {});
    });
    test("is rejected and commented", async () => {
      await performTest("listReviews-rejected-and-commented", {
        isRejected: true,
      });
    });
    test("is rejected", async () => {
      await performTest("listReviews-rejected", { isRejected: true });
    });
    test("is approved and rejected", async () => {
      await performTest("listReviews-approved-and-rejected", {
        isApproved: true,
        isRejected: true,
      });
    });
    test("is approved after rejection", async () => {
      await performTest("listReviews-approved-after-rejection.js", {
        isApproved: true,
      });
      await performTest(
        "listReviews-approved-after-rejection-order-by-date-desc.js",
        { isApproved: true }
      );
    });
  });

  describe("get Asana PR status", () => {
    const performTest = async (
      pullRequest,
      pullReviewStatuses,
      expectedResult
    ) => {
      const action = require("./action");
      jest.spyOn(action, "getPullReviewStatuses");
      action.getPullReviewStatuses.mockImplementation(() => pullReviewStatuses);

      expect(await action.getAsanaPRStatus(pullRequest)).toBe(expectedResult);

      expect(action.getPullReviewStatuses).toHaveBeenCalledTimes(1);
    };

    test("is merged", async () => {
      await performTest(
        { pullRequest: { number: 1234, merged_at: "2021-01-01T12:00:00Z" } },
        {},
        customFieldPRStatus.values.merged
      );
    });
    test("is rejected", async () => {
      await performTest(
        { pullRequest: { number: 1234 } },
        { isRejected: true },
        customFieldPRStatus.values.rejected
      );
    });
    test("is pending review", async () => {
      await performTest(
        { pullRequest: { number: 1234, requested_reviewers: [1] } },
        {},
        customFieldPRStatus.values.inReview
      );
    });
    test("is approved and pending review", async () => {
      await performTest(
        { pullRequest: { number: 1234, requested_reviewers: [1] } },
        { isApproved: true },
        customFieldPRStatus.values.inReview
      );
    });
    test("is rejected and pending review", async () => {
      await performTest(
        { pullRequest: { number: 1234, requested_reviewers: [1] } },
        { isRejected: true },
        customFieldPRStatus.values.rejected
      );
    });
    test("is approved", async () => {
      await performTest(
        { pullRequest: { number: 1234 } },
        { isApproved: true },
        customFieldPRStatus.values.approved
      );
    });
    test("is pending", async () => {
      await performTest(
        { pullRequest: { number: 1234 } },
        {},
        customFieldPRStatus.values.inProgress
      );
    });
    test("is draft", async () => {
      await performTest(
        { pullRequest: { number: 1234, draft: true } },
        { isApproved: true },
        customFieldPRStatus.values.inProgress
      );
    });
  });

  describe("find Asana task in pull request body", () => {
    test("with no ticket", () => {
      const action = require("./action");
      expect(
        action.findAsanaTaskId({
          triggerPhrase: "",
          pullRequest: {
            body: "xxx yyy",
          },
        })
      ).toBe(undefined);
    });
    test("without trigger phrase", () => {
      const action = require("./action");
      expect(
        action.findAsanaTaskId({
          triggerPhrase: "",
          pullRequest: {
            body:
              "xxx https://app.asana.com/0/1200114135468212/1200114477821446/f yyy",
          },
        })
      ).toBe("1200114477821446");
    });
    test("with missing trigger phrase", () => {
      const action = require("./action");
      expect(
        action.findAsanaTaskId({
          triggerPhrase: "ticket",
          pullRequest: {
            body:
              "xxx https://app.asana.com/0/1200114135468212/1200114477821446/f yyy",
          },
        })
      ).toBe(undefined);
    });
    test("with trigger phrase", () => {
      const action = require("./action");
      expect(
        action.findAsanaTaskId({
          triggerPhrase: "ticket",
          pullRequest: {
            body:
              "ticket https://app.asana.com/0/1200114135468212/1200114477821446/f yyy",
          },
        })
      ).toBe("1200114477821446");
    });
  });

  test("get action parameters", () => {
    const action = require("./action");
    jest.mock("@actions/github", () => ({
      context: {
        payload: {
          pull_request: {
            number: 1234,
          },
        },
      },
    }));
    jest.mock("@actions/core");
    const core = require("@actions/core");
    core.getInput.mockImplementation(
      (what) =>
        ({ action: "test-action", "trigger-phrase": "test-trigger-phrase" }[
          what
        ])
    );
    expect(action.getActionParameters()).toEqual({
      pullRequest: { number: 1234 },
      amplifyUri: "",
      storybookAmplifyUri: "",
      action: "test-action",
      triggerPhrase: "test-trigger-phrase",
    });
    core.getInput.mockImplementation(
      (what) => ({ action: "test-action" }[what])
    );
    expect(action.getActionParameters()).toEqual({
      pullRequest: { number: 1234 },
      amplifyUri: "",
      storybookAmplifyUri: "",
      action: "test-action",
      triggerPhrase: "",
    });
  });

  describe("perform action", () => {
    test("debug", async () => {
      const pullRequest = { number: 1234 };
      const action = require("./action");
      jest.spyOn(action, "getActionParameters");
      action.getActionParameters.mockImplementation(() => ({
        pullRequest,
        action: "debug",
        triggerPhrase: "test-trigger-phrase",
      }));

      const spyFindAsanaTaskId = jest.spyOn(action, "findAsanaTaskId");

      const spyGetAsanaPRStatus = jest.spyOn(action, "getAsanaPRStatus");
      action.getAsanaPRStatus.mockImplementation(() => "test-value");

      action.action();

      expect(spyFindAsanaTaskId).toHaveBeenCalledTimes(1);
      expect(spyFindAsanaTaskId).toHaveBeenLastCalledWith({
        triggerPhrase: "test-trigger-phrase",
        pullRequest,
      });
      expect(spyGetAsanaPRStatus).toHaveBeenCalledTimes(1);
      expect(spyGetAsanaPRStatus).toHaveBeenLastCalledWith({ pullRequest });
    });
    test("synchronize", async () => {
      jest.resetAllMocks();
      jest.resetModules();
      jest.mock("./lib/actions/asana");
      require("./lib/actions/asana").getTask.mockImplementation(() => ({
        completed: true,
        memberships: [],
      }));
      const { updateAsanaTask } = require("./lib/actions/asana");

      const action = require("./action");
      const pullRequest = {
        number: 1234,
        body:
          "test-trigger-phrase https://app.asana.com/0/1200114135468212/1200114477821446/f",
        requested_reviewers: [],
        assignees: [],
      };
      jest.spyOn(action, "getActionParameters");
      action.getActionParameters.mockImplementation(() => ({
        pullRequest,
        action: "synchronize",
        triggerPhrase: "test-trigger-phrase",
      }));

      const spyFindAsanaTaskId = jest.spyOn(action, "findAsanaTaskId");

      const spyGetAsanaPRStatus = jest.spyOn(action, "getAsanaPRStatus");
      action.getAsanaPRStatus.mockImplementation(() => "test-value");

      await action.action();

      expect(spyFindAsanaTaskId).toHaveBeenCalledTimes(1);
      expect(spyFindAsanaTaskId).toHaveBeenLastCalledWith({
        triggerPhrase: "test-trigger-phrase",
        pullRequest,
      });
      expect(spyGetAsanaPRStatus).toHaveBeenCalledTimes(1);
      expect(spyGetAsanaPRStatus).toHaveBeenLastCalledWith({ pullRequest });
      expect(updateAsanaTask).toHaveBeenCalledTimes(1);
      expect(updateAsanaTask).toHaveBeenCalledWith("1200114477821446", {
        custom_fields: {
          1200114403104483: undefined,
          1200114505696486: "test-value",
        },
      });
    });
    test("synchronize should failed for not completed task", async () => {
      jest.resetAllMocks();
      jest.resetModules();
      jest.mock("./lib/actions/asana");
      require("./lib/actions/asana").getTask.mockImplementation(() => ({
        completed: false,
        memberships: [],
      }));

      const action = require("./action");
      const pullRequest = {
        number: 1234,
        body:
          "test-trigger-phrase https://app.asana.com/0/1200114135468212/1200114477821446/f",
        requested_reviewers: [],
        assignees: [],
      };
      jest.spyOn(action, "getActionParameters");
      action.getActionParameters.mockImplementation(() => ({
        pullRequest,
        action: "synchronize",
        triggerPhrase: "test-trigger-phrase",
      }));

      const spyGetAsanaPRStatus = jest.spyOn(action, "getAsanaPRStatus");
      action.getAsanaPRStatus.mockImplementation(() => "test-value");

      let errorHasBeenThrown = false;
      try {
        await action.action();
      } catch (error) {
        errorHasBeenThrown = true;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
          "Asana task is not yet completed, blocking merge"
        );
      }
      expect(errorHasBeenThrown).toBe(true);
      expect(spyGetAsanaPRStatus).toHaveBeenCalledTimes(1);
      expect(spyGetAsanaPRStatus).toHaveBeenLastCalledWith({ pullRequest });
    });

    test("synchronize should not fail for not completed task with asana: accept_ms_testers_without_closed_task", async () => {
      jest.resetAllMocks();
      jest.resetModules();
      jest.mock("./lib/actions/asana");
      require("./lib/actions/asana").getTask.mockImplementation(() => ({
        completed: false,
        memberships: [],
      }));
      jest.mock("./lib/mobsuccessyml");
      require("./lib/mobsuccessyml").getMobsuccessYMLFromRepo.mockImplementation(
        () => ({
          asana: { accept_ms_testers_without_closed_task: true },
        })
      );

      const action = require("./action");
      const pullRequest = {
        number: 1234,
        body:
          "test-trigger-phrase https://app.asana.com/0/1200114135468212/1200114477821446/f",
        requested_reviewers: [],
        assignees: [{ login: "ms-testers" }],
      };
      jest.spyOn(action, "getActionParameters");
      action.getActionParameters.mockImplementation(() => ({
        repository: {
          owner: {
            login: "test-owner",
          },
          name: "test-repo",
        },
        pullRequest,
        action: "synchronize",
        triggerPhrase: "test-trigger-phrase",
      }));

      const spyGetAsanaPRStatus = jest.spyOn(action, "getAsanaPRStatus");
      action.getAsanaPRStatus.mockImplementation(() => "test-value");

      await action.action();

      expect(spyGetAsanaPRStatus).toHaveBeenCalledTimes(1);
      expect(spyGetAsanaPRStatus).toHaveBeenLastCalledWith({ pullRequest });
    });
    test("synchronize with missing task ID", async () => {
      jest.resetAllMocks();
      jest.resetModules();
      jest.mock("./lib/actions/asana");
      const { updateAsanaTask } = require("./lib/actions/asana");

      const action = require("./action");
      const pullRequest = {
        number: 1234,
        body: "",
        requested_reviewers: [],
        assignees: [],
      };
      jest.spyOn(action, "getActionParameters");
      action.getActionParameters.mockImplementation(() => ({
        pullRequest,
        action: "synchronize",
        triggerPhrase: "test-trigger-phrase",
      }));

      const spyFindAsanaTaskId = jest.spyOn(action, "findAsanaTaskId");

      const spyGetAsanaPRStatus = jest.spyOn(action, "getAsanaPRStatus");
      action.getAsanaPRStatus.mockImplementation(() => "test-value");

      await action.action();

      expect(spyFindAsanaTaskId).toHaveBeenCalledTimes(1);
      expect(spyFindAsanaTaskId).toHaveBeenLastCalledWith({
        triggerPhrase: "test-trigger-phrase",
        pullRequest,
      });
      expect(spyGetAsanaPRStatus).toHaveBeenCalledTimes(1);
      expect(spyGetAsanaPRStatus).toHaveBeenLastCalledWith({ pullRequest });
      expect(updateAsanaTask).toHaveBeenCalledTimes(0);
    });
  });
});
