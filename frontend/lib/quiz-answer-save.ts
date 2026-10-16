export type QuizAnswer = { question_id: number; selected_option_ids: number[]; text_answer: string }
type SaveBody = { revision: number; request_id: string; answers: QuizAnswer[] }
type SaveResult = { revision: number; submitted: boolean }
export type AnswerBatch = {
  sequence: number
  revision: number
  chunks: QuizAnswer[][]
  index: number
  request: SaveBody | null
}

// Bound individual requests, not the total number of questions in a quiz.
export function createAnswerBatch(answers: QuizAnswer[], revision: number, sequence: number): AnswerBatch {
  const chunks: QuizAnswer[][] = []
  let chunk: QuizAnswer[] = []
  let bytes = 0
  const encoder = new TextEncoder()
  for (const answer of answers) {
    const size = encoder.encode(JSON.stringify(answer)).length + 1
    if (chunk.length && (chunk.length >= 1000 || bytes + size > 512 * 1024)) {
      chunks.push(chunk)
      chunk = []
      bytes = 0
    }
    chunk.push(answer)
    bytes += size
  }
  if (chunk.length) chunks.push(chunk)
  return { sequence, revision, chunks, index: 0, request: null }
}

export async function persistAnswerBatch(batch: AnswerBatch, send: (body: SaveBody) => Promise<SaveResult>): Promise<SaveResult> {
  while (batch.index < batch.chunks.length) {
    // Keep the exact request ID/revision after a lost response, for safe retry.
    batch.request ??= { revision: batch.revision, request_id: crypto.randomUUID(), answers: batch.chunks[batch.index] }
    const result = await send(batch.request)
    batch.revision = result.revision
    batch.index += 1
    batch.request = null
    if (result.submitted) return result
  }
  return { revision: batch.revision, submitted: false }
}
