import manifest from '../../benchmarks/identity/manifest.json';
import { handleOwnerBenchmark } from '../../lib/ownerBenchmarkRoute.mjs';

export const config = {api:{bodyParser:{sizeLimit:'128kb'}}};

export default function handler(req,res) {
 return handleOwnerBenchmark(req,res,manifest);
}
