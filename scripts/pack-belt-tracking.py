"""Deterministic rendering-only pack. This does not approve or repair observations."""
import argparse, copy, gzip, hashlib, json, math
from pathlib import Path

FRAME_FIELDS = ('frameIndex','originalPTS','pts','decodeStatus','identicalToPrevious',
 'waistAnchor','waistWidth','waistConfidence','waistAnchorMethod',
 'beltRegions','beltVisibleRegions','beltShading','beltEdges','beltEnds','crossings',
 'observations','validationStatus','semanticStatus','qc','review','reviewStatus')
POINT_FIELDS = {'contour','polygon','holes','points','tip','widthEdge0','widthEdge1','waistAnchor','xy'}

def sha(data): return hashlib.sha256(data).hexdigest()
def encoded(value): return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True,allow_nan=False).encode('utf-8')

def pack(belt, hands, input_hashes, digits=5):
    if digits not in (5,6): raise ValueError('Use 5 or 6 decimals to preserve sub-0.1-pixel precision')
    for key in ('width','height','decodedFrames'):
        if belt['source'][key] != hands['source'][key]: raise ValueError('Source mismatch: '+key)
    width,height=belt['source']['width'],belt['source']['height']
    if len(belt['frames'])!=len(hands['frames']) or len(belt['frames'])!=belt['source']['decodedFrames']:
        raise ValueError('Frame coverage mismatch')
    stats={'coordinateValues':0,'maximumNormalizedError':0.,'maximumSourcePixelError':0.}
    def scalar(v,dimension):
        if not isinstance(v,(int,float)) or not math.isfinite(v): raise ValueError('Nonfinite coordinate')
        q=round(v,digits);error=abs(q-v)
        stats['coordinateValues']+=1
        stats['maximumNormalizedError']=max(stats['maximumNormalizedError'],error)
        stats['maximumSourcePixelError']=max(stats['maximumSourcePixelError'],error*dimension)
        return q
    def coordinates(value):
        if value is None: return None
        if isinstance(value,list):
            if len(value)==2 and all(isinstance(x,(int,float)) for x in value):
                return [scalar(value[0],width),scalar(value[1],height)]
            return [coordinates(x) for x in value]
        if isinstance(value,dict):
            return {k:scalar(v,width if k=='x' else height) if k in ('x','y') else coordinates(v) if k=='xy' else copy.deepcopy(v) for k,v in value.items()}
        raise ValueError('Unsupported coordinate shape')
    def compact(value):
        if isinstance(value,list): return [compact(x) for x in value]
        if isinstance(value,dict):
            return {k:coordinates(v) if k in POINT_FIELDS else scalar(v,width) if k=='waistWidth' and v is not None else compact(v)
                    for k,v in value.items() if k!='pixelEndpoints'}
        return value
    frames=[];previous=-math.inf
    for i,(b,h) in enumerate(zip(belt['frames'],hands['frames'])):
        if b.get('frameIndex')!=i or h.get('frameIndex')!=i: raise ValueError('Frame index gap')
        if b['originalPTS']!=h['originalPTS']: raise ValueError('Exact hand/belt PTS mismatch')
        if not math.isfinite(b['originalPTS']) or b['originalPTS']<=previous: raise ValueError('Nonmonotone PTS')
        previous=b['originalPTS']
        frame={k:compact(b[k]) for k in FRAME_FIELDS if k in b}
        frame['handRegions']=compact(h.get('handRegions',[]))
        # Preserve hand-specific QC without replacing belt QC or inventing approval.
        frame['handObservationMetadata']={k:copy.deepcopy(v) for k,v in h.items() if k not in ('frameIndex','originalPTS','handRegions')}
        frames.append(frame)
    result={k:copy.deepcopy(v) for k,v in belt.items() if k!='frames'}
    result['frames']=frames
    result['packing']={'format':'render-observation-compact-v1','coordinateDecimals':digits,
       'sourceHashes':input_hashes,'approval':'unchanged from inputs; packing is not approval',
       'excludedFields':['hands landmark arrays','beltOpticalFlow','sourceImage','per-frame sha256','pixelEndpoints (duplicate of normalized points)'],
       'handMetadata':{k:copy.deepcopy(v) for k,v in hands.items() if k not in ('frames','source')},
       'timePolicy':'every decoded frame; originalPTS and integer pts unchanged; no temporal subsampling'}
    if stats['maximumSourcePixelError']>.1: raise ValueError('Coordinate error exceeds 0.1 source pixel')
    return result,stats

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--belt',type=Path,required=True);parser.add_argument('--hands',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    raw_b=args.belt.read_bytes();raw_h=args.hands.read_bytes()
    result,stats=pack(json.loads(raw_b),json.loads(raw_h),{'belt':sha(raw_b),'hands':sha(raw_h)})
    data=encoded(result);compressed=gzip.compress(data,compresslevel=9,mtime=0)
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_bytes(data);args.out.with_suffix('.json.gz').write_bytes(compressed)
    report={'kind':'packing-preview-not-approval','inputs':{'belt':{'path':str(args.belt),'sha256':sha(raw_b),'bytes':len(raw_b)},'hands':{'path':str(args.hands),'sha256':sha(raw_h),'bytes':len(raw_h)}},
      'output':{'path':str(args.out),'sha256':sha(data),'bytes':len(data),'gzipBytes':len(compressed)},'frames':len(result['frames']),
      'firstPTS':result['frames'][0]['originalPTS'],'lastPTS':result['frames'][-1]['originalPTS'],
      'ptsUnchanged':all(x['originalPTS']==y['originalPTS'] for x,y in zip(result['frames'],json.loads(raw_b)['frames'])),
      'precision':stats,'deterministicRepack':encoded(pack(json.loads(raw_b),json.loads(raw_h),{'belt':sha(raw_b),'hands':sha(raw_h)})[0])==data}
    args.out.with_suffix('.audit.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
