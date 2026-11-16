export const ORIGIN={lat:30.245,lon:120.140,scale:.01};
export function latLonToScene(lat,lon){return {x:(lon-ORIGIN.lon)*111320*Math.cos(ORIGIN.lat*Math.PI/180)*ORIGIN.scale,z:-(lat-ORIGIN.lat)*111320*ORIGIN.scale};}
export function sceneToLatLon(x,z){return {lat:ORIGIN.lat-z/(111320*ORIGIN.scale),lon:ORIGIN.lon+x/(111320*Math.cos(ORIGIN.lat*Math.PI/180)*ORIGIN.scale)};}
