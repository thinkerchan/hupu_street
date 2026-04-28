// vercel 用 nodenext ESM 严格模式编译，相对 import 必须带 .js 后缀（TS 输出 .js）
import { HUPU_PROXIES, createVercelHupuHandler } from './_lib.js';

export default createVercelHupuHandler(HUPU_PROXIES.gamesApi);
