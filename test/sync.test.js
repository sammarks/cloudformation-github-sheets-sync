Object.assign(process.env, {
  GithubToken: 'github-token',
  Repository: 'sammarks/cloudformation-github-sheets-sync',
  Labels: 'reporting, two',
  BlacklistLabels: 'reporting, two',
  State: 'OPEN,CLOSED',
  GooglePrivateKey: '"google-private-key"',
  GoogleClientEmail: 'serviceacct@gmail.com',
  SpreadsheetId: 'abcd-spreadsheet',
  SheetName: 'Sheet'
})

const { google } = require('googleapis')
const { GraphQLClient } = require('graphql-request')
const { IssuesQuery } = require('../src/queries')
const { handler } = require('../src/sync')

jest.mock('googleapis')
jest.mock('graphql-request')
afterEach(() => {
  jest.resetAllMocks()
})

describe('syncing github issues to google sheets', () => {
  let sheetsMock
  beforeEach(() => {
    sheetsMock = {
      spreadsheets: {
        values: {
          update: jest.fn(() => Promise.resolve())
        }
      }
    }
    google.sheets.mockReturnValueOnce(sheetsMock)
    GraphQLClient.prototype.request.mockReturnValueOnce(Promise.resolve({
      repository: {
        issues: {
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false
          },
          edges: [
            {
              cursor: 'one',
              node: {
                number: '1',
                title: 'One',
                state: 'OPEN',
                labels: {
                  edges: [{ node: { name: 'label' } }]
                }
              }
            },
            {
              cursor: 'two',
              node: {
                number: '2',
                title: 'Two',
                state: 'CLOSED',
                labels: {
                  edges: [
                    { node: { name: 'label-two' } },
                    { node: { name: 'label' } },
                    { node: { name: 'two' } }
                  ]
                }
              }
            }
          ]
        }
      }
    }))
    GraphQLClient.prototype.request.mockReturnValueOnce(Promise.resolve({
      repository: {
        issues: {
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false
          },
          edges: [
            {
              cursor: 'three',
              node: {
                number: '3',
                title: 'Three',
                state: 'OPEN',
                labels: {
                  edges: [
                    { node: { name: 'label' } },
                    { node: { name: 'reporting' } }
                  ]
                }
              }
            }
          ]
        }
      }
    }))
    return handler()
  })
  it('authenticates with Google', () => {
    expect(google.auth.GoogleAuth).toHaveBeenCalledTimes(1)
    expect(google.auth.GoogleAuth).toHaveBeenCalledWith({
      credentials: {
        client_email: 'serviceacct@gmail.com',
        private_key: 'google-private-key'
      },
      scopes: 'https://www.googleapis.com/auth/spreadsheets'
    })
    expect(google.sheets).toHaveBeenCalledWith('v4')
    expect(google.sheets).toHaveBeenCalledTimes(1)
  })
  it('authenticates with github', () => {
    expect(GraphQLClient).toHaveBeenCalledTimes(1)
    expect(GraphQLClient).toHaveBeenCalledWith('https://api.github.com/graphql', {
      headers: {
        Authorization: 'bearer github-token'
      }
    })
  })
  it('fetches the first page of Github issues', () => {
    expect(GraphQLClient.prototype.request).toHaveBeenCalledTimes(2)
    expect(GraphQLClient.prototype.request).toHaveBeenNthCalledWith(1, IssuesQuery, {
      owner: 'sammarks',
      name: 'cloudformation-github-sheets-sync',
      labels: ['reporting', 'two'],
      states: ['OPEN', 'CLOSED'],
      after: null
    })
  })
  it('fetches the second page of Github issues', () => {
    expect(GraphQLClient.prototype.request).toHaveBeenNthCalledWith(2, IssuesQuery, {
      owner: 'sammarks',
      name: 'cloudformation-github-sheets-sync',
      labels: ['reporting', 'two'],
      states: ['OPEN', 'CLOSED'],
      after: 'two'
    })
  })
  it('bulk-updates the cells in the sheet', () => {
    expect(sheetsMock.spreadsheets.values.update).toHaveBeenCalledTimes(1)
    const call = sheetsMock.spreadsheets.values.update.mock.calls[0][0]
    expect(call.auth).toBeDefined()
    expect(call.spreadsheetId).toEqual('abcd-spreadsheet')
    expect(call.range).toEqual('\'Sheet\'!A1:E2000')
    expect(call.valueInputOption).toEqual('USER_ENTERED')
    expect(call.requestBody).toEqual({
      values: [
        ['number', 'title', 'state', 'labels', 'repository'],
        ['1', 'One', 'OPEN', 'label', 'cloudformation-github-sheets-sync'],
        ['2', 'Two', 'CLOSED', 'label-two, label', 'cloudformation-github-sheets-sync'],
        ['3', 'Three', 'OPEN', 'label', 'cloudformation-github-sheets-sync']
      ]
    })
  })
})
