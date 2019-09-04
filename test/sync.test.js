Object.assign(process.env, {
  GithubToken: 'github-token',
  Repository: 'sammarks/cloudformation-github-sheets-sync',
  Labels: 'reporting, two',
  State: 'OPEN,CLOSED',
  GooglePrivateKey: 'google-private-key',
  GoogleClientEmail: 'serviceacct@gmail.com',
  SpreadsheetId: 'abcd-spreadsheet',
  SheetName: 'Sheet'
})

const GoogleSpreadsheetReal = require('google-spreadsheet')
const GoogleSpreadsheet = {
  prototype: {
    useServiceAccountAuth: jest.fn(),
    getInfo: jest.fn()
  }
}
const { GraphQLClient } = require('graphql-request')
const { IssuesQuery } = require('../src/queries')
const { handler } = require('../src/sync')

jest.mock('google-spreadsheet')
jest.mock('graphql-request')
afterEach(() => {
  jest.resetAllMocks()
})

describe('syncing github issues to google sheets', () => {
  beforeEach(() => {
    GoogleSpreadsheetReal.mockImplementationOnce(() => GoogleSpreadsheet.prototype)
    GoogleSpreadsheet.prototype.useServiceAccountAuth
      .mockImplementationOnce((_, callback) => callback(null, 'Success'))
  })
  describe('when the sheet exists', () => {
    let mockSheet
    beforeEach(() => {
      mockSheet = {
        clear: jest.fn((callback) => callback(null, 'Success')),
        bulkUpdateCells: jest.fn((cells, callback) => callback(null, 'Success'))
      }
      GoogleSpreadsheet.prototype.getInfo
        .mockImplementationOnce((callback) => callback(null, {
          worksheets: [
            { title: 'test sheet' },
            { ...mockSheet, title: 'Sheet' }
          ]
        }))
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
                      { node: { name: 'label' } }
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
                    edges: [{ node: { name: 'label' } }]
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
      expect(GoogleSpreadsheet.prototype.useServiceAccountAuth).toHaveBeenCalledTimes(1)
      expect(GoogleSpreadsheet.prototype.useServiceAccountAuth.mock.calls[0][0]).toEqual({
        client_email: 'serviceacct@gmail.com',
        private_key: 'google-private-key'
      })
    })
    it('uses the correct spreadsheet id', () => {
      expect(GoogleSpreadsheetReal).toHaveBeenCalledTimes(1)
      expect(GoogleSpreadsheetReal).toHaveBeenCalledWith('abcd-spreadsheet')
    })
    it('fetches the sheet', () => {
      expect(GoogleSpreadsheet.prototype.getInfo).toHaveBeenCalledTimes(1)
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
        variables: {
          owner: 'sammarks',
          name: 'cloudformation-github-sheets-sync',
          labels: ['reporting', 'two'],
          states: ['OPEN', 'CLOSED'],
          after: null
        }
      })
    })
    it('fetches the second page of Github issues', () => {
      expect(GraphQLClient.prototype.request).toHaveBeenNthCalledWith(2, IssuesQuery, {
        variables: {
          owner: 'sammarks',
          name: 'cloudformation-github-sheets-sync',
          labels: ['reporting', 'two'],
          states: ['OPEN', 'CLOSED'],
          after: 'two'
        }
      })
    })
    it('clears the sheet', () => {
      expect(mockSheet.clear).toHaveBeenCalledTimes(1)
    })
    it('bulk-updates the cells in the sheet', () => {
      expect(mockSheet.bulkUpdateCells).toHaveBeenCalledTimes(1)
      expect(mockSheet.bulkUpdateCells.mock.calls[0][0]).toEqual([
        { row: 1, col: 'A', value: 'number' },
        { row: 1, col: 'B', value: 'title' },
        { row: 1, col: 'C', value: 'state' },
        { row: 1, col: 'D', value: 'labels' },
        { row: 1, col: 'E', value: 'repository' },
        { row: 2, col: 'A', numericValue: 1 },
        { row: 2, col: 'B', value: 'One' },
        { row: 2, col: 'C', value: 'OPEN' },
        { row: 2, col: 'D', value: 'label' },
        { row: 2, col: 'E', value: 'cloudformation-github-sheets-sync' },
        { row: 3, col: 'A', numericValue: 2 },
        { row: 3, col: 'B', value: 'Two' },
        { row: 3, col: 'C', value: 'CLOSED' },
        { row: 3, col: 'D', value: 'label-two, label' },
        { row: 3, col: 'E', value: 'cloudformation-github-sheets-sync' },
        { row: 4, col: 'A', numericValue: 3 },
        { row: 4, col: 'B', value: 'Three' },
        { row: 4, col: 'C', value: 'OPEN' },
        { row: 4, col: 'D', value: 'label' },
        { row: 4, col: 'E', value: 'cloudformation-github-sheets-sync' }
      ])
    })
  })
  describe('when the sheet does not exist', () => {
    beforeEach(() => {
      GoogleSpreadsheet.prototype.getInfo
        .mockImplementationOnce((callback) => callback(null, {
          worksheets: [
            { title: 'test sheet' }
          ]
        }))
    })
    it('throws an error', () => {
      return expect(handler()).rejects.toThrow('Cannot find sheet with name \'Sheet\'')
    })
  })
})
