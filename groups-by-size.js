'use strict'

const d = require('./dataset')

let groups = []
for (let g of d.pages) {
  if (g && g.discr === 'w3cgroup' && g.users && g.users.length) {
    groups.push(g)
  }
}
groups.sort( (a,b) => {
  return (b.users.length) - (a.users.length)
})

for (let g of groups) {
  let users = g.users
  console.log(users.length, g.name)
  if (false) {
    for (let u of users) {
      console.log('    ', u.name)
    }
  }
}
