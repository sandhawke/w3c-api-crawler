'use strict'

const d = require('./dataset')

let names = []
let byName = {}
for (let u of d.users) {
  let name = u.family + ', ' + u.given
  names.push(name)
  byName[name] = u
}
names.sort(function (a, b) {
  return a.localeCompare(b)
})

for (let name of names) {
  let user = byName[name]
  console.log(user.name)
  // the dataset doesn't know it's an array if it's in progress
  if (user.groups && Array.isArray(user.groups)) {
    for (let group of user.groups) {
      console.log('  ' + group.name)
    }
  }
}
