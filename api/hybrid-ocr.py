"""Protected Preview CPU OCR. No model API, market request, database or image log."""
from http.server import BaseHTTPRequestHandler
import os, sys, json, base64, hashlib, tempfile, importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'vendor'))
os.environ['GEMPREDICT_SCENE_ONLY']='1'
_engine=None

def engine():
 global _engine
 if _engine is None:
  if not (ROOT/'data/hybrid/LICENSE').is_file() or not (ROOT/'vendor/RapidOCR-LICENSE').is_file():raise ValueError('license_missing')
  pins=json.loads((ROOT/'data/hybrid/manifest.json').read_text())
  catalog=ROOT/'data/hybrid/catalog.json'
  if hashlib.sha256(catalog.read_bytes()).hexdigest()!=pins['catalogSha256']:raise ValueError('catalog_integrity')
  manifest=json.loads((ROOT/'vendor/rapidocr-manifest.json').read_text())
  for file,digest in manifest['files'].items():
   if hashlib.sha256((ROOT/'vendor'/file).read_bytes()).hexdigest()!=digest:raise ValueError('ocr_integrity')
  spec=importlib.util.spec_from_file_location('hybrid_engine',ROOT/'prototypes/hybrid-identity/engine.py')
  mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
  _engine=(mod,json.loads(catalog.read_text())['records'],pins)
 return _engine

def identify(data):
 if not isinstance(data,dict) or set(data)!={'front'} or not isinstance(data['front'],str) or len(data['front'])>5600000:raise ValueError('invalid_image')
 raw=base64.b64decode(data['front'],validate=True)
 if not raw or len(raw)>4*1024*1024:raise ValueError('invalid_image')
 mod,records,pins=engine()
 with tempfile.TemporaryDirectory(prefix='gp-ocr-') as tmp:
  path=Path(tmp)/'front.image';path.write_bytes(raw);path.chmod(0o600)
  result=mod.identify(str(path),None,records)
 # Return only bounded evidence and IDs; authoritative facts are reloaded in Node.
 return {'status':result['status'],'catalogIdentitySupported':result['catalogIdentitySupported'],
  'candidates':[{'id':r['id'],'score':r['score'],'evidence':r['evidence']} for r in result['rankedCandidates']],
  'detection':result['detection'],'elapsedMs':result['elapsedMs'],'catalogSha256':pins['catalogSha256'],
  'artwork':result['artwork'],'printingVerified':False}

class handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   if os.environ.get('VERCEL_ENV')!='preview':raise ValueError('preview_only')
   mod,records,pins=engine();self.respond(200,{'status':'ready','catalogRecords':len(records),'artworkReferences':0,'paidProviderCalls':0})
  except Exception:self.respond(503,{'status':'unavailable'})
 def do_POST(self):
  try:
   # Existing Vercel Authentication protects the immutable Preview URL. This
   # endpoint is unavailable in Production, including custom public domains.
   if os.environ.get('VERCEL_ENV')!='preview':raise ValueError('preview_only')
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<5700000:raise ValueError('body_size')
   result=identify(json.loads(self.rfile.read(size)));self.respond(200,result)
  except Exception:self.respond(503,{'status':'unavailable','reason':'local_ocr_unavailable_or_invalid_input'})
 def respond(self,status,value):
  body=json.dumps(value,separators=(',',':')).encode();self.send_response(status)
  self.send_header('Content-Type','application/json');self.send_header('Cache-Control','private, no-store')
  self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
