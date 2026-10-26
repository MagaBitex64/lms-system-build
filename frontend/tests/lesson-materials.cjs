const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')

const source = fs.readFileSync(path.join(__dirname, '../app/items/[id]/page.tsx'), 'utf8')
function render(data, role = 'admin', archive = false) {
  const ui = new Proxy({}, {get: (_, name) => props => React.createElement(
    name === 'Textarea' ? 'textarea' : name === 'Input' ? 'input' : name === 'Select' ? 'select' : 'div',
    {}, props.children,
  )})
  const dependencies = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': {useParams: () => ({id: '2'}), useSearchParams: () => new URLSearchParams(archive ? 'legacyQuiz=1' : '')},
    'next/link': {default: ({href, children}) => React.createElement('a', {href}, children)},
    swr: {default: () => ({data, mutate: async () => {}})},
    'lucide-react': new Proxy({}, {get: () => () => null}),
    '@/lib/auth': {useAuth: () => ({user: {role}})},
    '@/lib/i18n': {useI18n: () => ({t: key => key})},
    '@/components/ui': ui,
    '@/lib/api': {}, '@/lib/quiz-answer-save': {},
    '@/components/auth-image': {default: () => null},
    '@/components/latex-text': {default: ({text}) => React.createElement('span', {}, text)},
  }
  const exports = {}
  const code = ts.transpileModule(source + '\nexport { ItemDetailContent };', {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
  }).outputText
  vm.runInNewContext(code, {exports, require: name => dependencies[name] ?? require(name), URLSearchParams, URL})
  return renderToStaticMarkup(React.createElement(exports.ItemDetailContent))
}
const lesson = {
  type: 'lesson', item: {id: 2, title: 'Lesson fixture', course_id: 1},
  content: 'Educational text', youtube_url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8',
  materials: [{id: 1, kind: 'link', url: 'https://example.com/material', label: 'External material'}],
  has_quiz: true, question_count: 1, max_score: 100, weight_pct: 20,
  time_limit_minutes: 30, open_at: '2026-01-01T00:00:00Z', questions: [],
}
test('regular lesson editor retains materials and saves, without embedded quiz controls', () => {
  const html = render(lesson)
  for (const text of ['youtube', 'attachFiles', 'links', 'save', 'External material']) {
    assert.ok(html.includes(text), text)
  }
  for (const text of ['Word арқылы импорт', 'addQuestion', 'Сұрақтарды араластыру', 'Time limit', 'maxScore', 'openDate']) {
    assert.ok(!html.includes(text), text)
  }
  assert.ok(html.includes('/items/2?legacyQuiz=1'))
})
test('student lesson shows content and video, but no quiz start or questions', () => {
  const html = render(lesson, 'student')
  assert.ok(html.includes('Educational text'))
  assert.ok(html.includes('https://www.youtube.com/embed/kqtD5dpn9C8'))
  assert.ok(html.includes('https://example.com/material'))
  for (const text of ['startQuiz', 'submitQuiz', 'legacyQuiz=1', 'maxScore']) assert.ok(!html.includes(text))
})
test('empty lessons do not offer an archive and cannot enable it through the query string', () => {
  const html = render({...lesson, question_count: 0}, 'admin', true)
  assert.ok(!html.includes('legacyQuiz=1'))
  assert.ok(!html.includes('Word арқылы импорт'))
  assert.ok(html.includes('youtube'))
})
test('historical editor and standalone tests retain Word tools and test settings', () => {
  for (const html of [render(lesson, 'admin', true), render({...lesson, type: 'quiz', is_topical: true})]) {
    assert.ok(html.includes('Word арқылы импорт және экспорт'))
    assert.ok(html.includes('Сұрақтарды араластыру'))
    assert.ok(html.includes('addQuestion'))
  }
})
test('historical attempts retain an archive even if no questions remain', () => {
  const html = render({...lesson, question_count: 0, has_history: true})
  assert.ok(html.includes('/items/2?legacyQuiz=1'))
})
