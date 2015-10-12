/*

  An easy-to-use fetch() function backed by a stateful "Fetcher"
  object which caches the data on disk. 

	SlowFetcher is good for debugging...

  Right now the disk format is JSON, which lets us just have one
  simple file for the headers AND the body and some metadata, but ...
  that's probably not so efficient if we ever had big data files.

*/

'use strict';
const fs = require('fs')
const https = require('https')
const http = require('http')
const url = require('url')
const util = require('util')
const path = require('path')
const mkdirp = require('mkdirp')
var debug = require('debug')('fetcher')

function Fetcher(options) {
	let defaults = {
		cachedir: "./webcache/",
		escapeSlash: true,
		assumeFresh: true,
		addHeaders: {},
		interval: 0
	}
	Object.assign(this, defaults)
	Object.assign(this, options)

	this.active = 0
	this.result = {}   // map from pageURL to result from last time
	this.dead = false
	this.useQueue = false
	if (this.interval) {
		this.useQueue = true
		this.queue = []
		setInterval(()=>{checkQueue(this)}, this.interval)
	}
}

let checkQueue = (fetcher) => {
	debug('checkQueue found', fetcher.queue.length, 'items')
	let args = fetcher.queue.shift()
	if (args) {
		debug('checkQueue running webFetch', args.url)
		webFetch(fetcher, args.url, args.cb)
	}
}

let addToFetchQueue = (fetcher, url, cb) => {
	fetcher.queue.push({url:url, cb:cb})
}


Fetcher.prototype.fetch = function (url, callback) {
	let fetcher = this

	let started = fetcher.result[url]
	if (started) {
		if (started.callbacks) {
			started.callbacks.push(callback)
		} else {
			callback(started)
		}
		return
	}
	started = { callbacks: [callback] }
	fetcher.result[url] = started

	fetcher.active++
	fetch(fetcher, url, (result) => {
		fetcher.active--
		debug('active =', fetcher.active)
		let callbacks = started.callbacks // others may have added some
		fetcher.result[url] = result
		debug('Fetcher.fetch doing', started.callbacks.length, 'callbacks')
		for (let cb of started.callbacks) {
			cb(result)
		}
		if (fetcher.active < 1) {
			debug('done 1')
			if (fetcher.ondone) {
				fetcher.ondone();
				debug('done 2')
			}
		}
	})
}

let fetch = (fetcher, pageURL, done) => {

	debug('fetch', pageURL)

	readFile(fetcher, pageURL, (diskResult) => {
		if (diskResult !== null && diskResult !== undefined) {
			debug('got from disk', pageURL)
			fetcher.result[pageURL] = diskResult
			diskResult.fromDisk = true
			done(diskResult)
		} else {
			let fetchfunc = webFetch
			if (fetcher.useQueue) {
				fetchfunc = addToFetchQueue
			}
			fetchfunc(fetcher, pageURL, done)
		}
	})
}

let webFetch = (fetcher, pageURL, done)=>{

	if (fetcher.dead) {
		return
	}
	
	let options = url.parse(pageURL)
	options.method = 'GET'
	options.headers = fetcher.addHeaders
	
	//debug(options)
	
	let buf = '';
	
	let mod = http
	if (options.protocol === 'https:') {
		mod = https
	}
	let req = mod.request(options, function(res) {
		debug("statusCode: ", res.statusCode);
		// debug("res: ", res);
		// debug("headers: ", res.headers);
		
		if (res.statusCode == 429 || res.statusCode >= 500) {
			if (! fetcher.dead) {
				if (fetcher.ondone) {
					setTimeout(fetcher.ondone, 1000)
				}
			}
			fetcher.dead = true
			console.log('You hit the rate limit.  Go away for an hour.')
			return   // WITHOUT calling done() since we don't want
			// to pass back this error 429
		}
		
		if (res.statusCode !== 200) {
			debug("HTTP ERR", pageURL)

			console.log('HTTP ERROR', res.statusCode)
			console.log('url: ', pageURL)
			console.log(res.headers)

			//return
			
			let result = {
				headers: {},
				data: null,
				url: pageURL,
				status: res.statusCode
			}
			// copy res.headers in case that object is re-used
			Object.assign(result.headers, res.headers) 
			fetcher.result[pageURL] = result
			writeFile(fetcher, pageURL, result, ()=>{})
			done(result)
			return
		}
		
		let remaining = res.headers['x-ratelimit-remaining']
		let q = 'not used'
		if (fetcher.useQueue) {
			q = fetcher.queue.length
		}
		console.log('remaining', remaining, 'queue', q)
		
		res.on('data', function(d) {
			buf += d
		})
		
		res.on('end', function() {
			
			let result = {
				headers: {},
				data: buf,
				url: pageURL
			}
			
			// try this...
			try {
				let json = JSON.parse(buf)
				result.data = json
			} catch (e) { }
			
			// copy res.headers in case that object is re-used
			Object.assign(result.headers, res.headers) 
			fetcher.result[pageURL] = result
			writeFile(fetcher, pageURL, result, ()=>{
				// slow down a little, and wait for the write to complete
				// making things a little less insanely parallel
				done(result)
			})
		});
	});
	req.on('error', function(e) {
		debug('error doing', startpath);
		console.error(e);
		done(e);
	});
	req.end();
}
			
let escape0 = (str) => {
  return str.replace(/[^-a-zA-Z0-9?:=]/g, function (escape) {
      return '_' + (escape.charCodeAt().toString(16))+"_"
  });
}

let escape1 = (str) => {
  return str.replace(/[^-a-zA-Z0-9?.:=]/g, function (escape) {
      return '_' + (escape.charCodeAt().toString(16))+"_"
  });
}

let escape2 = (str) => {
	return str.replace(/[^-a-zA-Z0-9?.:=/]/g, function (escape) {
      return '_' + (escape.charCodeAt().toString(16))+"_"
  });
}

let filename = (fetcher, url) => {
	let safeurl
	if (fetcher.escapeSlash) {
		safeurl = escape1(url)
	} else {
		safeurl = escape2(url)
	}
	let base = path.resolve(process.cwd(), fetcher.cachedir)
	let f = path.resolve(base, safeurl)
	f = f+"__.json"
	//debug('base', base, f.slice(0,base.length))
	if (f.slice(0,base.length) === base) {
		return f
	} else {
		safeurl = escape0(url)
		f = path.resolve(base, safeurl)
		return f
	}
}

// let x=""; fs.readFile('/home/sandro/Repos/w3c-api-crawler/webcache/https:/api-test.w3.org/users/gzwg8r0aths8k88skgoocko8go0o4ws__.json', function(err,data) { x=data })

let readFile = (fetcher, url, done) => {
	let f = filename(fetcher, url)
	fs.readFile(f, function(err, data) {
		debug('readfile', f)
		if (err) {
			// assume it ENOENT, ie file not found
			// console.log('readilfe error', err, f)
			done(null)
		} else {
			if ( data == '' ) {
				console.log('empty file -- probably fetcher was interrupted during write')
				done(null)
			} else {
				let returnVal
				try {
					let p = JSON.parse(data)
					returnVal = p
				} catch (e) {
					console.log('\n',e)
					console.log('warning: non JSON save file at', f)
					let d = data.toString()
					d = JSON.stringify(d)
					console.log("\n\nJSON.parse(",d,")\n\n")
				}
				done(returnVal)
			}
		}
	})
}

let writeFile = (fetcher, url, result, done) => {
	let f = filename(fetcher, url)
	let dir = path.dirname(f)
	debug('doing mkdir', dir, f);
	mkdirp(dir,0o700, (err, made) => {
		debug('did mkdir', err, f)
		if (err) {
			debug('mkdirp error:', err)
		}
		fs.writeFile(f, JSON.stringify(result,null,4), () => {
			debug('saved to', f)
			done()
		})
	})
}

exports.Fetcher = Fetcher

