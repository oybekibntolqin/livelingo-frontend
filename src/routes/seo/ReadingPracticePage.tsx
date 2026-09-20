import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function ReadingPracticePage() {
  useSEO({
    title: 'Reading Practice — CEFR-Leveled Passages | LiveLingo',
    description:
      'Practice reading comprehension on LiveLingo with CEFR-leveled passages, built-in questions, and a distraction-free reader — in 15+ languages.',
    path: '/reading-practice',
  })

  return (
    <SeoPageLayout
      eyebrow="Reading practice"
      h1="Reading practice leveled to where you actually are"
      intro="Passages graded to the CEFR scale, with comprehension questions built in, so you're always reading something challenging enough to grow — not too easy, not overwhelming."
    >
      <SeoSection h2="How reading practice works">
        <ul className="list-disc space-y-2 pl-5">
          <li>Pick a passage at your CEFR level and language.</li>
          <li>Read in a clean, distraction-free reader.</li>
          <li>Answer comprehension questions and get instant feedback.</li>
          <li>Review your results any time in your reading history.</li>
        </ul>
      </SeoSection>

      <SeoSection h2="Vocabulary that sticks">
        <p>
          New words from what you read carry over naturally into flashcards and{' '}
          <a href="/language-exercises" className="text-indigo-600 underline underline-offset-2">
            exercises
          </a>
          , so reading practice compounds instead of staying isolated.
        </p>
      </SeoSection>

      <SeoSection h2="Balance your practice">
        <p>
          Pair reading with{' '}
          <a href="/listening-practice" className="text-indigo-600 underline underline-offset-2">
            listening
          </a>{' '}
          for input, and{' '}
          <a href="/writing-practice" className="text-indigo-600 underline underline-offset-2">
            writing
          </a>{' '}
          or{' '}
          <a href="/speaking-practice" className="text-indigo-600 underline underline-offset-2">
            speaking
          </a>{' '}
          for output — a well-rounded routine covers all four.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
