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
