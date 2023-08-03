# Github-Asana action

[![NPM](https://github.com/mobsuccess-devops/github-actions-asana/actions/workflows/npm.yml/badge.svg)](https://github.com/mobsuccess-devops/github-actions-asana/actions/workflows/npm.yml)

This action integrates GitHub with the Mobsuccess Asana project. If you need to
use this action outside of Mobsuccess, you must clone it and tweak the values.

![Sample Asana Ticket](https://raw.githubusercontent.com/mobsuccess-devops/github-actions-asana/master/docs/asana-pr.png)

# Install the workflow in repository

You do not need to take any steps to include this workflow in your repository.
The MS robot will automatically create a PR on your repository.

## Enable AWS Amplify custom domain

If your repository is linked to AWS Amplify, you can dynamically update the
Amplify hostname link. To do so, create a variable in your repository named
`AWS_AMPLIFY_URI` with a value such as `https://pr-%.foo.live.mobsuccess.com`.

Note for legacy users: you can also setup a secret using the same name, albeit
the secret is less convenient because you can't easily edit its current value.

If your repository supports multiple domains, this value can be a JSON:

```json
{
  "webapps/lcm": "https://pr-%.platform-lcm.live.mobsuccess.com",
  "webapps/lco": "https://pr-%.platform-lco.live.mobsuccess.com"
}
```
