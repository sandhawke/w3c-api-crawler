'use strict'
var assert = require("chai").assert
var medium = require("../medium")

describe('fetchObject', function() {
	
	it('should load Melvins profile from api-test.w3.org', function(done) {
		// I picked Melvin because he was the person I know best from the
		// random sample of user hashes I had
		let obj = { 'href': 'https://api-test.w3.org/users/srekwclwff48ws0g4g8wow8ow88cwko' }
		medium.fetchObject(obj, ()=>{
			//console.log(obj)
			assert(obj.name, 'Melvin Carvalho')
			assert(obj.given, 'Melvin')
			assert(obj.family, 'Carvalho')
			assert(obj.self.href, obj.href)  // DIDNT MAKE IT *SAME* OBJ YET
			assert(obj.photos[0].href, 'https://www.w3.org/2006/05/u/46b496bdc1aa.jpg')
			done()
		})
	})
})

describe('fetchList', () => {
	
	it('should fetch the top-level list of groups', (done)=>{
		let groupsURL = 'https://api-test.w3.org/groups'
		let obj = { groups: { href: groupsURL } }
		let count = 0
		medium.fetchList(obj, 'groups', 
						 (group) => {
							 // console.log(group)
							 count++
						 },
						 (all) => { 
							 assert.lengthOf(all, obj.groups.total)
							 assert.equal(count, obj.groups.total)
							 done() 
						 })
	})

	/*
	it('should replaced ?items=...', (done)=>{
		let groupsURL = 'https://api-test.w3.org/groups?items=1'
	})
	*/

	it('should fetch melvins groups', (done)=>{
		let melvin = { 'href': 'https://api-test.w3.org/users/srekwclwff48ws0g4g8wow8ow88cwko' }
		let groups = []
		let groupNames = {}
		medium.fetchObject(melvin, ()=>{
			medium.fetchList(melvin, 'groups', 
							 (group) => {
								 //console.log('melvin in group', group)
								 groups.push(group)
								 groupNames[group.title] = true
							 },
							 (all) => {
								 //console.log('melvin.groups', melvin.groups)
								 assert.equal(all, melvin.groups.all)
								 assert.equal(all[0], groups[0])
								 assert.equal(all[10], groups[10])
								 assert.equal(all[31], groups[31])
								 assert.deepEqual(all, groups)
								 assert.lengthOf(all, melvin.groups.total)
								 
								 // will fail if Melvin leaves these groups!
								 assert(groupNames['WebID Community Group'])
								 assert(groupNames['Social Web Working Group'])
								 assert(groupNames['Augmented Reality Community Group'])
								 done()
							 })
		})
	})

	it('should get someones affiliations', (done)=>{
		// at random
		let person = { 'href': 'https://api-test.w3.org/users/kc0dbwhntb4gksk8ckog888cs04cg0k
' }
		medium.fetchObject(person, ()=>{
			medium.fetchList(person, 'affiliations', null,
							 (all) => {
								 console.log('affil', all)
								 assert.equal(all[0].title, 'Ministério do Planejamento')
	})
})