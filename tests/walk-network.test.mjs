import test from 'node:test';import assert from 'node:assert/strict';import {createWalkNetwork} from '../public/partner/walk-network.js';
test('mapped seams connect coordinate-identical IDs and short dry gaps while water stays separate',()=>{
 const paths=[[[0,0],[1,0]],[[1,0],[2,0]],[[2.05,0],[3,0]],[[3.05,0],[4,0]]];
 const graph=createWalkNetwork(paths,[['a','b'],['c','d'],['e','f'],['g','h']],(a,b)=>!(Math.min(a.x,b.x)<3.04&&Math.max(a.x,b.x)>3.01));
 const start=graph.snap({x:.2,z:0}),dry=graph.snap({x:2.8,z:0}),wet=graph.snap({x:3.8,z:0});assert.ok(graph.route(start,dry));assert.equal(graph.route(start,wet),null);assert.ok(graph.stitched>0);
});
test('end of side road can join the middle of a dry main road',()=>{
 const graph=createWalkNetwork([[[0,0],[2,0]],[[1,.5],[1,.03]]],[[],[]]);assert.ok(graph.route(graph.snap({x:.1,z:0}),graph.snap({x:1,z:.4})));
});
