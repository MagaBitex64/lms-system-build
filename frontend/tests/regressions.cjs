const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.runInNewContext(js, {
    exports, require: name => dependencies[name] ?? require(name),
    TextEncoder, crypto: require('node:crypto'), Promise,
  })
  return exports
}
const { createAnswerBatch, persistAnswerBatch } = load('lib/quiz-answer-save.ts')
const answers = count => Array.from({ length: count }, (_, i) => ({
  question_id: i + 1, selected_option_ids: [i + 1], text_answer: '',
}))

test('1001 answers are saved in bounded requests with advancing revisions', async () => {
  const batch = createAnswerBatch(answers(1001), 0, 7)
  const sizes = []
  await persistAnswerBatch(batch, async body => {
    assert.equal(body.revision, sizes.length)
    sizes.push(body.answers.length)
    return { revision: sizes.length, submitted: false }
  })
  assert.deepEqual(sizes, [1000, 1])
  assert.equal(batch.revision, 2)
  assert.equal(batch.sequence, 7)
})

test('large Unicode text answers also stay below the HTTP body limit', () => {
  const values = answers(100)
  values.forEach(answer => { answer.text_answer = 'Ж'.repeat(20000) })
  const batch = createAnswerBatch(values, 0, 1)
  assert.ok(batch.chunks.length > 1)
  for (const chunk of batch.chunks) assert.ok(Buffer.byteLength(JSON.stringify(chunk)) < 600 * 1024)
})

test('a lost response retries the same request before saving the next chunk', async () => {
  const batch = createAnswerBatch(answers(1001), 0, 1)
  let firstId
  let calls = 0
  const send = async body => {
    calls += 1
    if (calls === 1) { firstId = body.request_id; throw new Error('response lost') }
    if (calls === 2) {
      assert.equal(body.request_id, firstId)
      assert.equal(body.revision, 0)
      return { revision: 1, submitted: false }
    }
    assert.equal(body.revision, 1)
    return { revision: 2, submitted: false }
  }
  await assert.rejects(persistAnswerBatch(batch, send), /response lost/)
  await persistAnswerBatch(batch, send)
  assert.equal(calls, 3)
  assert.equal(batch.revision, 2)
})

test('expiry stops remaining chunks instead of overwriting a completed attempt', async () => {
  const batch = createAnswerBatch(answers(1001), 0, 1)
  let calls = 0
  const result = await persistAnswerBatch(batch, async () => {
    calls += 1
    return { revision: 0, submitted: true }
  })
  assert.equal(calls, 1)
  assert.equal(result.submitted, true)
})

test('group pickers fetch every page, including group 101', async () => {
  const urls = []
  const { fetchAllGroups } = load('lib/groups.ts', {
    swr: () => {},
    './api': { api: async url => {
      urls.push(url)
      const offset = urls.length === 1 ? 0 : 100
      return { total: 101, items: Array.from({ length: offset ? 1 : 100 }, (_, i) => ({ id: offset + i + 1 })) }
    } },
  })
  const result = await fetchAllGroups()
  assert.equal(result.items.length, 101)
  assert.equal(result.items[100].id, 101)
  assert.deepEqual(urls, ['/admin/groups?per_page=100&page=1', '/admin/groups?per_page=100&page=2'])
})
