const { GraphQLClient } = require('graphql-request')
const { IssuesQuery } = require('./queries')
const GoogleSpreadsheet = require('google-spreadsheet')
const util = require('util')
const get = require('lodash/get')

const {
  GithubToken,
  Repository,
  Labels,
  State,
  GooglePrivateKey,
  GoogleClientEmail,
  SpreadsheetId,
  SheetName
} = process.env

const prepareDocumentAndGetSheet = async (doc) => {
  await util.promisify(doc.useServiceAccountAuth)({
    client_email: GoogleClientEmail,
    private_key: GooglePrivateKey
  })
  const info = await util.promisify(doc.getInfo)()
  const sheet = info.worksheets.find((worksheet) => worksheet.title === SheetName)
  if (!sheet) {
    throw new Error(`Cannot find sheet with name '${SheetName}'`)
  }
  return sheet
}

const fetchGithubIssues = async (client, issues = [], after = null) => {
  const data = await client.request(IssuesQuery, {
    variables: {
      owner: Repository.split('/')[0],
      name: Repository.split('/')[1],
      labels: Labels.split(',').map((label) => label.trim()),
      states: State.split(',').map((state) => state.trim()),
      after
    }
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

const HEADER_CELLS = [
  { row: 1, col: 'A', value: 'number' },
  { row: 1, col: 'B', value: 'title' },
  { row: 1, col: 'C', value: 'state' },
  { row: 1, col: 'D', value: 'labels' },
  { row: 1, col: 'E', value: 'repository' }
]

module.exports.handler = async (event) => {
  const doc = new GoogleSpreadsheet(SpreadsheetId)
  console.info('Preparing document and getting sheet')
  const sheet = await prepareDocumentAndGetSheet(doc)
  console.info('Fetching Github issues')
  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: {
      Authorization: `bearer ${GithubToken}`
    }
  })
  const issues = await fetchGithubIssues(client)
  console.info(`Found ${issues.length} issues.`)
  console.info('Clearing sheet')
  await util.promisify(sheet.clear)()
  console.info('Inserting new values')
  const cells = issues.reduce((cells, issue) => {
    const row = Math.floor(cells.length / HEADER_CELLS.length) + 1
    const issueCells = [
      { row, col: 'A', numericValue: parseInt(issue.number, 10) },
      { row, col: 'B', value: issue.title },
      { row, col: 'C', value: issue.state },
      { row, col: 'D', value: issue.labels.join(', ') },
      { row, col: 'E', value: Repository.split('/')[1] }
    ]
    return [...cells, ...issueCells]
  }, HEADER_CELLS)
  await util.promisify(sheet.bulkUpdateCells)(cells)
  console.info('Complete!')
}
