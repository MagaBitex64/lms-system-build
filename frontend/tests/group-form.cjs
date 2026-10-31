const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/group-form.ts'), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText, {exports: exportsObject})
const {groupDirectionOptions, validateGroupForm} = exportsObject
const form = changes => ({get: key => ({code: ' ИМ2 ', title: ' Test group ', direction: 'Информатика-математика', capacity: '20', ...changes})[key]})

test('directions reuse database values, deduplicate subject order and preserve legacy directions', () => {
  const groups = [{direction: 'Математика-физика'}, {direction: 'Физика – Математика'}, {direction: 'Арнайы бағыт'}]
  const options = groupDirectionOptions(groups)
  assert.equal(options.length, 6)
  assert.equal(options.find(option => option.label === 'Физика – Математика').value, 'Математика-физика')
  assert.ok(options.some(option => option.value === 'Арнайы бағыт'))
  const editing = groupDirectionOptions(groups, 'Физика – Математика')
  assert.equal(editing.filter(option => option.label === 'Физика – Математика').length, 1)
  assert.ok(editing.some(option => option.value === 'Физика – Математика'))
})
test('editing an unknown saved direction retains its exact value', () => {
  assert.ok(groupDirectionOptions([], 'Legacy custom direction').some(option => option.value === 'Legacy custom direction'))
})
test('valid payload trims text, keeps capacity numeric and contains no stream', () => {
  const value = validateGroupForm(form())
  assert.equal(value.code, 'ИМ2')
  assert.equal(value.title, 'Test group')
  assert.equal(value.capacity, 20)
  assert.equal('stream' in value, false)
})
test('blank code, title, direction and invalid capacity are rejected in Kazakh', () => {
  for (const code of ['', '  ', 'A', 'A'.repeat(21)]) assert.throws(() => validateGroupForm(form({code})), /Топ коды/)
  for (const title of ['', ' ', 'A'.repeat(121)]) assert.throws(() => validateGroupForm(form({title})), /Атауы/)
  assert.equal('direction' in validateGroupForm(form({direction: ''})), false)
  for (const capacity of ['', '0', '-1', '1.5', '41', 'abc']) assert.throws(() => validateGroupForm(form({capacity})), /Орын саны/)
  for (const capacity of ['1', '40']) assert.equal(validateGroupForm(form({capacity})).capacity, Number(capacity))
})
