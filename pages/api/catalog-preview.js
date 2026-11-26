import { createCatalogPreviewHandler } from '../../lib/catalogPreviewHandler.mjs';

export const config={maxDuration:15,api:{bodyParser:{sizeLimit:'2kb'}}};
export default createCatalogPreviewHandler();
