// sfc32 + 문자열 해시 → 같은 seed에서 같은 난수열 보장
export function sfc32(a:number,b:number,c:number,d:number){
  return ()=>{a|=0;b|=0;c|=0;d|=0;var t=(a+b|0)+d|0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=(c<<21|c>>>11);c=c+t|0;return (t>>>0)/4294967296}
}
export function seedFrom(str:string){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){
    const ch=str.charCodeAt(i);
    h1=h2^Math.imul(h1^ch,597399067);
    h2=h3^Math.imul(h2^ch,2869860233);
    h3=h4^Math.imul(h3^ch,951274213);
    h4=h1^Math.imul(h4^ch,2716044179);
  }
  h1^=h2^h3^h4; h2^=h1; h3^=h2; h4^=h3;
  return [h1,h2,h3,h4] as [number,number,number,number];
}
export const makeRng=(seed:string)=>{
  const r=sfc32(...seedFrom(seed));
  return { next:()=>r(), int:(n:number)=>Math.floor(r()*n) };
};
