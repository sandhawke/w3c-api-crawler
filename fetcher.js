/*

  An easy-to-use fetch() function backed by a stateful "Fetcher"
  object which caches the data in memory and on disk.  Also, rate
  limits, so you can fetch thousands of things at once and it'll only
  use the number of "threads" you specify.

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

function trace() {
	console.log.call(console, arguments)
}

function Fetcher(options) {
	let defaults = {
		cachedir: "./webcache/",
		escapeSlash: true,
		assumeFresh: true,
		addHeaders: {},
		threads: 1,
		threadPauseMS: 1000
	}
	Object.assign(this, defaults)
	Object.assign(this, options)

	this.active = 0
	this.result = {}   // map from pageURL to result from last time

}

Fetcher.prototype.fetch = function (url, callback) {
	let that = this
	that.active++
	fetch(that, url, (result) => {
		if (callback) { callback(result) }
		that.active--
		trace('active =', that.active)
		if (that.active < 1) {
			trace('done 1')
			if (that.ondone) { that.ondone(); 			trace('done 2') }
		}
	})
}

let fetch = (fetcher, pageURL, done) => {

	//trace('fetch', pageURL)

	// if it got loaded into the ram cache, nothing to do
	// [ SHOULD CHECK IF STALE ]
	if (fetcher.result[pageURL]) {
		let result = fetcher.result[pageURL]
		result.fromMemory = true
		done(result)
		return
	}

	readFile(fetcher, pageURL, (diskResult) => {
		if (diskResult !== null) {
			trace('got from disk', pageURL)
			fetcher.result[pageURL] = diskResult
			diskResult.fromDisk = true
			done(diskResult)
		} else {
			
			let options = url.parse(pageURL)
			options.method = 'GET'
			options.headers = fetcher.addHeaders
			
			//trace(options)

			let buf = '';
			
			let mod = http
			if (options.protocol === 'https:') {
				mod = https
			}
			let req = mod.request(options, function(res) {
				trace("statusCode: ", res.statusCode);
				// trace("res: ", res);
				// trace("headers: ", res.headers);
				
				if (res.statusCode !== 200) {
					trace("HTTP ERR")
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
				console.log('remaining', remaining)
				
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
					writeFile(fetcher, pageURL, result, ()=>{})
					done(result)
				});
			});
			req.on('error', function(e) {
				trace('error doing', startpath);
				console.error(e);
				done(e);
			});
			req.end();
		}})
			
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
	//trace('base', base, f.slice(0,base.length))
	if (f.slice(0,base.length) === base) {
		return f
	} else {
		safeurl = escape0(url)
		f = path.resolve(base, safeurl)
		return f
	}
}

let readFile = (fetcher, url, done) => {
	//trace('readfile', url)
	fs.readFile(filename(fetcher, url), function(err, data) {
		if (err) {
			done(null)
		} else {
			let p = JSON.parse(data)
			done(p)
		}
	})
}

let writeFile = (fetcher, url, result, done) => {
	let f = filename(fetcher, url)
	let dir = path.dirname(f)
	trace('saving to', f)
	mkdirp(dir,0o700, () => {
		fs.writeFile(f, JSON.stringify(result,null,4), done)
	})
}

exports.Fetcher = Fetcher

