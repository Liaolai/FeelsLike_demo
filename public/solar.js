// NOAA fractional-year approximation, evaluated in UTC with longitude correction.
export function solarPosition(time=Date.now(),lat=30.248,lon=120.142){
 const d=new Date(time),day=(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(d.getUTCFullYear(),0,0))/86400000;
 const hour=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600,rad=Math.PI/180,g=2*Math.PI/((d.getUTCFullYear()%4===0&&(d.getUTCFullYear()%100!==0||d.getUTCFullYear()%400===0))?366:365)*(day-1+(hour-12)/24);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const ha=(((hour*60+eq+4*lon)%1440)/4-180)*rad,L=lat*rad;
 const el=Math.asin(Math.sin(L)*Math.sin(dec)+Math.cos(L)*Math.cos(dec)*Math.cos(ha));
 const az=Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(L)-Math.tan(dec)*Math.cos(L))+Math.PI;
 return {elevation:el/rad,azimuth:(az/rad+360)%360,direction:[Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)],daylight:el>0};
}
