"""Read reference assets; write only this independent application's assets."""
from pathlib import Path
import json, math, shutil, hashlib
import xml.etree.ElementTree as ET

APP=Path(__file__).resolve().parents[1]
ROOT=APP.parent
OUT=APP/'public'/'assets'
OUT.mkdir(parents=True,exist_ok=True)
bbox=[120.108,30.215,120.176,30.281]
def inside(p): return bbox[0]<=p[0]<=bbox[2] and bbox[1]<=p[1]<=bbox[3]
tree=ET.parse(ROOT/'west_lake.osm').getroot()
nodes={n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in tree.findall('node')}
ways={}
roads=[]; buildings=[]; greens=[]; pois=[]
for w in tree.findall('way'):
    tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
    ids=[n.attrib['ref'] for n in w.findall('nd') if n.attrib['ref'] in nodes]
    ways[w.attrib['id']]=ids
    c=[nodes[i] for i in ids]
    if len(c)<2 or not any(inside(p) for p in c): continue
    if 'highway' in tags and tags['highway'] not in ['motorway','motorway_link','trunk','construction','proposed']:
        walk=tags.get('foot')!='no' and tags.get('access') not in ['private','no']
        try: width=float(tags.get('width','').replace('m',''))
        except ValueError: width=None
        roads.append({'id':w.attrib['id'],'kind':tags['highway'],'name':tags.get('name',''),'walk':walk,'bridge':tags.get('bridge','no') not in ['no','false','0'],'tunnel':tags.get('tunnel','no') not in ['no','false','0'],'layer':tags.get('layer','0'),'widthM':width,'nodes':ids,'c':c})
    if 'building' in tags and len(c)>3:
        try: height=float(tags.get('height','').replace('m',''))
        except ValueError:
            try: height=float(tags.get('building:levels','0'))*3
            except ValueError: height=0
        buildings.append({'c':c,'h':min(65,max(0,height))})
    if tags.get('natural') in ['wood','scrub'] or tags.get('landuse') in ['forest','grass'] or tags.get('leisure') in ['park','garden']:
        if len(c)>3: greens.append(c)
for n in tree.findall('node'):
    t={x.attrib['k']:x.attrib['v'] for x in n.findall('tag')}
    if inside(nodes[n.attrib['id']]) and (t.get('amenity') in ['drinking_water','toilets','shelter'] or t.get('tourism') in ['information','attraction']):
        pois.append({'name':t.get('name',''),'kind':t.get('amenity',t.get('tourism')),'c':nodes[n.attrib['id']]})
# Assemble the actual OSM multipolygon; open ways must be joined by shared nodes.
water=[]
for rel in tree.findall('relation'):
    tags={t.attrib['k']:t.attrib['v'] for t in rel.findall('tag')}
    if rel.attrib['id']!='2308774': continue
    for role in ['outer','inner']:
        chains=[list(ways[m.attrib['ref']]) for m in rel.findall('member') if m.attrib.get('type')=='way' and m.attrib.get('role')==role and m.attrib['ref'] in ways]
        while chains:
            chain=chains.pop(0)
            while chain[0]!=chain[-1]:
                found=False
                for i,q in enumerate(chains):
                    if chain[-1]==q[0]: chain+=q[1:]
                    elif chain[-1]==q[-1]: chain+=q[-2::-1]
                    elif chain[0]==q[-1]: chain=q[:-1]+chain
                    elif chain[0]==q[0]: chain=q[:0:-1]+chain
                    else: continue
                    chains.pop(i); found=True; break
                if not found: break
            if len(chain)>3 and chain[0]==chain[-1]: water.append({'role':role,'c':[nodes[i] for i in chain]})
dem=json.loads((ROOT/'feelslike-sandbox/assets/dem_grid.json').read_text(encoding='utf-8'))
b=dem['bounds']; elev=dem['elev']; rows=len(elev); cols=len(elev[0]); size=161
def in_ring(p,c):
    odd=False
    for i,a in enumerate(c):
        d=c[i-1]
        if (a[1]>p[1])!=(d[1]>p[1]) and p[0]<(d[0]-a[0])*(p[1]-a[1])/(d[1]-a[1])+a[0]: odd=not odd
    return odd
outers=[r['c'] for r in water if r['role']=='outer']
inners=[r['c'] for r in water if r['role']=='inner']
def in_water(p): return any(in_ring(p,c) for c in outers) and not any(in_ring(p,c) for c in inners)
terrain=[]
for y in range(size):
    lat=bbox[3]-(bbox[3]-bbox[1])*y/(size-1)
    row=round((b['latMax']-lat)/(b['latMax']-b['latMin'])*(rows-1))
    for x in range(size):
        lon=bbox[0]+(bbox[2]-bbox[0])*x/(size-1)
        col=round((lon-b['lonMin'])/(b['lonMax']-b['lonMin'])*(cols-1))
        z=round(elev[max(0,min(rows-1,row))][max(0,min(cols-1,col))],1)
        # Visualization only: remove DSM water-surface noise inside the exact
        # OSM lake polygon, keeping OSM island holes. Not an observed water level.
        terrain.append(7.5 if in_water([lon,lat]) else z)
data={'bbox':bbox,'size':size,'elev':terrain,'roads':roads,'buildings':buildings,'green':greens,'water':water,'pois':pois,'source':{'roads':'OpenStreetMap contributors, west_lake.osm, ODbL 1.0','terrain':dem['source'],'terrainAttribution':dem['attribution'],'terrainNote':'DSM; vegetation/buildings included. Resampled for visualization; vertical exaggeration 1.6×. Unknown building heights are drawn symbolically at 4m. Water cells are visually flattened to remove DSM noise inside OSM polygons, not a surveyed water level.','osmSha256':hashlib.sha256((ROOT/'west_lake.osm').read_bytes()).hexdigest()}}
(OUT/'westlake.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
shutil.copyfile(ROOT/'feelslike-sandbox/assets/three.module.js',OUT/'three.module.js')
print(json.dumps({'roads':len(roads),'buildings':len(buildings),'waterRings':len(water),'pois':len(pois),'terrain':size*size,'bytes':(OUT/'westlake.json').stat().st_size}))
