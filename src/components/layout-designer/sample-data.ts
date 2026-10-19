import { db } from '@/db'
import type { Question } from '@/db'
import type { GameEvent, ScoreboardRow } from '@/transport/types'
import type { PlayerData, ScreenData } from '@/widgets/types'

type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>

/** What the designer's live preview shows: a real game's question and scores, when it has them. */
export interface PreviewSample {
  question: QuestionContent
  rows: ScoreboardRow[]
}

const FALLBACK_QUESTION: Pick<Question, 'id' | 'title' | 'description' | 'options' | 'answer'> = {
  id: 'sample',
  title: 'Which planet is known as the Red Planet?',
  description: 'Pick one',
  options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
  answer: 'Mars',
}

const FALLBACK_ROWS: ScoreboardRow[] = [
  { id: 's1', name: 'The Quizzly Bears', score: 12 },
  { id: 's2', name: 'Les Quizerables', score: 9 },
  { id: 's3', name: 'Ann', score: 5 },
]

function content(q: Pick<Question, 'id' | 'title' | 'description' | 'options' | 'answer'>) {
  return {
    type: 'QUESTION_CONTENT',
    target: 'screen',
    questionId: q.id,
    title: q.title,
    description: q.description || null,
    options: q.options?.length ? q.options : null,
    answer: q.answer || null,
    choices: null,
    acceptsText: false,
    // Media stays out: a preview shouldn't load remote files
    media: null,
    mediaType: null,
  } satisfies QuestionContent
}

/**
 * Sample data for the preview: the first question and the scores of game `gameId`, or a
 * made-up question and teams for templates and games that have neither yet.
 */
export async function loadPreviewSample(gameId: string | null): Promise<PreviewSample> {
  if (!gameId) return { question: content(FALLBACK_QUESTION), rows: FALLBACK_ROWS }
  const [gameQuestions, players, teams] = await Promise.all([
    db.gameQuestions.where('gameId').equals(gameId).sortBy('order'),
    db.players.where('gameId').equals(gameId).toArray(),
    db.teams.where('gameId').equals(gameId).toArray(),
  ])
  const first = gameQuestions[0] && (await db.questions.get(gameQuestions[0].questionId))
  const rows = [...teams, ...players.filter(p => !p.teamId)]
    .map(e => ({ id: e.id, name: e.name, score: e.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
  return {
    question: content(first ?? FALLBACK_QUESTION),
    rows: rows.length ? rows : FALLBACK_ROWS,
  }
}

/** What a player's phone would show with `sample`. */
export function samplePlayerData(sample: PreviewSample): PlayerData {
  return {
    message: { text: 'Welcome to quiz night!' },
    question: { ...sample.question, target: 'players', answer: null },
    ended: false,
    buzzer: { enabled: true, label: 'Buzz', onBuzz: () => {} },
    choice: null,
    typed: null,
  }
}

/** What a projector screen would show with `sample`. */
export function sampleScreenData(sample: PreviewSample): ScreenData {
  return {
    heading: 'Round 1 · Question 1',
    content: sample.question,
    message: 'Welcome to quiz night!',
    rows: sample.rows,
    logEntries: [
      { id: 'l1', at: 0, kind: 'buzz', who: sample.rows[0]?.name ?? 'Ann', details: '' },
    ],
    timers: null,
  }
}
