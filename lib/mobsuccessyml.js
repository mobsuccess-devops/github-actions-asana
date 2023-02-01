const yaml = require("js-yaml");
const { octokit } = require("./actions/octokit");

exports.getMobsuccessYMLFromRepo = async function getMobsuccessYMLFromRepo({
  owner,
  repo,
}) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".mobsuccess.yml",
    });
    const content = Buffer.from(data.content, "base64").toString("utf8");
    return yaml.load(content);
  } catch (e) {
    return {};
  }
};
