const { GraphQLClient } = require('graphql-request')
const { IssuesQuery } = require('./queries')
const { google } = require('googleapis')
const get = require('lodash/get')

const {
  GithubToken,
  Repository,
  Labels,
  State,
  GoogleClientEmail,
  SpreadsheetId,
  SheetName
} = process.env
const GooglePrivateKey = JSON.parse(process.env.GooglePrivateKey)
const BlacklistLabels = process.env.BlacklistLabels.split(',').map((label) => label.trim())

const getAuth = () => {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: GoogleClientEmail,
      private_key: GooglePrivateKey
    },
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
  })
}

const fetchGithubIssues = async (client, issues = [], after = null) => {
  const data = await client.request(IssuesQuery, {
    owner: Repository.split('/')[0],
    name: Repository.split('/')[1],
    labels: Labels.split(',').map((label) => label.trim()),
    states: State.split(',').map((state) => state.trim()),
    after
  })
  const edges = get(data, 'repository.issues.edges', [])
  const hasNextPage = edges.length > 0 && get(data, 'repository.issues.pageInfo.hasNextPage')
  const newIssues = issues.concat(get(data, 'repository.issues.edges', []).map((edge) => ({
    ...edge.node,
    labels: edge.node.labels.edges.map((edge) => edge.node.name)
  })))
  if (hasNextPage) {
    return fetchGithubIssues(client, newIssues, edges[edges.length - 1].cursor)
  } else {
    return newIssues
  }
}

const HEADER_CELLS = ['number', 'title', 'state', 'labels', 'repository']

module.exports.handler = async (event) => {
  const googleAuth = getAuth()
  const sheets = google.sheets('v4')
  console.info('Fetching Github issues')
  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: {
      Authorization: `bearer ${GithubToken}`
    }
  })
  const issues = await fetchGithubIssues(client)
  console.info(`Found ${issues.length} issues.`)
  console.info('Calculating new values')
  const cells = [HEADER_CELLS, ...issues.map((issue) => [
    issue.number,
    issue.title,
    issue.state,
    issue.labels.filter((label) => !BlacklistLabels.includes(label)).join(', '),
    Repository.split('/')[1]
  ])]
  console.info('Updating new values')
  await sheets.spreadsheets.values.update({
    auth: googleAuth,
    spreadsheetId: SpreadsheetId,
    range: `'${SheetName}'!A1:E2000`,
    requestBody: {
      values: cells
    },
    valueInputOption: 'USER_ENTERED'
  })
  console.info('Complete!')
}
