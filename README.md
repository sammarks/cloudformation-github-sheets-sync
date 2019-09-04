![][header-image]

[![CircleCI](https://img.shields.io/circleci/build/github/sammarks/cloudformation-github-sheets-sync/master)](https://circleci.com/gh/sammarks/cloudformation-github-sheets-sync)
[![Coveralls](https://img.shields.io/coveralls/sammarks/cloudformation-github-sheets-sync.svg)](https://coveralls.io/github/sammarks/cloudformation-github-sheets-sync)
[![Dev Dependencies](https://david-dm.org/sammarks/cloudformation-github-sheets-sync/dev-status.svg)](https://david-dm.org/sammarks/cloudformation-github-sheets-sync?type=dev)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg)](https://paypal.me/sammarks15)

`cloudformation-github-sheets-sync` is an AWS CloudFormation template generated using the
[Serverless Framework](https://serverless.com) designed to pull issues from a Github
repository, and sync them with a Google Docs Spreadsheet at a specified interval.

## Get Started

It's simple! Click this fancy button:

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=github-sheets-sync&templateURL=https://sammarks-cf-templates.s3.amazonaws.com/github-sheets-sync/template.yaml)

Then give the stack a name, and configure it:

| Parameter | Default Value | Description |
| --- | --- | --- |
| UpdateSchedule | `cron(0/30 12-23 ? * MON-FRI *)` | The CloudWatch ScheduleExpression defining the interval the issues are synced at. |
| GithubToken | | The Github Authentication token used for fetching issues. |
| Repository | `sammarks/cloudformation-github-sheets-sync` | A Github repository to sync, in the format of `owner/repository` |
| Labels | `reporting` | A comma-separated list of labels to filter on. |
| BlacklistLabels | `reporting` | A comma-separated list of labels to not include in the spreadsheet. |
| State | `OPEN,CLOSED` | A comma-separated list of states to filter on. |
| GoogleClientEmail | | Your service account's email address for Google. |
| GooglePrivateKey | | Your service account's JSON-encoded private key for Google. Should be something like `"-----BEGIN PRIVATE KEY-----\nabddfd..."` |
| SpreadsheetId | | The spreadsheet ID to update. You can find this from the URL. |
| SheetName | `Github Issues` | The name of the sheet to update inside the spreadsheet. |

### Preparing Credentials

In order to be able to access Github and Google Sheets, you'll need to setup some credentials on their websites.

#### Github

All you need for Github is a developer token with access to be able to read issues for your repositories. This script doesn't write anything to Github.

Go to [edit your personal access tokens,](https://github.com/settings/tokens) create one, and make sure it has the `repo` scope.

#### Google

This one is a little more complicated. To setup Google, follow [these instructions from google-spreadsheet.](https://github.com/theoephraim/node-google-spreadsheet#service-account-recommended-method)

**Then you're ready!** Once the stack is deployed, you can inspect the CloudWatch logs of your Lambda functions to make sure they're pulling issues and updating spreadsheets properly.

### Usage in Another Stack or Serverless

Add something like this underneath resources:

```yaml
githubSheetsSyncStack:
  Type: AWS::CloudFormation::Stack
  Properties:
    TemplateURL: https://sammarks-cf-templates.s3.amazonaws.com/github-sheets-sync/VERSION/template.yaml
    Parameters:
      GithubToken: ''
      Repository: ''
      # ... other parameters
```

You can even create multiple instances of the stack to sync multiple repositories at a time!

**Note:** This stack will require the `CAPABILITY_AUTO_EXPAND` capability when deploying
the parent stack with CloudFormation. If you are using the Serverless framework, you can
"trick" it into adding the required capabilities by adding this to your `serverless.yaml`:

```yaml
resources:
  Transform: 'AWS::Serverless-2016-10-31' # Trigger Serverless to add CAPABILITY_AUTO_EXPAND
  Resources:
    otherResource: # ... all of your original resources
```

### What's deployed?

- One Lambda function, scheduled to execute at your interval.

### How does it work?

The sync Lambda goes through the following process:

- Authenticate with Google and make sure the spreadsheet and sheet exist.
- Fetch the latest Github issues for the repository, sorting by created date descending.
- Clear the existing sheet.
- Re-populate the sheet with the headers and cells generated from the issues.

### Accessing Previous Versions & Upgrading

Each time a release is made in this repository, the corresponding template is available at:

```
https://sammarks-cf-templates.s3.amazonaws.com/github-sheets-sync/VERSION/template.yaml
```

**On upgrading:** I actually _recommend_ you lock the template you use to a specific version. Then, if you want to update to a new version, all you have to change in your CloudFormation template is the version and AWS will automatically delete the old stack and re-create the new one for you.

## Features

- Automatically sync Github issues with Google Sheets for further refining, metadata-adding, reporting, etc.
- No need to pay for third-party services! Just pay for the Lambda (very cheap).
- Customize your own schedule and limited filtering.
- Deploy with other CLoudFormation-compatible frameworks (like the Serverless framework).
- All functionality is self-contained within one CloudFormation template. Delete the template, and all of our created resources are removed.

## Why use this?

Google Sheets is a great tool for communicating Github issue progress from an engineering team to other executives. There are a lot of solutions out there for syncing Github issues, but none allow complete control over the codebase (just fork it and change what you'd like, or modify the Lambda code directly). The other solutions out there also cost money, and Lambda is cheap!

[header-image]: https://raw.githubusercontent.com/sammarks/art/master/cloudformation-github-sheets-sync/header.jpg
