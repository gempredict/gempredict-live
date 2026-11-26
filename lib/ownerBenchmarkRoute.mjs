import { diagnosticDeployment, diagnosticSession } from './scanDiagnosticsAuth.mjs';
import { buildOwnerReviewPacket, ownerBenchmarkBranch, ownerSlots, redactedReviewScorecard } from './ownerBenchmarkReview.mjs';

export function accuracyLabDeployment(req, env = process.env) {
 return env.VERCEL_GIT_COMMIT_REF === ownerBenchmarkBranch && !!diagnosticDeployment(req,env);
}

export function handleOwnerBenchmark(req,res,manifest,env = process.env,now = Date.now()) {
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Cookie, Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 if (!accuracyLabDeployment(req,env)) return res.status(404).json({error:'unavailable'});
 const session = diagnosticSession(req,env,now);
 if (!session) return res.status(403).json({error:'owner_authorization_required'});
 if (req.method === 'GET') return res.status(200).json({slots:ownerSlots(manifest),expiresAt:session.exp});
 if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
 if (!['review','scorecard'].includes(req.body?.action)) return res.status(400).json({error:'invalid_action'});
 try {
  const packet = buildOwnerReviewPacket(manifest,req.body.drafts);
  return res.status(200).json(req.body.action === 'review' ? packet : redactedReviewScorecard(packet));
 } catch (error) {
  const known = ['invalid_slot','invalid_new_slot','invalid_condition','invalid_photo_quality','baseline_truth_conflict','review_limit','benchmark_duplicate_front_photo'];
  return res.status(400).json({error:known.includes(error.message) ? error.message : 'invalid_review'});
 }
}
