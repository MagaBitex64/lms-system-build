const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')
const cache = new Map()
const css = new Proxy({}, {get:(_, key)=>String(key)})
function load(file, overrides={}) {
  if(cache.has(file)&&!Object.keys(overrides).length)return cache.get(file)
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8')
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  const exports={}
  const dependencies = {
    '@/lib/admin-attempt-review':()=>load('lib/admin-attempt-review.ts'),
    '@/lib/ent':()=>load('lib/ent.ts'),
    '@/components/ui':()=>load('app/components/ui.tsx'),
    './ui':()=>load('app/components/ui.tsx'),
    './auth-image':()=>({__esModule:true,default:props=>React.createElement('img',{alt:props.alt})}),
    './latex-text':()=>load('app/components/latex-text.tsx'),
    '@/components/admin-answer-review':()=>load('app/components/admin-answer-review.tsx'),
    '@/lib/date':()=>({formatDate:value=>String(value)}),
    '@/lib/api':()=>({fetcher:()=>{throw Error('No network in SSR tests')}}),
    ...overrides,
  }
  vm.runInNewContext(js,{exports,require:name=>name.endsWith('.css')?{__esModule:true,default:css}:dependencies[name]?dependencies[name]():require(name),console,Map,Set,Array})
  if(!Object.keys(overrides).length)cache.set(file,exports)
  return exports
}
const {filterReviewQuestions,reviewNavigation,selectedReviewOptions,scoreIndicator}=load('lib/admin-attempt-review.ts')
const {default:AnswerReview,ReviewedQuestion}=load('app/components/admin-answer-review.tsx')
function question(id=1) {return {question_id:id,number:id,subject:'mathematics',subject_label:'Математика',question_type:'single_choice',prompt:'Original $x^2$',context_text:'Saved context',image_url:'',image_placement:'after',image_width:640,image_alt:'',options:[{id:11,text:'Correct',is_correct:true},{id:12,text:'Wrong',is_correct:false}],matching_pairs:[],response:{selected_option_id:12},status:'incorrect',keys_available:true,points_earned:null,max_points:1,evaluation_source:'snapshot_keys'}}
function review() {return {id:1,access_id:1,attempt_number:1,student_name:'Fixture Student',student_email:'fixture@example.com',title:'Saved test',started_at:'2026-10-19',submitted_at:'2026-10-19',total_score:7,max_score:140,percentage:5,subjects:[],questions:Array.from({length:120},(_,i)=>question(i+1)),review_available:true,history_warning:null,points_warning:'Жеке ұпай сақталмаған'}}

test('four independent accessible sections have exactly one default-expanded panel',()=>{
  const data=review()
  const {default:Page}=load('app/ent-trial/admin/attempts/[attemptId]/result/page.tsx',{
    'next/navigation':()=>({useParams:()=>({attemptId:'1'})}),
    'next/link':()=>({__esModule:true,default:({children,href})=>React.createElement('a',{href},children)}),
    '@/lib/auth':()=>({useAuth:()=>({user:{role:'admin'}})}),
    swr:()=>({__esModule:true,default:()=>({data})}),
  })
  const html=renderToStaticMarkup(React.createElement(Page))
  assert.equal((html.match(/aria-expanded="true"/g)||[]).length,1)
  assert.equal((html.match(/aria-expanded="false"/g)||[]).length,3)
  assert.equal((html.match(/role="region"/g)||[]).length,4)
  for(const title of ['Жалпы нәтиже','Оқушының жауаптары','Тесттен шығу журналы','Браузер хабарлаған оқиғалар'])assert.ok(html.includes(title))
  assert.equal((html.match(/<article/g)||[]).length,0)
})

test('120 question attempt renders one question, original numbering and no editable answer controls',()=>{
  const html=renderToStaticMarkup(React.createElement(AnswerReview,{data:review()}))
  assert.equal((html.match(/<article/g)||[]).length,1)
  assert.ok(html.includes('Сұрақ 120'))
  assert.ok(!/<input|<textarea/.test(html))
  assert.ok(html.includes('katex'))
  assert.ok(html.includes('Оқушының қате жауабы'))
  assert.ok(html.includes('Дұрыс жауап'))
  assert.ok(html.includes('сақталмаған'))
})

test('filters retain snapshot order and original IDs across subject/status changes',()=>{
  const questions=[question(8),{...question(2),subject:'informatics',status:'unanswered'}, {...question(9),status:'correct'}]
  assert.deepEqual(filterReviewQuestions(questions,'','').map(q=>q.number),[8,2,9])
  assert.equal(filterReviewQuestions(questions,'informatics','unanswered')[0].question_id,2)
  assert.equal(filterReviewQuestions(questions,'mathematics','correct')[0].question_id,9)
  assert.equal(filterReviewQuestions(questions,'mathematics','unanswered').length,0)
})

test('multiple selections and matching display actual and correct pairings',()=>{
  const q={...question(),question_type:'multi_choice',response:{selected_option_ids:[11,12]},status:'partial'}
  assert.deepEqual([...selectedReviewOptions(q)],[11,12])
  const html=renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:{...q,question_type:'matching',matching_pairs:[{id:90,left_text:'Saved left',correct_option_id:11}],response:{matching_answer:{90:12}}}}))
  assert.ok(html.includes('Saved left'))
  assert.ok(html.includes('Correct'))
  assert.ok(html.includes('Wrong'))
  assert.ok(html.includes('Оқушының қате жауабы'))
})

test('unanswered and missing-history states are explicit, never fake points',()=>{
  const html=renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:{...question(),status:'unanswered',response:{}}}))
  assert.ok(html.includes('Ұпай дерегі жоқ'))
  assert.ok(html.includes('сақталмаған'))
  const empty=renderToStaticMarkup(React.createElement(AnswerReview,{data:{...review(),review_available:false,history_warning:'No snapshot'}}))
  assert.ok(empty.includes('No snapshot'))
  assert.equal((empty.match(/<article/g)||[]).length,0)
})

test('subject-local navigation is 1–40 while all subjects preserve 1–120 and IDs',()=>{
  const questions = Array.from({length:120},(_,i)=>({...question(i+1),subject:i<40?'foundation':i<80?'informatics':'mathematics'}))
  const original = JSON.stringify(questions)
  const all=reviewNavigation(questions,'','')
  assert.equal(all[0].displayNumber,1);assert.equal(all.at(-1).displayNumber,120)
  const info=reviewNavigation(questions,'informatics','')
  assert.equal(info.length,40)
  assert.equal(info[0].displayNumber,1);assert.equal(info.at(-1).displayNumber,40)
  assert.equal(info[0].question.question_id,41);assert.equal(info.at(-1).question.question_id,80)
  assert.equal(reviewNavigation(questions,'mathematics','')[0].displayNumber,1)
  assert.equal(JSON.stringify(questions),original)
})

test('status filter keeps original subject-local numbers distinct from filtered position',()=>{
  const questions=Array.from({length:40},(_,i)=>({...question(i+41),subject:'informatics',status:[2,36].includes(i)?'incorrect':'correct'}))
  const wrong=reviewNavigation(questions,'informatics','incorrect')
  assert.deepEqual(wrong.map(q=>q.displayNumber),[3,37])
  assert.deepEqual(wrong.map(q=>q.question.question_id),[43,77])
  assert.equal(reviewNavigation(questions,'informatics','unanswered').length,0)
})

test('local heading and saved zero score are shown without substituting unavailable points',()=>{
  const html=renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:{...question(77),points_earned:0,max_points:2,evaluation_source:'stored'},displayNumber:37,showGlobal:true}))
  assert.ok(html.includes('Сұрақ №37 · Математика'))
  assert.ok(html.includes('Толық тесттегі нөмірі: 77'))
  assert.ok(html.includes('Жиналған ұпай: 0 / 2 балл'))
  const reconstructed=renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:{...question(),points_earned:1,max_points:2,evaluation_source:'reconstructed'}}))
  assert.ok(reconstructed.includes('Жиналған ұпай: 1 / 2 балл'))
  assert.ok(reconstructed.includes('қалпына келтірілген'))
  const unavailable=renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:question()}))
  assert.ok(unavailable.includes('Жиналған ұпай: қолжетімсіз / 1 балл'))
})

test('score colors use saved response and configured maximum for all UNT outcomes',()=>{
  const cases=[
    [1,1,{selected_option_id:11},'correct','Жауап дұрыс'],
    [2,2,{selected_option_ids:[11,12,13]},'correct','Жауап дұрыс'],
    [1,2,{selected_option_ids:[11,12]},'partial','Жауап жартылай дұрыс'],
    [0,1,{selected_option_id:12},'incorrect','Жауап қате'],
    [0,2,{selected_option_ids:[12]},'incorrect','Жауап қате'],
    [0,1,{},'unanswered','Жауап берілмеген'],
    [0,2,{},'unanswered','Жауап берілмеген'],
  ]
  for(const [points_earned,max_points,response,state,label] of cases){
    const q={...question(),question_type:max_points===2?'multi_choice':'single_choice',points_earned,max_points,response,
      options:[{id:11,text:'A',is_correct:true},{id:12,text:'B',is_correct:true},{id:13,text:'C',is_correct:true}]}
    assert.equal(scoreIndicator(q),state)
    const html=renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:q}))
    assert.ok(html.includes(`Жиналған ұпай: ${points_earned} / ${max_points} балл`))
    assert.ok(html.includes(label))
    assert.match(html,new RegExp(`<div class="status ${state}"`))
    assert.match(html,new RegExp(`<p class="points ${state}"`))
  }
})

test('missing points and unexpected maximums remain neutral and are reported without mutation',()=>{
  const missing={...question(),points_earned:null,response:{selected_option_id:11}}
  assert.equal(scoreIndicator(missing),'unknown')
  assert.ok(renderToStaticMarkup(React.createElement(ReviewedQuestion,{question:missing})).includes('Ұпай дерегі жоқ'))
  const unexpected={...question(),points_earned:3,max_points:3}
  const before=JSON.stringify(unexpected)
  assert.equal(scoreIndicator(unexpected),'unknown')
  const html=renderToStaticMarkup(React.createElement(AnswerReview,{data:{...review(),questions:[unexpected]}}))
  assert.match(html,/күтілген 1 немесе 2 баллдан өзгеше:[\s\S]*3/)
  assert.ok(html.includes('Жиналған ұпай: 3 / 3 балл'))
  assert.equal(JSON.stringify(unexpected),before)
})

test('navigation keeps subject-local numbers, score color and visible selected focus',()=>{
  const questions=[
    {...question(41),subject:'informatics',subject_label:'Информатика',points_earned:1,max_points:2,response:{selected_option_id:11}},
    {...question(42),subject:'informatics',subject_label:'Информатика',points_earned:0,max_points:2,response:{selected_option_id:12}},
  ]
  assert.deepEqual(reviewNavigation(questions,'informatics','').map(item=>item.displayNumber),[1,2])
  const html=renderToStaticMarkup(React.createElement(AnswerReview,{data:{...review(),questions}}))
  assert.match(html,/<button[^>]*class="partial"[^>]*aria-label="Сұрақ 41: Жауап жартылай дұрыс"[^>]*aria-current="step"/)
  assert.match(html,/<button[^>]*class="incorrect"[^>]*aria-label="Сұрақ 42: Жауап қате"/)
  for(const label of ['Жасыл — Дұрыс','Сары — Жартылай дұрыс','Қызыл — Қате','Сұр — Жауапсыз'])assert.ok(html.includes(label))
  assert.ok(html.indexOf('Сұрақ түстерінің түсіндірмесі')>html.indexOf('Сұрақтар арасында ауысу'))
  const cssText=fs.readFileSync(path.join(__dirname,'../app/components/admin-attempt-review.module.css'),'utf8')
  assert.ok(cssText.includes('.numbers button[aria-current=step]{outline:2px solid currentColor'))
  for(const state of ['correct','partial','incorrect','unanswered','unknown'])assert.ok(cssText.includes(`.numbers button.${state}{border-color:`))
})
