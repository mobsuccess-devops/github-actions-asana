# asana-magics

This repository is a central place to store Asana magic number and strings.

It helps to reference theses magics in other repositories (you'll save an API
call to Asana).

## Example

Sample usage:

```js
const asanaMagics = require("@mobsuccess-devops/asana-magics");

const gid = asanaMagics.customFields.live.gid;
console.log(gid);
```

## Asana API Explorer

When adding stuff in the dashboard, you may use the [Asana API Explorer](https://developers.asana.com/explorer) to get the gids.

For exemple, to view all the custom fields in the Mobsuccess workspace:

1. choose `GET /workspaces/:workspace_gid/custom_fields`
2. increase the limit (100 or maybe more)
3. in the `workspace_gid`, enter: `634223311732610`
4. click submit
