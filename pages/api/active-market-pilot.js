import { createActiveMarketHandler } from '../../lib/activeMarketPilot.mjs';

export const config={api:{bodyParser:{sizeLimit:'2kb'}}};
export default createActiveMarketHandler();
