/*

  read the crawler outut (w3c-api-pages.json) and produce a js file
  which, which loaded, creates a graph-structure.  That is, every time
  we have { href = foo } we replace it with the object named foo.  We
  also remove the _links indirection.

  A note on the output format: it used to be like iNNNNN and I changed
  it to p[NNNNN] and it got about 15% faster to load.  So I think the
  array form is pretty good.

 */
'use strict'

const fs = require('fs')
const debug = require('debug')('hrefloop')

let file = 'w3c-api-pages.json'

let varname = {}

let hrefLoopItem = (pages, parent, prop) => {
  let href = parent[prop].href
  if (href && varname[href]) {
    parent[prop] = '!JSON-ESCAPE! ' + varname[href]
  }
}

let hrefLoop = (pages) => {
  let n = 10000
  for (let url in pages) {
    varname[url] = 'p[' + (n++) + ']'
  }
  for (let url in pages) {
    let page = pages[url]
    debug(url)
    if (page === 'in progress') {
      debug('  in progress')
      continue
    }
    if (Array.isArray(page)) {
      for (let i in page) {
        debug('  ', i)
        hrefLoopItem(pages, page, i)
      }
    } else {
      let links = page._links
      if (links) {
        debug('doing links', page.id, page)
        for (let prop of Object.keys(links)) {
          let val = links[prop]
          debug('link', prop, val)
          if (Array.isArray(val)) {
            debug('iterating over array value')
            for (let i in val) {
              debug('  ', prop, i)
              hrefLoopItem(pages, page._links[prop], i)
            }
          } else {
            debug('  ', prop)
            hrefLoopItem(pages, page._links, prop)
          }
        }

        // move the _links up to the page itself, thanks!
        for (let prop of Object.keys(links)) {
          page[prop] = links[prop]
        }
        delete page._links
      }
    }
  }
}

// do a pass turning container pages into arrays
let arrayify = (pages) => {
  for (let url in pages) {
    let page = pages[url]
    if (page._items) {
      pages[url] = page._items
    }
  }
}

let regex = /"!JSON-ESCAPE! (.+)"/
let desc = (s1) => {
  let s2 = ''
  // v8 doesn't respect the /g flag ?!?!
  while (true) {
    s2 = s1.replace(regex, '$1')
    if (s2 === s1) return s2
    s1 = s2
  }
}

fs.readFile(file, (err, data) => {
  if (err) {
    throw err
  }
  data = JSON.parse(data)

  arrayify(data)

  hrefLoop(data)

  // console.log('// hrefloop returned', looped, ip, inprog, notref)
  // hrefloop returned 17415 16499 16827 5796

  let varnameList = []
  let urls = {}
  for (let url in data) {
    let v = varname[url]
    urls[v] = url
    varnameList.push(varname[url])
  }
  varnameList.sort()
  let out = fs.createWriteStream('dataset.js')

  out.write('// First, create each of the objects in memory, with a name,\n')
  out.write('// so we can create cycles and shared references, below.\n')
  out.write('var p=[]\n')
  for (let v of varnameList) {
    let url = urls[v]
    let d = data[url]
    let blank = '{}'
    if (Array.isArray(d)) {
      blank = '[]'
    }
    out.write(v + '=' + blank + '\n')
  }

  out.write('\n// Now, set the values of each of those objects')
  for (let v of varnameList) {
    let url = urls[v]
    let d = data[url]
    if (Array.isArray(d)) {
      if (d.length === 0) continue
      out.write('\n\nArray.prototype.push.apply(')
    } else if (typeof d === 'object') {
      out.write('\n\nObject.assign(')
    } else if (d === 'in progress') {
      out.write('\n\n// not yet downloaded -- ')
    } else {
      console.error('bad data value', d)
    }
    out.write(v + ', ' + desc(JSON.stringify(d, null, 2)) + ')')
  }

  out.write('\n\nvar users = [\n')
  let users = []
  for (let url in data) {
    let page = data[url]
    if (page.discr === 'user') {
      users.push(varname[url])
    }
  }
  out.write(users.join(',\n  '))
  out.write(']\n')

  out.write('\nexports.groups=' + varname['https://api-test.w3.org/groups'] + '\n')
  // out.write('\nexports.specifications='+varname['https://api-test.w3.org/specifications']+'\n')
  // out.write('\nexports.domains='+varname['https://api-test.w3.org/domains']+'\n')
  out.write('\nexports.users=users\n')
  out.write('\nexports.pages=p\n')
})
