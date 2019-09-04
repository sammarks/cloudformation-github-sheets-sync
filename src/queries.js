module.exports.IssuesQuery = `
  query issues(
    $owner: String!
    $name: String!
    $labels: [String!]
    $states: [IssueState!]
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      issues(
        labels: $labels
        states: $states
        orderBy: {
          field: CREATED_AT
          direction: DESC
        }
        first: 10
        after: $after
      ) {
        edges {
          cursor
          node {
            number
            title
            state
            labels(first: 100) {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }
  }
`
