const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/components/content-access-modal.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
const exportsObject={}
const ui={Modal:({children,title})=>React.createElement('div',{role:'dialog','aria-label':title},children),Input:props=>React.createElement('input',props),Button:({children,variant,...props})=>React.createElement('button',props,children),Field:({label,children})=>React.createElement('label',{},label,children)}
vm.runInNewContext(code,{exports:exportsObject,require:name=>name==='./ui'?ui:name==='@/lib/api'?{}:require(name)})
const Component=exportsObject.default
const student={id:7,full_name:'Топсыз оқушы',email:'synthetic@example.com',groups:[]}
const render=(target,extras={})=>renderToStaticMarkup(React.createElement(Component,{courseId:1,target,students:[student],groups:[],onClose:()=>{},onSaved:async()=>{},...extras}))
test('directly enrolled students without groups appear in default Students tab',()=>{
 const html=render({id:1,title:'Lesson',kind:'item',type:'lesson',access_student_ids:[7]})
 assert.match(html,/Топсыз оқушы/);assert.match(html,/Жеке рұқсат/);assert.match(html,/role="tab"/);assert.match(html,/Оқушылар \(1\)/);assert.doesNotMatch(html,/Тапсыру саны/)
})
test('group-derived access does not disable independent direct checkbox',()=>{
 const html=render({id:1,title:'Lesson',kind:'item',type:'lesson',access_student_ids:[7],access_group_ids:[3]},{students:[{...student,groups:[{id:3,code:'G'}]}],groups:[{id:3,code:'G',title:'Group',student_count:1}]})
 assert.match(html,/Жеке және топ арқылы/);assert.doesNotMatch(html,/<input[^>]+disabled/)
})
test('quiz overlapping rules display the strictest max attempts and section gate',()=>{
 const target={id:2,title:'Quiz',kind:'item',type:'quiz',access_student_ids:[7],quiz_access_rules:[{target_type:'student',target_id:7,max_attempts:3,deadline_at:null}]}
 const html=render(target,{parent:{id:1,title:'Section',kind:'section',access_restricted:true,access_student_ids:[7],quiz_access_rules:[{target_type:'student',target_id:7,max_attempts:1,deadline_at:null}]}})
 assert.match(html,/1 әрекет/);assert.match(html,/Тапсыру саны/)
 assert.match(render(target,{parent:{id:1,title:'Closed',kind:'section',access_restricted:true}}),/Бөлім рұқсаты жоқ/)
})
test('section access manages recipients only, preserving individual quiz settings',()=>{
 for(const access_restricted of [false,true]){
  const html=render({id:4,title:'Section',kind:'section',access_restricted,access_student_ids:[7],quiz_access_rules:[{target_type:'student',target_id:7,max_attempts:3,deadline_at:'2030-01-01T00:00:00Z'}]})
  assert.match(html,/Бөлімге қолжетімділік/);assert.match(html,/Бөлімді таңдалған/)
  assert.match(html,/Оқушылар/);assert.match(html,/Топтар/);assert.match(html,/Сақтау/)
  assert.doesNotMatch(html,/Тапсыру саны|Тапсыру мерзімі|Бөлімнен рұқсат|растаймын|3 әрекет/)
 }
 const quiz=render({id:2,title:'Quiz',kind:'item',type:'quiz'})
 assert.match(quiz,/Тапсыру саны/);assert.match(quiz,/Тапсыру мерзімі/)
})
