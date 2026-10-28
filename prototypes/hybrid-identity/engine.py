"""Offline OCR + local geometric artwork matching. No network/LLM/financial code."""
import argparse
import hashlib
import json
import math
import re
import subprocess
import time
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit

import cv2
import numpy as np
from PIL import Image, ImageOps

cv2.setNumThreads(1)
cv2.setRNGSeed(0)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read_image(file):
    with Image.open(file) as source:
        if source.width * source.height > 40000000 or min(source.size) < 100:
            raise ValueError('image_dimensions')
        image = ImageOps.exif_transpose(source).convert('RGB')
        return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

def ordered_quad(points):
    points = np.array(points, np.float32).reshape(4, 2)
    total, difference = points.sum(axis=1), np.diff(points, axis=1).reshape(-1)
    return np.array([points[np.argmin(total)], points[np.argmin(difference)],
                     points[np.argmax(total)], points[np.argmax(difference)]], np.float32)

def rectify(image):
    """Find a dominant convex card rectangle; fall back explicitly, never fake detection."""
    h, w = image.shape[:2]
    scale = min(1, 1400 / max(h, w))
    small = cv2.resize(image, None, fx=scale, fy=scale)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    sh, sw = gray.shape
    masks = [cv2.threshold(gray, n, 255, cv2.THRESH_BINARY)[1] for n in (60, 95, 135, 180)]
    edge = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 35, 110)
    masks.append(cv2.morphologyEx(edge, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)))
    candidates = []
    for mask in masks:
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:100]:
            area = cv2.contourArea(contour) / (sw * sh)
            if not .18 < area < .995:
                continue
            quad = cv2.approxPolyDP(contour, .025 * cv2.arcLength(contour, True), True)
            if len(quad) != 4 or not cv2.isContourConvex(quad):
                continue
            q = ordered_quad(quad)
            if len(set(map(tuple, q))) != 4:
                continue
            touching=(q[:,0]<.015*sw)|(q[:,0]>.985*sw)|(q[:,1]<.015*sh)|(q[:,1]>.985*sh)
            if int(touching.sum())>=3:continue
            width = (np.linalg.norm(q[1]-q[0]) + np.linalg.norm(q[2]-q[3])) / 2
            height = (np.linalg.norm(q[3]-q[0]) + np.linalg.norm(q[2]-q[1])) / 2
            ratio = width / max(height, 1)
            if not .55 < ratio < .88:
                continue
            score = area * (1 - min(abs(ratio-.72), .3))
            candidates.append((score, q / scale, area))
    # Straight border segments survive textured backgrounds better than contours.
    edge = cv2.Canny(cv2.GaussianBlur(gray, (9, 9), 0), 45, 130)
    segments = cv2.createLineSegmentDetector(0).detect(cv2.GaussianBlur(gray, (17, 17), 0))[0]
    horizontal, vertical = [], []
    for segment in (segments[:,0] if segments is not None else []):
        a,b,c,d=map(float,segment);length=math.hypot(c-a,d-b)
        if length<.09*sh:continue
        row=(np.array([a,b]),np.array([c,d]),length)
        if abs(c-a)>3*abs(d-b): horizontal.append(row)
        if abs(d-b)>3*abs(c-a): vertical.append(row)
    horizontal=sorted(horizontal,key=lambda r:-r[2])[:12]
    vertical=sorted(vertical,key=lambda r:-r[2])[:12]
    def intersection(first,second):
        a,b,_=first;c,d,_=second
        matrix=np.column_stack((b-a,-(d-c)))
        if abs(np.linalg.det(matrix))<1e-5:return None
        return a+np.linalg.solve(matrix,c-a)[0]*(b-a)
    for i,left in enumerate(vertical):
        for right in vertical[i+1:]:
            for j,top in enumerate(horizontal):
                for bottom in horizontal[j+1:]:
                    pts=[intersection(v,hline) for v,hline in [(left,top),(right,top),(right,bottom),(left,bottom)]]
                    if any(point is None for point in pts):continue
                    q=ordered_quad(pts)
                    if len(set(map(tuple,q)))!=4 or not cv2.isContourConvex(q):continue
                    touching=(q[:,0]<.015*sw)|(q[:,0]>.985*sw)|(q[:,1]<.015*sh)|(q[:,1]>.985*sh)
                    if int(touching.sum())>=3:continue
                    if np.any(q[:,0]<0) or np.any(q[:,0]>=sw) or np.any(q[:,1]<0) or np.any(q[:,1]>=sh):continue
                    area=cv2.contourArea(q)/(sw*sh)
                    width=(np.linalg.norm(q[1]-q[0])+np.linalg.norm(q[2]-q[3]))/2
                    height=(np.linalg.norm(q[3]-q[0])+np.linalg.norm(q[2]-q[1]))/2
                    if not .2<area<.98 or not .58<width/max(height,1)<.82:continue
                    # Four long supporting segments, not intersections of tiny text lines.
                    perimeter=2*(width+height)
                    support=sum(r[2] for r in [left,right,top,bottom])/perimeter
                    if support<.15:continue
                    score=area*(1-min(abs(width/height-.72),.3))*1.6*(.8+.2*min(1,support))
                    candidates.append((score,q/scale,area))
    if candidates:
        best_score, q, area = max(candidates, key=lambda v: v[0])
        multiple=False
        for score,other,other_area in candidates:
            if other_area<area*.55 or score<best_score*.5:continue
            intersection,_=cv2.intersectConvexConvex(q.astype(np.float32),other.astype(np.float32))
            if intersection/max(1,min(cv2.contourArea(q),cv2.contourArea(other)))<.15:multiple=True

        transform = cv2.getPerspectiveTransform(q, np.float32([[0, 0], [1199, 0], [1199, 1666], [0, 1666]]))
        card = cv2.warpPerspective(image, transform, (1200, 1667))
        return card, {'status':'retake' if multiple else 'detected', 'multipleCards':multiple, 'areaFraction':round(area, 4), 'quad':(q / [w, h]).round(5).tolist()}
    # Close framed photos can have a card border clipped by the photo boundary.
    status = 'frame_fallback' if .62 < w/h < .83 else 'retake'
    return cv2.resize(image, (1200, 1667)), {'status':status, 'areaFraction':None, 'quad':None}

def ocr_pass(image, region, mode, name):
    x0, y0, x1, y1 = region
    h, w = image.shape[:2]
    crop = image[int(y0*h):int(y1*h), int(x0*w):int(x1*w)]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    if mode == 'contrast':
        gray = cv2.createCLAHE(clipLimit=2, tileGridSize=(8, 8)).apply(gray)
    elif mode == 'threshold':
        gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1]
    elif mode == 'inverse':
        gray = 255-gray
    ok, png = cv2.imencode('.png', gray)
    if not ok:
        return []
    # Tesseract receives PNG bytes over stdin. No shell, no image upload.
    result = subprocess.run(['tesseract', 'stdin', 'stdout', '-l', 'eng', '--psm', '6', 'tsv'],
                            input=png.tobytes(), capture_output=True, timeout=8,
                            env={**__import__('os').environ, 'OMP_THREAD_LIMIT':'1'})
    if result.returncode != 0 or len(result.stdout) > 1024*1024:
        raise ValueError('ocr_failed')
    rows = []
    for line in result.stdout.decode('utf8', errors='replace').splitlines()[1:]:
        cells = line.split('\t', 11)
        if len(cells) != 12 or cells[0] != '5' or not cells[11].strip():
            continue
        try:
            confidence = float(cells[10])
            left, top, width, height = map(int, cells[6:10])
        except ValueError:
            continue
        if confidence < 0:
            continue
        rows.append({'text':cells[11].strip(), 'confidence':round(confidence, 2),
                     'pass':name+':'+mode, 'region':[x0+left/gray.shape[1]*(x1-x0), y0+top/gray.shape[0]*(y1-y0), width/gray.shape[1]*(x1-x0), height/gray.shape[0]*(y1-y0)],
                     'line':':'.join(cells[1:5])})
    return rows

_scene_engine = None

def scene_words(card, mode='color', footer_only=False):
    # Small bundled scene-text models execute locally in ONNX Runtime. No hub,
    # API key, remote inference or automatic model download is used.
    global _scene_engine
    from rapidocr_onnxruntime import RapidOCR
    if _scene_engine is None:
        _scene_engine = RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1)
    h,w=card.shape[:2]
    y0=.87 if footer_only else 0
    image=card[int(y0*h):]
    if mode=='gray':image=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    rows,_=_scene_engine(image)
    words=[]
    for i,(box,text,confidence) in enumerate(rows or []):
        q=np.array(box);left,top=q.min(axis=0);right,bottom=q.max(axis=0)
        top=top/h+y0;bottom=bottom/h+y0
        area='name' if bottom<.16 else 'footer' if top>.84 else 'body'
        words.append({'text':text,'confidence':round(float(confidence)*100,2),
                      'pass':area+':scene-'+mode+('-crop' if footer_only else ''),
                      'region':[float(left/w),float(top),float((right-left)/w),float(bottom-top)],'line':str(i)})
    return words

def extract_ocr(card):
    words = []
    # Generic Pokémon layout bands, never card-specific coordinates or text hints.
    regions = [('name', (.10,.005,.70,.085)), ('footer', (.02,.895,.48,.955)),
               ('collector', (.08,.935,.52,.985))]
    for name, region in regions:
        for mode in ('gray', 'inverse', 'threshold'):
            words.extend(ocr_pass(card, region, mode, name))
    words.extend(scene_words(card,'color'))
    words.extend(scene_words(card,'gray'))
    words.extend(scene_words(card,'color',footer_only=True))
    numbers = defaultdict(list)
    grouped = defaultdict(list)
    for word in words:
        grouped[(word['pass'],word['line'])].append(word)
    lines = []
    for (view, _), line in grouped.items():
        text = ' '.join(w['text'] for w in line)
        confidence = sum(w['confidence'] for w in line)/len(line)
        lines.append({'pass':view,'text':text,'confidence':round(confidence,2)})
        if not view.startswith(('footer','collector')):
            continue
        # No numeric substitutions, guessed denominators or correction to a target.
        for match in re.finditer(r'(?<!\d)(\d{1,4})\s*/\s*(\d{1,4})(?!\d)', text):
            numbers[f'{int(match[1])}/{int(match[2])}'].append({'pass':view,'confidence':round(confidence,2),'text':match[0]})
    return {'words':words, 'lines':lines, 'numbers':[{'value':n,'passes':len(set(x['pass'] for x in rows)), 'confidence':round(max(x['confidence'] for x in rows),2),'observations':rows} for n, rows in numbers.items()]}

def artwork_features(image):
    # Exclude shared name/footer text. Full-art and normal-art cards can both match.
    h, w = image.shape[:2]
    art = image[int(.14*h):int(.76*h), int(.05*w):int(.95*w)]
    gray = cv2.cvtColor(art, cv2.COLOR_BGR2GRAY)
    sift = cv2.SIFT_create(nfeatures=1800)
    points, descriptors = sift.detectAndCompute(gray, None)
    return points, descriptors, gray.shape

def artwork_match(query, reference):
    qp, qd, qs = artwork_features(query)
    rp, rd, rs = artwork_features(reference)
    result={'status':'insufficient_features','score':0,'inliers':0,'ratio':0,'queryCoverage':0,'referenceCoverage':0}
    if qd is None or rd is None or len(qp)<8 or len(rp)<8:
        return result
    matches = cv2.BFMatcher(cv2.NORM_L2).knnMatch(qd,rd,k=2)
    good = [a for pair in matches if len(pair)==2 for a,b in [pair] if a.distance < .70*b.distance]
    if len(good)<8:
        return {**result,'status':'no_geometric_match','tentativeMatches':len(good)}
    src=np.float32([qp[m.queryIdx].pt for m in good]);dst=np.float32([rp[m.trainIdx].pt for m in good])
    matrix, mask=cv2.findHomography(src,dst,cv2.RANSAC,3.5)
    if matrix is None or mask is None:
        return {**result,'status':'no_geometric_match'}
    kept=mask.reshape(-1).astype(bool);inliers=int(kept.sum());ratio=inliers/len(good)
    def coverage(points, shape):
        return cv2.contourArea(cv2.convexHull(points))/float(shape[0]*shape[1]) if len(points)>=3 else 0
    qc,rc=coverage(src[kept],qs),coverage(dst[kept],rs)
    supported=inliers>=18 and ratio>=.45 and min(qc,rc)>=.08
    score=min(1,inliers/60)*ratio*min(1,min(qc,rc)/.3) if supported else 0
    return {'status':'supported' if supported else 'weak_geometric_match','score':round(score,4),'inliers':inliers,'ratio':round(ratio,4),'queryCoverage':round(qc,4),'referenceCoverage':round(rc,4),'tentativeMatches':len(good)}

def name_key(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def collector_key(value):
    match=re.fullmatch(r'(\d{1,4})/(\d{1,4})',str(value or ''))
    return f'{int(match[1])}/{int(match[2])}' if match else str(value or '')

def rank_candidates(ocr, catalog, artwork=None):
    artwork=artwork or {}
    number_rows=[n for n in ocr['numbers'] if n['passes']>=2 and n['confidence']>=45]
    clear_numbers={collector_key(n['value']) for n in number_rows}
    header=[line['text'] for line in ocr['lines'] if line['pass'].startswith('name')]
    footer=[line['text'].upper() for line in ocr['lines'] if line['pass'].startswith(('footer','collector'))]
    known_codes={str(r.get('setCode') or '').upper() for r in catalog}
    marks=defaultdict(set)
    for line in ocr['lines']:
        if not line['pass'].startswith(('footer','collector')) or line.get('confidence',0)<70:continue
        text=line['text'].upper()
        for match in re.finditer(r'(?<![A-Z0-9])([A-Z0-9]{2,5})\s*(EN|FR|DE|ES|IT|PT|JA)(?=\b|\d{1,4}/)',text):
            code,lang=match.groups()
            if any(c.isdigit() for c in code) or code in known_codes:marks[(code,lang.lower())].add(line['pass'])
    clear_marks={mark for mark,views in marks.items() if len(views)>=2}
    ranked,rejected=[],[]
    name_scores={}
    for record in catalog:
        number_match=collector_key(record['cardNumber']) in clear_numbers
        reasons=[]
        if clear_numbers and not number_match:reasons.append('collector_number_conflict')
        if len(clear_numbers)>1:reasons.append('conflicting_ocr_numbers')
        if len(clear_marks)>1:reasons.append('conflicting_printed_set_or_language')
        if clear_marks and any(code!=str(record.get('setCode') or '').upper() for code,lang in clear_marks):reasons.append('printed_set_code_conflict')
        if clear_marks and any(lang!=record.get('language') for code,lang in clear_marks):reasons.append('printed_language_conflict')
        if reasons:
            rejected.append({'id':record['id'],'reasons':reasons});continue
        subject=name_key(record['subject'])
        core=re.sub(r'(?:ex|vmax|vstar)$','',subject)
        if subject not in name_scores:
            names=[name_key(s) for s in header]
            name_scores[subject]=max([max(1.0 if candidate in text else max([SequenceMatcher(None,candidate,text[i:i+len(candidate)]).ratio() for i in range(max(1,len(text)-len(candidate)+1))],default=0) for candidate in {subject,core} if len(candidate)>=3) for text in names],default=0)
        name_score=name_scores[subject]
        code=record.get('setCode')
        code_seen=any(mark[0]==str(code or '').upper() for mark in clear_marks)
        en_seen=any(mark[1]=='en' for mark in clear_marks)
        art=artwork.get(record['id'],{'status':'reference_unavailable','score':0})
        score=.45*int(number_match)+.25*name_score+.15*int(code_seen)+.15*art['score']
        ranked.append({'id':record['id'],'identity':record,'score':round(score,4),
                       'evidence':{'collectorNumber':{'supported':number_match,'readings':number_rows},'name':{'score':round(name_score,4),'supported':name_score>=.8},'setCode':{'supported':code_seen,'value':code if code_seen else None},'language':{'supported':en_seen,'value':'en' if en_seen else None},'artwork':art}})
    ranked.sort(key=lambda r:(-r['score'],r['id']))
    return ranked,rejected,clear_numbers

def identity_supported(ranked, clear, detection):
    top=ranked[0] if ranked else None
    margin=top['score']-ranked[1]['score'] if top and len(ranked)>1 else top['score'] if top else 0
    return bool(top and len(clear)==1 and top['evidence']['name']['supported'] and top['evidence']['setCode']['supported'] and top['evidence']['language']['supported'] and margin>=.12 and detection['status']!='retake' and top['evidence']['artwork']['status'] in ['reference_unavailable','supported'])

def load_references(file, catalog, excluded):
    if not file:
        return [],[{'status':'blocked','reason':'catalog_reference_images_not_configured'}]
    manifest=json.loads(Path(file).read_text());by_id={r['id']:r for r in catalog};ids=set(by_id);refs=[];diagnostics=[]
    for entry in manifest.get('references',[])[:100]:
        try:
            if entry.get('cardId') not in ids or entry.get('sourceKind')!='catalog' or entry.get('rights',{}).get('evaluationAllowed') is not True or not entry.get('rights',{}).get('reference') or not entry.get('sourceUrl'):
                raise ValueError('unverified_reference_provenance_or_rights')
            record=by_id[entry['cardId']];url=urlsplit(entry['sourceUrl'])
            pattern=r'/en/[A-Za-z0-9.-]+/'+re.escape(record.get('setId',''))+'/'+re.escape(record.get('localId',''))+r'/(?:high|low)\.(?:png|jpg|webp)'
            if url.scheme!='https' or url.hostname!='assets.tcgdex.net' or url.username or url.password or url.query or url.fragment or not re.fullmatch(pattern,url.path):raise ValueError('reference_catalog_identity_mismatch')
            path=(Path(file).parent/entry['path']).resolve()
            if path.stat().st_size>10*1024*1024:raise ValueError('reference_size')
            data=path.read_bytes();actual=digest(data)
            if actual!=entry.get('sha256') or actual in excluded:raise ValueError('reference_hash_or_evaluation_leakage')
            image=read_image(path)
            # Catalog images should be an isolated upright card, not a query photo.
            image=cv2.resize(image,(1200,1667))
            refs.append((entry,image))
        except (ValueError,KeyError,OSError):
            diagnostics.append({'id':entry.get('cardId'),'status':'rejected','reason':'invalid_or_leaking_reference'})
    return refs,diagnostics

def runtime_versions():
    import importlib.metadata
    import rapidocr_onnxruntime
    directory=Path(rapidocr_onnxruntime.__file__).parent/'models'
    models={file.name:digest(file.read_bytes()) for file in sorted(directory.glob('*.onnx'))}
    version=subprocess.run(['tesseract','--version'],capture_output=True,text=True,timeout=5).stdout.splitlines()[0]
    return {'tesseract':version,'rapidocr':importlib.metadata.version('rapidocr-onnxruntime'),'onnxruntime':importlib.metadata.version('onnxruntime'),'modelHashes':models}

def identify(front, back, catalog, references=None, excluded=None):
    started=time.perf_counter();raw=read_image(front);card,detection=rectify(raw)
    if back:read_image(back) # Validate/consume back; generic backs cannot establish identity.
    ocr=extract_ocr(card)
    excluded=set(excluded or [])|{digest(Path(front).read_bytes())}
    refs,reference_diagnostics=load_references(references,catalog,excluded)
    art={}
    for entry,image in refs:
        match=artwork_match(card,image)
        match['source']={k:entry[k] for k in ['sourceUrl','sha256','rights']}
        if match['score']>art.get(entry['cardId'],{}).get('score',-1):art[entry['cardId']]=match
    ranked,rejected,clear=rank_candidates(ocr,catalog,art)
    top=ranked[0] if ranked else None
    margin=top['score']-ranked[1]['score'] if top and len(ranked)>1 else top['score'] if top else 0
    supported=identity_supported(ranked,clear,detection) and not any(row.get('status')=='rejected' for row in reference_diagnostics)
    # Explicit printings in a catalog establish catalog facts, not observed foil.
    printing={'status':'unverified_physical_printing','catalogPrintings':top['identity'].get('printings',[]) if top else [],'physicalFinishVerified':False}
    reasons=[]
    if not clear:reasons.append('collector_number_not_reliably_read')
    if len(clear)>1:reasons.append('conflicting_collector_readings')
    if not refs:reasons.append('catalog_artwork_comparison_unavailable')
    if any(row.get('status')=='rejected' for row in reference_diagnostics):reasons.append('catalog_reference_evidence_rejected')
    if not supported:reasons.append('identity_evidence_insufficient_or_conflicting')
    reasons.append('physical_printing_not_established_by_static_photo')
    return {'prototype':True,'productionTrustGranted':False,'status':'identity_candidate' if supported else 'ambiguous' if top and clear else 'retake',
            'catalogIdentitySupported':supported,'exactPrintingVerified':False,'printing':printing,'reasons':reasons,
            'rankedCandidates':ranked[:5],'rankedCandidateCount':len(ranked),'rejectedCount':len(rejected),'rejectedEvidence':rejected[:30],
            'ocr':ocr,'detection':detection,'artwork':{'status':'evaluated' if refs else 'blocked','referenceCount':len(refs),'diagnostics':reference_diagnostics},
            'back':{'provided':bool(back),'identityContribution':False,'reason':'Generic card backs are not unique catalog identity evidence.'},
            'elapsedMs':round((time.perf_counter()-started)*1000), 'versions':runtime_versions()|{'opencv':cv2.__version__,'method':'local-tesseract-rapidocr-lsd-sift-ransac-v1'}}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--front',required=True);parser.add_argument('--back');parser.add_argument('--catalog',required=True);parser.add_argument('--references');parser.add_argument('--excluded-hashes');args=parser.parse_args()
    catalog=json.loads(Path(args.catalog).read_text())
    if catalog.get('schemaVersion')!=1 or catalog.get('provider')!='tcgdex' or not isinstance(catalog.get('records'),list):raise ValueError('invalid_catalog')
    result=identify(args.front,args.back,catalog['records'],args.references,json.loads(args.excluded_hashes or '[]'))
    print(json.dumps(result,separators=(',',':')))

if __name__=='__main__':
    main()
