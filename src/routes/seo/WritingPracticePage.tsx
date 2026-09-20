import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function WritingPracticePage() {
  useSEO({
    title: 'Writing Practice With AI Feedback | LiveLingo',
    description:
      'Practice writing on LiveLingo with guided prompts and AI feedback on grammar, vocabulary, and structure — in 15+ languages.',
    path: '/writing-practice',
  })

  return (
    <SeoPageLayout
      eyebrow="Writing practice"
      h1="Writing practice with feedback you can actually use"
      intro="Writing forces you to slow down and get grammar and word choice right. LiveLingo gives you guided prompts and clear AI feedback so every attempt teaches you something."
    >
      <SeoSection h2="How writing practice works">
        <ul className="list-disc space-y-2 pl-5">
          <li>Choose a prompt matched to your CEFR level and language.</li>
          <li>Write your response — no strict time pressure while you're practicing.</li>
          <li>Get feedback on grammar, vocabulary, and structure right after submitting.</li>
          <li>Review past attempts to see specific patterns to work on.</li>
        </ul>
      </SeoSection>

      <SeoSection h2="Exam-style practice">
        <p>
          If you're preparing for a certificate exam, LiveLingo also offers timed writing exam
          sessions that match common certificate formats and scoring.
        </p>
      </SeoSection>

      <SeoSection h2="Round out your practice">
        <p>
          Writing pairs well with{' '}
          <a href="/reading-practice" className="text-indigo-600 underline underline-offset-2">
            reading
          </a>{' '}
          for input and vocabulary, and{' '}
          <a href="/language-exercises" className="text-indigo-600 underline underline-offset-2">
            exercises
          </a>{' '}
          for grammar fundamentals.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
