import { createCardApiPilotHandler } from '../../lib/cardApiSalesPilot.mjs';
export const config={api:{bodyParser:{sizeLimit:'2kb'}}};
export default createCardApiPilotHandler();
