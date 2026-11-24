import { createCardApiPilotHandler } from '../../lib/cardApiSalesPilot.mjs';
export const config={maxDuration:20,api:{bodyParser:{sizeLimit:'2kb'}}};
export default createCardApiPilotHandler();
