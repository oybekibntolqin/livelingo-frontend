import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function LanguageExercisesPage() {
  useSEO({
    title: 'Language Learning Exercises — CEFR-Graded | LiveLingo',
    description:
      'Practice grammar and vocabulary with CEFR-graded language exercises on LiveLingo. Bite-sized checkpoints that track your level as you go — in 15+ languages.',
    path: '/language-exercises',
  })

  return (
    <SeoPageLayout
      eyebrow="Exercises"
      h1="Short, CEFR-graded exercises that actually track your level"
      intro="Grammar and vocabulary drills, organized into checkpoints by CEFR level (A1–C2), so every exercise you complete is measurable progress — not just busywork."
    >
      <SeoSection h2="How the exercises are structured">
        <p>
          Exercises are grouped into checkpoints matched to your current CEFR level. Each
          checkpoint focuses on a specific grammar point or vocabulary set, with immediate
          feedback on every answer, so you know right away what to review.
        </p>
      </SeoSection>

      <SeoSection h2="Exercises fit around your other practice">
        <ul className="list-disc space-y-2 pl-5">
          <li>Short enough to do in a few minutes between other activities.</li>
          <li>XP and streaks keep a daily habit visible and worth keeping up.</li>
          <li>
            Pairs naturally with{' '}
            <a href="/reading-practice" className="text-indigo-600 underline underline-offset-2">
              reading
            </a>
            ,{' '}
            <a href="/listening-practice" className="text-indigo-600 underline underline-offset-2">
              listening
            </a>
            , and{' '}
            <a href="/writing-practice" className="text-indigo-600 underline underline-offset-2">
              writing
            </a>{' '}
            practice for a fuller session.
          </li>
        </ul>
      </SeoSection>

      <SeoSection h2="Beyond exercises">
        <p>
          Once the grammar and vocabulary feel comfortable, put it to use in a live{' '}
          <a href="/language-exchange" className="text-indigo-600 underline underline-offset-2">
            language exchange
          </a>{' '}
          conversation.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
