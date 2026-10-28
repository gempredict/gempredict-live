"""Synthetic algorithm/guard tests. Not a card-recognition accuracy benchmark."""
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
import cv2
import numpy as np
from engine import rank_candidates, artwork_match, load_references, rectify, digest, identity_supported, identify


def record(id='test-11',number='11/22',printing=None):
    return {'id':id,'subject':'Example ex','cardNumber':number,'setCode':'ABC','language':'en','setId':'test','localId':'11','printings':printing or [],'rarity':'Test rarity'}

def ocr(numbers=('11/22',),name='Example ex',code='ABC EN'):
    return {'numbers':[{'value':n,'passes':3,'confidence':90} for n in numbers],
            'lines':[{'pass':'name:synthetic','text':name,'confidence':90},{'pass':'footer:synthetic','text':code,'confidence':90}]}

def artwork(seed):
    rng=np.random.default_rng(seed)
    im=rng.integers(0,256,(1000,720,3),dtype=np.uint8)
    im=cv2.GaussianBlur(im,(3,3),0)
    for i in range(60):
        x,y=rng.integers([0,140],[720,760]);color=rng.integers(0,255,3)
        cv2.circle(im,(int(x),int(y)),int(rng.integers(5,45)),tuple(map(int,color)),2)
    return im

class EngineTests(unittest.TestCase):
    def test_exact_fraction_rejects_wrong_number_even_with_strong_artwork(self):
        rows,rejected,_=rank_candidates(ocr(),[record(),record('wrong','11/23')],{'wrong':{'score':1,'status':'supported'}})
        self.assertEqual([r['id'] for r in rows],['test-11'])
        self.assertEqual(rejected[0]['reasons'],['collector_number_conflict'])
    def test_conflicting_numbers_never_select_a_candidate(self):
        rows,rejected,_=rank_candidates(ocr(('11/22','12/22')),[record(),record('other','12/22')])
        self.assertEqual(rows,[])
        self.assertTrue(all('conflicting_ocr_numbers' in r['reasons'] for r in rejected))
    def test_single_weak_reading_is_not_clear_number_support(self):
        data=ocr();data['numbers'][0]['passes']=1
        rows,_,clear=rank_candidates(data,[record()])
        self.assertFalse(clear);self.assertFalse(rows[0]['evidence']['collectorNumber']['supported'])
    def test_known_artwork_nonmatch_cannot_be_silently_ignored(self):
        data=ocr();data['lines'].append({'pass':'footer:second','text':'ABC EN','confidence':90})
        rows,_,clear=rank_candidates(data,[record()],{'test-11':{'status':'no_geometric_match','score':0}})
        self.assertFalse(identity_supported(rows,clear,{'status':'detected'}))
        rows,_,clear=rank_candidates(data,[record()])
        self.assertTrue(identity_supported(rows,clear,{'status':'detected'}))
        self.assertFalse(identity_supported(rows,clear,{'status':'retake'}))
    def test_missing_artwork_is_unavailable_not_positive_similarity(self):
        rows,_,_=rank_candidates(ocr(),[record()])
        self.assertEqual(rows[0]['evidence']['artwork']['status'],'reference_unavailable')
        self.assertEqual(rows[0]['evidence']['artwork']['score'],0)
    def test_explicit_set_and_language_conflicts_cannot_be_outvoted_by_art(self):
        for mark in ['XYZ EN','ABC FR']:
            data=ocr(code=mark)
            data['lines'].append({'pass':'footer:second','text':mark,'confidence':95})
            extra={**record('other','12/22'),'setCode':'XYZ'}
            rows,rejected,_=rank_candidates(data,[record(),extra],{'test-11':{'score':1,'status':'supported'}})
            self.assertEqual(rows,[])
            self.assertTrue(any('printed_' in reason for row in rejected for reason in row['reasons']))
    def test_zero_padded_fraction_is_equivalent_but_a_different_total_is_not(self):
        rows,_,_=rank_candidates(ocr(('011/022',)),[record(),record('wrong','11/23')])
        self.assertEqual([r['id'] for r in rows],['test-11'])
    def test_catalog_rarity_cannot_create_printing_information(self):
        rows,_,_=rank_candidates(ocr(),[record()])
        self.assertEqual(rows[0]['identity']['printings'],[])
    def test_same_art_with_small_geometric_transform_has_spatial_support(self):
        source=artwork(42)
        matrix=cv2.getRotationMatrix2D((360,500),2,.98)
        query=cv2.warpAffine(source,matrix,(720,1000))
        result=artwork_match(query,source)
        self.assertEqual(result['status'],'supported')
        self.assertGreaterEqual(result['inliers'],18)
    def test_different_art_with_identical_borders_and_text_does_not_match(self):
        a,b=artwork(42),artwork(7)
        for im in [a,b]:
            im[:130]=255;im[780:]=255
            cv2.putText(im,'Same title 11/22',(30,80),cv2.FONT_HERSHEY_SIMPLEX,1,(0,0,0),3)
            cv2.putText(im,'Shared template',(30,900),cv2.FONT_HERSHEY_SIMPLEX,1,(0,0,0),3)
        self.assertNotEqual(artwork_match(a,b)['status'],'supported')
    def test_blank_reference_has_insufficient_features(self):
        self.assertEqual(artwork_match(np.zeros((1000,720,3),np.uint8),artwork(1))['status'],'insufficient_features')
    def test_reference_hash_rights_and_evaluation_leakage_are_checked(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);photo=root/'reference.png';cv2.imwrite(str(photo),artwork(1))
            entry={'cardId':'test-11','sourceKind':'catalog','sourceUrl':'https://assets.tcgdex.net/en/example/test/11/high.png','path':'reference.png','sha256':digest(photo.read_bytes()),'rights':{'evaluationAllowed':True,'reference':'synthetic-test-only'}}
            manifest=root/'references.json'
            def load(changed,excluded=set()):
                manifest.write_text(json.dumps({'references':[changed]}));return load_references(str(manifest),[record()],excluded)
            self.assertEqual(len(load(entry)[0]),1)
            for changed in [{**entry,'sha256':'bad'},{**entry,'rights':{}},{**entry,'sourceKind':'owner_evaluation_photo'},{**entry,'cardId':'other'},{**entry,'sourceUrl':'https://assets.tcgdex.net/en/example/test/12/high.png'},{**entry,'sourceUrl':'https://unverified.invalid/reference.png'}]:
                self.assertEqual(load(changed)[0],[])
            self.assertEqual(load(entry,{entry['sha256']})[0],[])
    def test_image_frame_does_not_win_over_a_real_interior_card_rectangle(self):
        image=np.full((1000,750,3),180,np.uint8)
        cv2.rectangle(image,(0,0),(749,999),(0,0,0),2)
        cv2.rectangle(image,(160,200),(610,850),(30,30,30),16)
        _,metadata=rectify(image)
        self.assertEqual(metadata['status'],'detected')
        self.assertLess(metadata['areaFraction'],.7)
    def test_invalid_configured_reference_withholds_otherwise_supported_candidate(self):
        data=ocr();data['lines'].append({'pass':'footer:second','text':'ABC EN','confidence':90})
        data['words']=[]
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);photo=root/'photo.png';cv2.imwrite(str(photo),np.full((1000,720,3),255,np.uint8))
            ref=root/'references.json';ref.write_text(json.dumps({'references':[{'cardId':'test-11','sourceKind':'catalog','rights':{}}]}))
            with patch('engine.extract_ocr',return_value=data),patch('engine.runtime_versions',return_value={'scope':'SYNTHETIC_CONTRACT_TEST'}):
                result=identify(str(photo),None,[record()],str(ref))
            self.assertFalse(result['catalogIdentitySupported'])
            self.assertIn('catalog_reference_evidence_rejected',result['reasons'])
    def test_no_rectangular_card_requests_retake_in_landscape_image(self):
        _,metadata=rectify(np.full((300,900,3),255,np.uint8))
        self.assertEqual(metadata['status'],'retake')

if __name__=='__main__':unittest.main()
