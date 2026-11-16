import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../public/assets/three.module.js';import {createWalkSurface} from '../public/walk-surface.js';
test('walking stands on actual bridge deck, while water and gaps cannot be traversed',()=>{
 const g=new T.PlaneGeometry(1,.2);g.rotateX(-Math.PI/2);const bridge=new T.Mesh(g,new T.MeshStandardMaterial());bridge.position.y=.3;bridge.updateMatrixWorld();const surface=createWalkSurface([bridge]);
 assert.ok(Math.abs(surface.height(0,0)-.3)<1e-6);assert.equal(surface.height(0,.3),null);assert.ok(surface.segment({x:-.4,z:0},{x:.4,z:0}));assert.equal(surface.segment({x:0,z:0},{x:0,z:.3}),false);
});
test('sole support queries select the current deck layer beside a higher overlapping platform',()=>{
 const floor=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshStandardMaterial());const upper=floor.clone();upper.position.y=2/40;const deck=createWalkSurface([floor,upper]);assert.ok(Math.abs(deck.height(0,0)-2/40)<1e-7);assert.equal(deck.height(0,0,0),0);
});
