const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const exports = {}
  vm.runInNewContext(js, {exports, require, Promise, Map, Array})
  return exports
}
const {validateLead, normalizeLeadPhone, leadCourses} = load('lib/lead-validation.ts')
const {createSearchPager, mergeSearchPages, validSearchQuery} = load('lib/search-results.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))
const page = (number, ids, more=false) => ({page:number, per_page:10, has_more:more, courses:ids.map(id=>({id})), lessons:[], materials:[]})
const deferred = () => {let resolve, reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no}); return {promise,resolve,reject}}

test('lead validation matches accepted Kazakhstan formats and all public options', () => {
  for (const phone of ['+7 (701) 123-45-67','87011234567','77011234567','7011234567','+7 701 123 45 67']) assert.equal(normalizeLeadPhone(phone), '+77011234567')
  for (const phone of ['12345','abcde','+74951234567','+7701123456','+7011234567','+87011234567','+7 (701)) 1234567']) assert.equal(normalizeLeadPhone(phone), null)
  for (const course of leadCourses) {
    const result = validateLead({name:'  Аружан   Сейіт ', phone:'87011234567', course})
    assert.equal(Object.keys(result.errors).length,0)
    assert.equal(result.values.name,'Аружан Сейіт')
  }
  const invalid = validateLead({name:'  ',phone:'bad phone',course:'  '})
  assert.deepEqual(Object.keys(invalid.errors), ['name','phone','course'])
})

test('query bounds reject whitespace and match backend 200-character maximum', () => {
  assert.equal(validSearchQuery('  '),false)
  assert.equal(validSearchQuery('x'.repeat(200)),true)
  assert.equal(validSearchQuery('x'.repeat(201)),false)
})

test('loads beyond ten, suppresses duplicate clicks and deduplicates per category', async () => {
  let state, calls=[]
  const pending=deferred()
  const pager=createSearchPager(async (q,n)=>{calls.push([q,n]); return n===1?page(1,Array.from({length:10},(_,i)=>i+1),true):pending.promise}, s=>{state=s})
  pager.setQuery('needle'); await tick()
  assert.equal(state.pages.length,1)
  const loading=pager.loadMore(); pager.loadMore()
  assert.equal(state.pending,true)
  assert.equal(calls.length,2)
  pending.resolve(page(2,[10,11,12])); await loading
  assert.equal(mergeSearchPages(state.pages).courses.length,12)
  await pager.loadMore()
  assert.equal(calls.length,2)
  assert.equal(state.pages.at(-1).has_more,false)
})

test('failed initial request is not empty success and retry works', async () => {
  let state, calls=0
  const pager=createSearchPager(async()=>{if(!calls++)throw new Error('offline');return page(1,[])},s=>{state=s})
  pager.setQuery('needle'); await tick()
  assert.equal(state.error,'request')
  assert.equal(state.pages.length,0)
  await pager.retry()
  assert.equal(state.error,null)
  assert.equal(state.pages.length,1)
  assert.equal(mergeSearchPages(state.pages).courses.length,0)
})

test('422 is invalid query, not empty results; client invalid query makes no request', async () => {
  let state,calls=0
  const pager=createSearchPager(async()=>{calls++;throw {status:422}},s=>{state=s})
  pager.setQuery('x'.repeat(201)); await tick()
  assert.equal(calls,0)
  assert.equal(state.error,'invalid')
  pager.setQuery('needle'); await tick()
  assert.equal(calls,1)
  assert.equal(state.error,'invalid')
  assert.equal(state.pages.length,0)
})

test('load-more failure preserves results and retries exactly the same page', async () => {
  let state, calls=[], failed=false
  const pager=createSearchPager(async(q,n)=>{calls.push(n);if(n===2&&!failed){failed=true;throw new Error('offline')}return page(n,[n],n===1)},s=>{state=s})
  pager.setQuery('needle'); await tick()
  await pager.loadMore()
  assert.equal(state.error,'request')
  assert.equal(state.pages.length,1)
  await pager.retry()
  assert.deepEqual(calls,[1,2,2])
  assert.equal(mergeSearchPages(state.pages).courses.length,2)
})

test('query change resets pages and ignores older success and failure responses', async () => {
  for (const staleError of [false,true]) {
    let state
    const old=deferred()
    const pager=createSearchPager(async(q)=>q==='old'?old.promise:page(1,[99]),s=>{state=s})
    pager.setQuery('old')
    pager.setQuery('new'); await tick()
    if(staleError)old.reject(new Error('late failure'));else old.resolve(page(1,[1],true))
    await tick()
    assert.equal(state.query,'new')
    assert.equal(state.pages.length,1)
    assert.equal(state.pages[0].courses[0].id,99)
    assert.equal(state.error,null)
  }
})

test('disposing ignores outstanding responses', async () => {
  const pending=deferred();let notifications=0
  const pager=createSearchPager(()=>pending.promise,()=>{notifications++})
  pager.setQuery('needle');pager.dispose()
  const before=notifications
  pending.resolve(page(1,[1])); await tick()
  assert.equal(notifications,before)
})
