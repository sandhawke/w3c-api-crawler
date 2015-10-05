'use strict'
/*

  I wrote this before discovering cycle.js which does about the same
  thing.  This modify-in-place technique might be better in some ways,
  so I'll keep it around and might use it.

  Might be better because of:
  - performance
  - security issue with the eval implementation of jsonpath
  - using numbers for refs instead of jsonpath might appeal to some folks


  unloop(obj):  Converts circular structure obj to a form that can be
  output as JSON.   Also avoids repeating lattice nodes.

  reloop(obj): the reverse operation

  MODIFIES OBJECTS IN PLACE.  Does not return anything.

*/

function hasKeys(x) {
	let t = typeof x
	return (t === 'object' || t === 'function')
}
function deloop(node, state) {
	if (!state) {
		state = { count: 0 }
	}

	//console.log('node:', typeof node,  node)

	if (hasKeys(node)) {
		if (node._id) {
			throw "AlreadyDeLooped"
		}
		node._id = ++(state.count)
		//console.log('assigned count', state.count)

		for (let prop in node) {
			let val = node[prop]
			//console.log('prop', prop)
			if (hasKeys(val)) {
				if (val._id) {
					node[prop] = { _ref: val._id }
					val._ref_used = true
				} else {
					deloop(val, state)
				}
			} else {
				//console.log('..atomic')
			}
		}
	} else {
		//console.log('root is atomic')
	}
}


function removeUnusedIds(node) {

	if (hasKeys(node)) {
		for (let i in node) {
			removeUnusedIds(node[i])
		}
		if (node._ref_used) {
			delete node._ref_used
		} else {			
			delete node._id
		}
	}
}

exports.unloop = (node) => {
	deloop(node)
	removeUnusedIds(node)
}

/*
exports.reloop = (node) => {
	let table = {}
	buildTable(node, table);
	reloopUsingTable(node, table);
}

//  @@@ NOT DONE
function reloop(node, table) {
	if (!table) {
		table = {}
	}
	table[node._id] = node
	if (hasKeys(node)) {
		for (let key in node) {
			let ref = node[key]._ref
			if (ref) {
				node[key] = table[ref]
			} else {
				reloop(node[key], table)
			}
		}
	}

}

*/