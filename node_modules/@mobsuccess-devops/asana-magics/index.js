const projectCurrentSprintSectionGid = {
  design: "1200175269622814",
  trash: "1201438237708782",
  readyToDo: "1200175269622815",
  inProgress: "1200175269622840",
  toTest: "1200175269622816",
  ready: "1200175269622817",
};

module.exports = {
  workspaces: {
    mobsuccess: {
      gid: "634223311732610",
    },
  },
  projects: {
    currentSprint: {
      gid: "1200175269622723",
      sections: projectCurrentSprintSectionGid,
      sectionNames: {
        [projectCurrentSprintSectionGid.design]: "Design",
        [projectCurrentSprintSectionGid.readyToDo]: "Ready to do",
        [projectCurrentSprintSectionGid.inProgress]: "In Progress",
        [projectCurrentSprintSectionGid.toTest]: "To Test",
        [projectCurrentSprintSectionGid.ready]: "Ready",
      },
    },
  },
  customFields: {
    pullRequestAssignee: { gid: "1204034768535484" },
    pullRequestDescription: { gid: "1204032332257162" },
    pullRequestQA: { gid: "1204054430312496" },
    live: { gid: "1200323257708391" },
    storybook: { gid: "1201338340578371" },
    asanaPr: { gid: "1200114403104483" },
    asanaPrStatus: {
      gid: "1200114505696486",
      values: {
        inDraft: "1204056047582187",
        inProgress: "1200114505696487",
        inReview: "1200114505696488",
        approved: "1200114505696489",
        rejected: "1200114505696490",
        merged: "1200114505696491",
        deployed_main: "1200263008464802",
        deployed_master: "1200263008464807",
        deployed_preprod: "1200263008464814",
        deployed_prod: "1200263008464819",
      },
    },
  },
  users: {
    github: {
      gid: "1200114216411725",
    },
  },
};
