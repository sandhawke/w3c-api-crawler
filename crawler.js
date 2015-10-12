/*

  Crawl something like api.w3.org to produce w3cdata.json, which has
  the same data in one structure.

	BUGS?
	
	-- with 10k fetches done, I only have 7301 files on disk.  How is that?

*/
'use strict'

const fs = require('fs')
const fetcher = require('./fetcher')

var debug = require('debug')('crawler')

let headers = {
	Authorization: 'W3C-API apikey="3fv3wwwplyg4skgocsoocc4g0wkcsc8"',
	Accept: 'text/json'
}

let f = new fetcher.Fetcher({addHeaders:headers, escapeSlash:false, interval:50})

let siteURL = 'https://api-test.w3.org/'
let groupsURL = 'https://api-test.w3.org/groups'
let w3cdata = { _links: { groups: { href: groupsURL } } }
let pages = {}

const exampleContainer = {
  "page": 1,
  "limit": 30,
  "pages": 1,
  "total": 6,
  "_links": {
    "up": {
      "href": "https://api-test.w3.org/groups/52722"
    },
    "services": [
      {
        "href": "https://api-test.w3.org/services/973",
        "title": "Wiki"
      },
      {
                    "href": "https://api-test.w3.org/services/974",
                    "title": "RSS"
                },
                {
                    "href": "https://api-test.w3.org/services/975",
                    "title": "Chat"
                },
                {
                    "href": "https://api-test.w3.org/services/976",
                    "title": "Mailing Lists"
                },
                {
                    "href": "https://api-test.w3.org/services/977",
                    "title": "Mailing Lists"
                },
                {
                    "href": "https://api-test.w3.org/services/978",
                    "title": "Mailing Lists"
                }
            ],
            "self": {
                "href": "https://api-test.w3.org/groups/52722/services?page=1&items=30"
            },
            "first": {
                "href": "https://api-test.w3.org/groups/52722/services?page=1&items=30"
            },
            "last": {
                "href": "https://api-test.w3.org/groups/52722/services?page=1&items=30"
            }
        }
    }

/*   
		 Is this a "container" page?  Has the side effect, if it is, of
		 adding ._items and .itemProperty to make it easier to deal with
		 in the future.
		 
		 Container pages look something like exampleContainer, above
		 
		 In this example, the .itemProperty would be set to "services".
*/
let isContainer = (page) => {
	if (page._items) {
		// already flagged
		return true
	}
	let keys = Object.keys(page)
	if (keys.length === 6 &&    // there's the .id we added
			page._links !== undefined &&
			page.limit !== undefined &&
			page.page !== undefined &&
			page.pages !== undefined &&
			page.total !== undefined) {
		// it's got all the right properties.  
		let prop = null
		for (let key of Object.keys(page._links)) {
			if (key === "self" || key === "first" || key === "last" ||
					key === "next" || key === "previous" || key === "up") {
				continue
			}
			if (prop === null) {
				prop = key
			} else {
				console.log("WARNING: Extra keys, can't figure out which is the iteration property:", prop, key)
			}
		}

		// prop MIGHT be null from api.w3.org.   I guess this is one way
		// and empty list is done.
		// 'https://api-test.w3.org/groups/71714/chairs?page=1&items=100'

		debug('decided iteration property is', prop)
		page._itemProperty = prop
		page._items = []
		return true
	} else {
		if (page.page) {
			throw "ERROR: page.page on a non-container!  Suspicious."
		}
		return false
	}
}

let gatherPages = (thisPage, firstPage, cb) => {

	if (firstPage._itemProperty === null) {
		cb()
		return
	}
	
	// add the items on this page to _items on the firstpage
	let newItems = thisPage._links[firstPage._itemProperty]
	//debug('gather', firstPage._itemProperty, thisPage)
	debug('got', newItems.length,'items on page', thisPage.page, 'of', thisPage.pages)
	Array.prototype.push.apply(firstPage._items, newItems)
														 

	// if there is a next page, recursively gather there, too
	let next = thisPage._links.next
	if (next) {
		next = next.href
		debug('there\'s a next page', next)
		f.fetch(next, (result) => {
			gatherPages(result.data, firstPage, cb)
		})
	} else {
		// or if there is no next page, we're finally done
		cb()
	}

}

// assuming obj.href is defined, make sure the other properties are
// defined, then call cb.  If it's a collection, then get all the
// pages of the collection and gather them into _items before calling
// cb
let fill = (obj, cb) => {

	let href = obj.href
	if (pages[href]) {
		// dont call the callback; that's how we signal already done
		return
	}
	if (href.slice(0,siteURL.length) !== siteURL) {
		debug('skipping off-site URL', href)
		return
	}
	
	pages[href] = "in progress"

	f.fetch(href, (result) => {
		let page = result.data
		if (typeof page !== "object") {
			debug('page not object', href, typeof page)
			return
		}
		if (page === null) {
			// like a 404, it went away, huh...
			return
		}
		page.id = href
		//debug('got data', page)

		if (isContainer(page)) {
			gatherPages(page, page, ()=> {
				pages[href] = page
				cb(page)
			})
		} else {
			pages[href] = page
			cb(page)
		}
	})
}

/*
if (isContainer(exampleContainer)) {
	debug('exampleContainer: ', exampleContainer)
}
if (isContainer({page:3})) {
}
*/

let filled = (page) => {
	console.log('filled', page.id)
	if (page._items) {
		debug('page filled, doing items', page.id)
		for (let item of page._items) {
			fill(item, filled)
		}
	} else {
		let links = page._links
		if (links) {
			debug('page filled, doing links', page.id, page)
			for (let prop of Object.keys(links)) {
				debug('prop', prop)
				let val = links[prop]
				debug('link', prop, val)
				if (Array.isArray(val)) {
					debug('iterating over array value')
					for (let item of val) {
						fill(item, filled)
					}
				} else {
					fill(val, filled)
				}
			}
		} else {
			debug('page filled, has no links', page)
		}
	}
}

let file = 'w3c-api-pages.json'
let save = () => {
	debug("writing", file)
	fs.writeFile(file,
							 JSON.stringify(pages,null,4),
							 ()=>{	
								 console.log(file, "written")
								 process.exit()
							 });

}

// setTimeout(save, 10000)

f.ondone = save
filled(w3cdata)



