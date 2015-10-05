'use strict'
var assert = require("chai").assert
var looper = require("../looper")

describe('looper', () => {

	it('alice tests', (done)=>{
		let alice = { name:'alice' }
		let bob = { name:'bob' }
		let charlie = { name:'charlie' }
		let dawn = { name:'dawn' }
		
		alice.likes = [bob,dawn]
		bob.likes = [alice, charlie]
		charlie.likes = [charlie, alice]
		dawn.likes = [bob, bob, bob]
		alice.mom = dawn
		alice.dad = bob
		bob.dad = charlie
		
		looper.unloop(alice)
		// removeUnusedIds(alice)
		//console.log(JSON.stringify(alice,null,4))
		done()
	})
	
	
	it('sandro tests', (done)=>{
		let sandro = { name: 'Sandro Hawke' }
		sandro.self = sandro
		let ivan = { name: 'Ivan Herman' }
		let harry = { name: 'Harry Halpin' }
		let rdfwg = { name: 'rdfwg', title: 'RDF Working Group', staff: [sandro,ivan] }
		let socwg = { name: 'socwg', title: 'Social Web Working Group', staff: [sandro,harry] }
		let data = { groups: [rdfwg, socwg] }
		
		looper.unloop(data)
		// removeUnusedIds(data)
		//console.log(JSON.stringify(data,null,4))
		// looper.reloop(data)
		////console.log('RELOOPED', JSON.stringify(data,null,4))
		looper.unloop(data)
		//removeUnusedIds(data)
		//console.log('DELOOPED', JSON.stringify(data,null,4))
		
		done()
	})
	
})