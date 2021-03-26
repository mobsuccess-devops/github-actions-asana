const asana = require("asana");

exports.buildClient = async function buildClient(asanaPAT) {
  return asana.Client.create({
    defaultHeaders: { "asana-enable": "new-sections,string_ids" },
    logAsanaChangeWarnings: false,
  })
    .useAccessToken(asanaPAT)
    .authorize();
};
