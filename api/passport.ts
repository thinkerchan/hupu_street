import { HUPU_PROXIES } from '../lib/hupu-config';
import { createVercelHupuHandler } from '../lib/proxy-vercel';

export default createVercelHupuHandler(HUPU_PROXIES.passport);
