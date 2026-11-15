import {demoApi} from '../../lib/demoReportServer.mjs';
export const config={api:{bodyParser:{sizeLimit:'2kb'}}};
export default function handler(req,res){return demoApi(req,res);}
