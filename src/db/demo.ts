import { db } from './index'
import type { Game, Player, Question, QuestionType, Round, Team } from './index'
import { seedPlayersTeams } from './players-teams'
import { generateRoomId } from '@/transport'

/**
 * Demo data, loaded via `npm run demo` (the `?demo` URL flag, dev only) or the
 * "Load demo data" button on the debug page (the version entry in the sidebar).
 * Only imported dynamically, so it stays out of the initial bundle.
 */

export const DEMO_GAME_NAME = 'Demo Night'

type Seed = [
  title: string,
  type: QuestionType,
  answer: string,
  options: string[],
  difficulty: string,
  tag: string,
]

const ROUNDS: { name: string; description: string; questions: Seed[] }[] = [
  {
    name: 'Warm-up',
    description: 'Easy openers',
    questions: [
      [
        'What is the capital of France?',
        'multiple_choice',
        'Paris',
        ['Paris', 'Lyon', 'Marseille', 'Nice'],
        'Easy',
        'Geography',
      ],
      [
        'The Great Wall of China is visible from the Moon with the naked eye.',
        'true_false',
        'False',
        ['True', 'False'],
        'Easy',
        'History',
      ],
      [
        'How many players does a football (soccer) team field?',
        'multiple_choice',
        '11',
        ['9', '10', '11', '12'],
        'Easy',
        'Sports',
      ],
      ['Which planet is known as the Red Planet?', 'open_ended', 'Mars', [], 'Easy', 'Science'],
    ],
  },
  {
    name: 'Screen & Sound',
    description: 'Movies and music',
    questions: [
      [
        'Who directed "Jurassic Park" (1993)?',
        'multiple_choice',
        'Steven Spielberg',
        ['James Cameron', 'Steven Spielberg', 'George Lucas', 'Ridley Scott'],
        'Medium',
        'Movies',
      ],
      [
        'Which band released the album "Abbey Road"?',
        'open_ended',
        'The Beatles',
        [],
        'Medium',
        'Music',
      ],
      [
        '"Titanic" won the Academy Award for Best Picture.',
        'true_false',
        'True',
        ['True', 'False'],
        'Medium',
        'Movies',
      ],
      [
        'Which artist recorded "Thriller"?',
        'multiple_choice',
        'Michael Jackson',
        ['Prince', 'Madonna', 'Michael Jackson', 'Whitney Houston'],
        'Easy',
        'Pop Culture',
      ],
    ],
  },
  {
    name: 'The Hard Stuff',
    description: 'For the finalists',
    questions: [
      [
        'Who wrote "One Hundred Years of Solitude"?',
        'open_ended',
        'Gabriel García Márquez',
        [],
        'Hard',
        'Literature',
      ],
      [
        'What is the chemical symbol for tungsten?',
        'multiple_choice',
        'W',
        ['Tu', 'Tn', 'W', 'Wo'],
        'Hard',
        'Science',
      ],
      [
        'In which year did the Berlin Wall fall?',
        'multiple_choice',
        '1989',
        ['1987', '1989', '1990', '1991'],
        'Medium',
        'History',
      ],
      [
        'Mount Everest is on the border of Nepal and China.',
        'true_false',
        'True',
        ['True', 'False'],
        'Hard',
        'Geography',
      ],
    ],
  },
]

const TEAMS = [
  { name: 'Quizzly Bears', color: '#e67e22', icon: 'Zap', players: ['Alice', 'Bob'] },
  { name: 'Know-It-Owls', color: '#2980b9', icon: 'Shield', players: ['Carol', 'Dave'] },
]

/**
 * Seeds a ready-to-run demo game with questions, rounds, teams and players.
 * Idempotent: does nothing if the demo game already exists.
 * Expects {@link seedDefaults} to have completed (difficulties and tags exist).
 */
export async function seedDemo(): Promise<void> {
  if ((await db.games.filter(g => g.name === DEMO_GAME_NAME).count()) > 0) return

  await seedPlayersTeams()

  const [difficulties, tags] = await Promise.all([db.difficulties.toArray(), db.tags.toArray()])
  const diffId = (name: string) => difficulties.find(d => d.name === name)?.id ?? null
  const tagIds = (name: string) => tags.filter(t => t.name === name).map(t => t.id)

  const now = Date.now()
  const questions: Question[] = []
  const rounds: Round[] = ROUNDS.map(r => {
    const qs = r.questions.map(([title, type, answer, options, difficulty, tag]): Question => ({
      id: crypto.randomUUID(),
      title,
      type,
      options,
      answer,
      description: '',
      difficulty: diffId(difficulty),
      tags: tagIds(tag),
      media: null,
      mediaType: null,
      createdAt: now,
      updatedAt: now,
    }))
    questions.push(...qs)
    return {
      id: crypto.randomUUID(),
      name: r.name,
      description: r.description,
      questionIds: qs.map(q => q.id),
      createdAt: now,
    }
  })

  const game: Game = {
    id: crypto.randomUUID(),
    name: DEMO_GAME_NAME,
    status: 'waiting',
    roomId: generateRoomId(),
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    requireApproval: false,
    allowPlayerTeams: true,
    roundIds: rounds.map(r => r.id),
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: true,
    scoringEnabled: true,
    buzzerEnabled: true,
    autoLockOnFirstCorrect: true,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: now,
    updatedAt: now,
  }

  const teams: Team[] = TEAMS.map(t => ({
    id: crypto.randomUUID(),
    gameId: game.id,
    name: t.name,
    color: t.color,
    icon: t.icon,
    score: 0,
  }))
  const players: Player[] = TEAMS.flatMap((t, i) =>
    t.players.map(name => ({
      id: crypto.randomUUID(),
      gameId: game.id,
      name,
      teamId: teams[i].id,
      score: 0,
      presence: 'connected',
      deviceId: crypto.randomUUID(),
      joinedAt: now,
    }))
  )

  let order = 0
  const gameQuestions = rounds.flatMap(r =>
    r.questionIds.map(questionId => ({
      id: crypto.randomUUID(),
      gameId: game.id,
      questionId,
      roundId: r.id,
      order: order++,
      status: 'pending' as const,
    }))
  )

  await db.transaction(
    'rw',
    [db.questions, db.rounds, db.games, db.teams, db.players, db.gameQuestions],
    async () => {
      await db.questions.bulkAdd(questions)
      await db.rounds.bulkAdd(rounds)
      await db.games.add(game)
      await db.teams.bulkAdd(teams)
      await db.players.bulkAdd(players)
      await db.gameQuestions.bulkAdd(gameQuestions)
    }
  )
}
