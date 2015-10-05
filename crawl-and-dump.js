/*

  Crawl api.w3.org to produce w3cdata.json, which has the same data in
  one structure.    Use cycle.retrocycle (or looper.reloop) to properly
  re-loop it.

  If the API ratelimit is hit, run again in an hour or with a
  different API key.

*/
'use strict'

const fs = require('fs')
const fetcher = require('./simplefetcher')

function trace() {
	console.log.call(console, arguments)
}

let w3cdata = { groupsByHref: {}, group: {}, users: {} }

let headers = {
	Authorization: 'W3C-API apikey="3fv3wwwplyg4skgocsoocc4g0wkcsc8"',
	Accept: 'text/json'
}

let f = new fetcher.Fetcher({threads:10, addHeaders:headers, escapeSlash:false})

function general(result) {
	let remaining = result.headers['x-ratelimit-remaining']
	trace('remaining', remaining)
	// let p = JSON.parse(result.data)
	let p = result.data
	trace('from', result.url)
	trace('data', JSON.stringify(p,null,4))
}

function askForNext(result, cb) {
	try {
		f.fetch(result.data._links.next.href, cb)
	} catch (e) {
		if (!(e instanceof TypeError)) { 
			trace('askForNext error', e)
			throw e 
		}
	}
}

function handleGroups(result) {
	general(result)
	askForNext(result, handleGroups)

	let newGroups = result.data._links.groups
	for (let g of newGroups) {
		w3cdata.groupsByHref[g.href] = g
		trace('group', g)
		if (true || g.title.slice(0,5) === 'Hydra') {
			trace('**** H')
			f.fetch(g.href, handleGroup)
		}
	}
}

function handleGroup(result) {
	general(result)

	trace('GOT GROUP', result)
	w3cdata.group[result.data.id] = result.data
	f.fetch(result.data._links.users.href, (ures, ucb) => {
		handleUsers(result.data, ures, ucb)})
	// services, chairs
}

function handleUsers(groupData, result) {
	general(result)
	askForNext(result, (ures, ucb) => {
		handleUsers(result.data, ures, ucb)})
	
	trace('GOT USERS', result)
	let newUsers = result.data._links.users
	for (let u of newUsers) {
		w3cdata.users[u.href] = u
		trace('user', u)
		f.fetch(u.href, handleUser)
	}
}

function handleUser(result) {
	general(result)

	trace('GOT USER', result)
	w3cdata.users[result.data._links.self.href] = result.data
	// follow links?
}

f.ondone = ()=>{
	console.log('done 1.1')
	fs.writeFile('w3cdata.json', 
				 JSON.stringify(w3cdata,null,4),
				 ()=>{	
					 console.log('done 4')
					 console.log('w3cdata.json written')
					 // process.exit() 
				 }
				)			

}

f.fetch('https://api-test.w3.org/groups?items=100', handleGroups);
