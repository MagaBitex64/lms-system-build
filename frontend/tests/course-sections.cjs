const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')
function load(file, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX},
  }).outputText
  vm.runInNewContext(code, {exports, require: name => dependencies[name] ?? require(name)})
  return exports
}
const helpers = load('lib/course-sections.ts')
const {groupCourseMaterials} = helpers
const sections = [{id: 2, title: 'Second', position: 1}, {id: 1, title: 'First', position: 0}]
const items = [{id: 1, title: 'Legacy', position: 2}, {id: 2, title: 'Lesson', position: 1, section_id: 1}, {id: 3, title: 'Quiz', position: 0, section_id: 1}]
test('grouping preserves every original ID, orders folders and materials, retains ungrouped legacy content', () => {
  const groups = groupCourseMaterials(sections, items)
  assert.deepEqual(JSON.parse(JSON.stringify(groups.map(group => group.id))), [1, 2, null])
  assert.deepEqual(JSON.parse(JSON.stringify(groups.flatMap(group => group.items.map(item => item.id)))), [3, 2, 1])
  assert.equal(items[0].id, 1)
  assert.equal(groups.at(-1).title, 'Бөлімге бөлінбеген материалдар')
})
test('missing section metadata never drops a legacy material', () => {
  assert.equal(groupCourseMaterials([], [{id: 9, title: 'Fallback', position: 0, section_id: 99}]).at(-1).items[0].id, 9)
})
const ui = {
  Button: ({children, onClick, ...props}) => React.createElement('button', {...props, onClick}, children),
  DropdownMenu: () => null,
  Modal: ({open, children}) => open ? React.createElement('div', {}, children) : null,
  ErrorState: () => null,
}
const Component = load('app/components/course-content-sections.tsx', {
  '@/lib/course-sections': helpers, '@/lib/api': {}, './ui': ui,
  'lucide-react': new Proxy({}, {get: () => () => null}),
}).default
test('collapsed 100+ material folders do not mount cards; students have no management actions', () => {
  let rendered = 0
  const props = {courseId: 1, sections, items: Array.from({length: 125}, (_, index) => ({id: index + 10, title: `Material ${index}`, position: index, section_id: 1})),
    isOwner: false, reload: async () => {}, onAdd: () => {}, renderItem: item => {rendered++; return React.createElement('p', {}, item.title)}}
  const html = renderToStaticMarkup(React.createElement(Component, props))
  assert.equal(rendered, 0)
  assert.ok(html.includes('125'))
  assert.ok(html.includes('aria-expanded="false"'))
  assert.ok(!html.includes('Бөлім қосу'))
  assert.ok(!html.includes('жоғары жылжыту'))
})
test('ungrouped legacy cards remain expanded and owners retain folder controls', () => {
  let rendered = 0
  const html = renderToStaticMarkup(React.createElement(Component, {courseId: 1, sections, items, isOwner: true,
    reload: async () => {}, onAdd: () => {}, renderItem: item => {rendered++; return React.createElement('p', {}, item.title)}}))
  assert.equal(rendered, 1)
  assert.ok(html.includes('Legacy'))
  assert.ok(html.includes('Бөлім қосу'))
  assert.ok(html.includes('жоғары жылжыту'))
})
