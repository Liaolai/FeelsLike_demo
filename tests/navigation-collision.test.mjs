import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/assets/three.module.js';
import {createNavigationCollision} from '../public/navigation-collision.js';
function box(root,name,x,y,z,w,h,d){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial());m.name=name;m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;}
const point=(x,y=0,z=0)=>new T.Vector3(x,y,z);
test('capsule blocks thin walls and columns without filling an open doorway',()=>{
 const root=new T.Group();box(root,'left wall',-1,1,0,1,2,.03);box(root,'right wall',1,1,0,1,2,.03);box(root,'door lintel',0,2.3,0,1,0.2,.03);box(root,'pillar',3,1,0,.12,2,.12);
 const field=createNavigationCollision(root,{unit:1});assert.equal(field.blocked(point(0)),false);assert.equal(field.segment(point(0,0,-1),point(0,0,1)),true);assert.equal(field.segment(point(-1,0,-1),point(-1,0,1)),false);assert.equal(field.blocked(point(2.75)),true);assert.equal(field.blocked(point(2.5)),false);
});
test('walk platforms and overhead roofs clear the body; low rails block it',()=>{
 const root=new T.Group();box(root,'stone platform',0,-.1,0,4,.2,4);box(root,'tile roof',0,2.5,0,4,.2,4);box(root,'railing',1,.45,0,.03,.1,1);
 const field=createNavigationCollision(root,{unit:1});assert.equal(field.blocked(point(0)),false);assert.equal(field.segment(point(.3),point(1.3)),false);assert.equal(field.segment(point(0),point(0,0,1)),true);
});
test('actual instanced trunk transforms collide, crowns, water and ignored groups do not',()=>{
 const root=new T.Group(),trunks=new T.InstancedMesh(new T.CylinderGeometry(.1,.1,2,8),new T.MeshStandardMaterial(),2);trunks.name='Regional tree trunks';trunks.setMatrixAt(0,new T.Matrix4().makeTranslation(1,1,0));trunks.setMatrixAt(1,new T.Matrix4().makeTranslation(3,1,0));root.add(trunks);
 box(root,'Regional canopies',0,1,0,1,2,1);box(root,'West Lake water',0,0,0,8,.1,8);const ignored=new T.Group();ignored.userData.navigationIgnore=true;box(ignored,'wall',0,1,1,2,2,2);root.add(ignored);
 const field=createNavigationCollision(root,{unit:1});assert.equal(field.counts.trunk,2);assert.equal(field.blocked(point(1)),true);assert.equal(field.blocked(point(0)),false);assert.equal(field.blocked(point(0,0,1)),false);
});
test('closed city-building volume blocks embedded starts without making an open pavilion solid',()=>{
 const root=new T.Group();box(root,'Batched city buildings',0,2,0,4,4,4);const pavilion=new T.Group();box(pavilion,'roof',7,2.6,0,4,.2,4);box(pavilion,'column',5.5,1.2,-1.5,.2,2.4,.2);root.add(pavilion);
 const field=createNavigationCollision(root,{unit:1});assert.equal(field.blocked(point(0)),true);assert.equal(field.blocked(point(7)),false);assert.equal(field.blocked(point(0,4.1)),false);
});
test('capsule follows slope height without treating ground triangles as walls; invalid coordinates fail closed',()=>{
 const root=new T.Group();box(root,'wall',0,3,0,1,1,1);const field=createNavigationCollision(root,{unit:1});assert.equal(field.segment(point(-2,0,0),point(2,0,0)),true);assert.equal(field.segment(point(-2,2,0),point(2,2,0)),false);assert.equal(field.blocked(point(NaN)),true);assert.equal(field.segment(point(0),point(Infinity)),false);
});
