const core = require("@actions/core");
const github = require("@actions/github");

module.exports = function getOctokit() {
  const githubToken = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(githubToken);
  return octokit;
};
