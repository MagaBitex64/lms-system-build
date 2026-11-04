const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const exportsClock={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/exam-clock.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsClock,Date,Number,Math})
test('server deadline continues across delayed ticks without device wall clock',()=>{
 let elapsed=0
 const remaining=exportsClock.serverCountdown('2026-11-04T00:01:00Z','2026-11-04T00:00:00Z',()=>elapsed)
 assert.equal(remaining(),60)
 elapsed=41000;assert.equal(remaining(),19)
 elapsed=90000;assert.equal(remaining(),0)
})
test('reconnect uses authoritative remaining deadline, untimed stays untimed',()=>{
 assert.equal(exportsClock.serverCountdown('2026-11-04T00:01:00Z','2026-11-04T00:00:50Z',()=>100)(),10)
 assert.equal(exportsClock.serverCountdown(null,'2026-11-04T00:00:50Z',()=>100)(),null)
})
test('60 minute exam: close at 20, reconnect at 45 leaves exactly 15 minutes',()=>{
 let elapsed=0
 const first=exportsClock.serverCountdown('2026-11-04T01:00:00Z','2026-11-04T00:00:00Z',()=>elapsed)
 assert.equal(first(),3600)
 elapsed=20*60*1000;assert.equal(first(),2400)
 elapsed=45*60*1000;assert.equal(first(),900)
 const restored=exportsClock.serverCountdown('2026-11-04T01:00:00Z','2026-11-04T00:45:00Z',()=>elapsed)
 assert.equal(restored(),900)
 elapsed=60*60*1000;assert.equal(restored(),0)
})
