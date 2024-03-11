const projectCurrentSprintSectionGid = {
  cancelled: "1203546046432495",
  pending: "1201940752401910",
  readyToDo: "1200175269622815",
  inProgress: "1200175269622840",
  toTest: "1200175269622816",
  ready: "1200175269622817",
  trash: "1201438237708782",
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
        [projectCurrentSprintSectionGid.cancelled]: "Annulé",
        [projectCurrentSprintSectionGid.pending]: "Pending",
        [projectCurrentSprintSectionGid.readyToDo]: "Ready to do",
        [projectCurrentSprintSectionGid.inProgress]: "In Progress",
        [projectCurrentSprintSectionGid.toTest]: "To Test",
        [projectCurrentSprintSectionGid.ready]: "Ready",
        [projectCurrentSprintSectionGid.trash]:
          "Trash (ticket déclaré non complet)",
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
    chiffrage: { gid: "1203142374140249" },
    priority: {
      gid: "1200175269622756",
      values: {
        // this select may change, query Asana API to get the current values
      },
    },
    businessUnit: {
      gid: "1200175269622818",
      values: {
        // this select may change, query Asana API to get the current values
      },
    },
    equipe: {
      gid: "1200245464557615",
      values: {
        // this select changes too often, query Asana API to get the current values
      },
    },
    changelog: { gid: "1202737996854329" },
    sujet: {
      gid: "1201664281152438",
      values: {
        // this select changes too often, query Asana API to get the current values
      },
    },
    type: {
      gid: "1200095461095727",
      values: {
        new: "1200095461095728",
        bug: "1200095461095730",
        feature: "1200095461095729",
        run: "1205249905662412",
        nobug: "1205064580744467",
        rd: "1205098939059695",
        improvement: "1205256027909996",
        cantreproduce: "1205285513773675",
      },
    },
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
