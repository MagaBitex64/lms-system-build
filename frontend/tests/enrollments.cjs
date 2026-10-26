const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')
function load(file, dependencies) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX},
  }).outputText, {exports, require: name => dependencies[name] ?? require(name)})
  return exports
}
let queries, urls = []
const helpers = load('lib/enrollments.ts', {
  swr: {mutate: async predicate => {queries = predicate}}, './groups': {},
  './api': {api: async url => {urls.push(url); return {total: 101, items: Array.from({length: urls.length === 1 ? 100 : 1}, (_, index) => ({id: (urls.length - 1) * 100 + index, full_name: 'Student', email: 'fixture@example.com'}))}}},
})
test('source labels distinguish direct, group, combined and unknown legacy access', () => {
  const student = {id: 1, full_name: 'Fixture', email: '', groups: []}
  assert.equal(helpers.enrollmentSource({...student, direct_enrollment: true}), 'Тікелей')
  assert.equal(helpers.enrollmentSource({...student, groups: [{id: 1}], direct_enrollment: false}), 'Топ арқылы')
  assert.equal(helpers.enrollmentSource({...student, groups: [{id: 1}], direct_enrollment: true}), 'Тікелей + топ арқылы')
  assert.equal(helpers.enrollmentSource({...student, direct_enrollment: null, legacy_access: true}), 'Бұрынғы қолжетімділік')
})
test('student picker loads beyond first 100 and cache refresh covers both workflows', async () => {
  urls = []
  assert.equal((await helpers.loadEnrollmentChoices('students')).length, 101)
  await helpers.refreshEnrollmentQueries()
  for (const key of ['/courses/7', '/courses/mine', '/admin/groups/2', 'admin-groups-all-pages', 'admin-student-directory', '/admin/students/3']) assert.equal(queries(key), true)
  assert.equal(queries('/unrelated'), false)
})
const component = load('app/components/enrollment-management.tsx', {
  '@/lib/enrollments': helpers, '@/lib/api': {},
  './ui': {Button: ({children, ...props}) => React.createElement('button', props, children), Modal: () => null},
  'lucide-react': new Proxy({}, {get: () => () => null}),
}).CourseEnrollmentManagement
test('course teacher sees assignments without enrollment mutation buttons', () => {
  const html = renderToStaticMarkup(React.createElement(component, {courseId: 7, groups: [{id: 1, code: 'ИМ1', title: 'Fixture', student_count: 3}], students: [], canManage: false}))
  assert.ok(html.includes('ИМ1'))
  assert.ok(!html.includes('Топ қосу'))
  assert.ok(!html.includes('Топты курстан шығару'))
})
