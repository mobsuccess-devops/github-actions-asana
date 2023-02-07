const yaml = require("js-yaml");
const getOctokit = require("./actions/octokit");

const octokit = getOctokit();

exports.getMobsuccessYMLFromRepo = async function getMobsuccessYMLFromRepo({
  owner,
  repo,
  branch,
}) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".mobsuccess.yml",
      ref: branch || "master",
    });
    const content = Buffer.from(data.content, "base64").toString("utf8");
    return yaml.load(content);
  } catch (e) {
    console.log("Error getting .mobsuccess.yml from repo", e);
    return {};
  }
};
