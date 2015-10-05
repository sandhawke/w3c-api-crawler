/*

  Crawl api.w3.org to produce w3cdata.json, which has the same data in
  one structure.    Use cycle.retrocycle (or looper.reloop) to properly
  re-loop it.

  If the API ratelimit is hit, run again in an hour or with a
  different API key.

*/
'use strict'

const fs = require('fs')
const medium = require('./medium')

function trace() {
	console.log.call(console, arguments)
}

let groupsURL = 'https://api-test.w3.org/groups'
let w3cdata = { groups: { href: groupsURL } }
let count = 0

let eachGroup = (g)=>{
	if (g.title.slice(0,5) === 'Hydra' || g.title[0] === 'A') {
		medium.fetchObject(g, ()=>{
			//console.log("TITLE", g.title, g)
			if (g.users) { medium.fetchList(g, 'users', eachUser) }
			if (g.services) { medium.fetchList(g, 'services') }
		})
	}
}

let allAffils = (affils)=>{
	if (affils.length > 1) {
		console.log("LONG AFFILS", affils)
	}
}

let eachUser = (u)=>{
	medium.fetchObject(u, ()=>{
		medium.fetchList(u, 'affiliations', null, allAffils)
	})
}
				 
medium.fetcher.ondone = ()=>{
	console.log('fetcher has gone quiet, saving data')
	fs.writeFile('w3cdata.json', 
				 JSON.stringify(w3cdata,null,4),
				 ()=>{	
					 console.log('w3cdata.json written')
					 // process.exit() 
				 }
				)			

}

medium.fetchList(w3cdata, 'groups', eachGroup)


