export function info(tag: string, payload: any) {
  console.log(`[INFO] ${tag}`, JSON.stringify(payload).slice(0, 1000));
}

export function warn(tag: string, payload: any) {
  console.warn(`[WARN] ${tag}`, JSON.stringify(payload).slice(0, 1000));
}

export function err(tag: string, e: any) {
  console.error(`[ERR] ${tag}`, e?.message || e);
}