import aliases from "@/data/canonical-start-aliases-2026.json";

/** Read projection only. Historical frozen aliases remain stored without modification. */
export function selectCanonicalStarts<T extends {id:string}>(records:T[]):T[] {
  const ids=new Set(records.map(row=>row.id));
  const superseded=new Set(aliases.aliases.filter(row=>ids.has(row.canonicalId)).map(row=>row.aliasId));
  return records.filter(row=>!superseded.has(row.id));
}
