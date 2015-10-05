/*

*/
'use strict'

const fs = require('fs')
const fetcher = require('./fetcher')

function trace() {
	// console.log.call(console, arguments)
}

let headers = {
	Authorization: 'W3C-API apikey="3fv3wwwplyg4skgocsoocc4g0wkcsc8"',
	Accept: 'text/json'
}

let f = new fetcher.Fetcher({threads:10, addHeaders:headers, escapeSlash:false})


// obj.href must be the URL of the JSON to use to fill in the rest of
// the properties.  When that's done, call cb.  Also, copy
// obj._links[x] to obj[x], so we don't need to use _links.
let fetchObject = (obj, cb) => {
	f.fetch(obj.href, (result) => {
		Object.assign(obj, result.data, result.data._links)
		cb(obj)
	})
}


// obj._links[prop].href must be the URL of some JSON d, which has
// successive pages of d._links.next.href and each one has
// d._links[prop] as an array of items.  Make it so
// obj._links[prop].all (and obj[prop].all) is an array of those
// items.  Call cbeach with each item once its known (which can call
// fetchObject on it, etc) and cbdone when the end of the .next is
// done and every cbeach has been called
let fetchList = (obj, prop, cbeach, cbdone) => {
	let url = obj[prop].href
	let all = []
	obj[prop].all = all
	fetchListPage(url, obj, prop, all, cbeach, cbdone)
}

let fetchListPage = (url, obj, prop, all, cbeach, cbdone) => {
	trace('fetchListPage', prop, url)
	f.fetch(url, (result) => {
		// console.log(result)
		obj[prop].total = result.data.total
		let items = result.data._links[prop]
		if (cbeach) { items.forEach(cbeach) }
		Array.prototype.push.apply(all, items)
		let next
		try {
			next = result.data._links.next.href
		} catch (e) { }
		if (next) {
			fetchListPage(next, obj, prop, all, cbeach, cbdone)
		} else {
			if (cbdone) { cbdone(all) }
		}
	})
}

exports.fetchObject = fetchObject
exports.fetchList = fetchList