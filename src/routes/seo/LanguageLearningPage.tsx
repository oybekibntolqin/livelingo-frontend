import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function LanguageLearningPage() {
  useSEO({
    title: 'Language Learning With Real People | LiveLingo',
    description:
      'Learn a new language on LiveLingo with CEFR-graded exercises, speaking/reading/writing/listening practice, flashcards, and live video chat with real people — in 15+ languages.',
    path: '/language-learning',
  })

  return (
    <SeoPageLayout
      eyebrow="Language learning"
      h1="Learn a language the way you'll actually use it"
      intro="LiveLingo combines structured, CEFR-graded lessons with real conversation practice — so what you learn in an exercise, you can use minutes later in a live chat with another learner."
    >
      <SeoSection h2="What learning on LiveLingo looks like">
        <p>
          Most language apps stop at flashcards and multiple-choice drills. LiveLingo starts
          there too — with exercises, vocabulary, and grammar checkpoints leveled to the CEFR
          scale (A1 through C2) — but doesn't stop there. Every skill you build feeds into
          real use: reading passages, listening materials, writing prompts checked by AI, and
          live speaking practice with other learners over video.
        </p>
      </SeoSection>

      <SeoSection h2="Learn across all four skills">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Speaking</strong> — practice live with real people over
            P2P video chat, not just a chatbot.
          </li>
          <li>
            <strong className="text-ink">Reading</strong> — CEFR-leveled passages with
            comprehension questions and a built-in reader.
          </li>
          <li>
            <strong className="text-ink">Listening</strong> — real audio material with
            transcripts and comprehension checks.
          </li>
          <li>
            <strong className="text-ink">Writing</strong> — guided prompts with AI feedback on
            grammar, vocabulary, and structure.
          </li>
        </ul>
      </SeoSection>

      <SeoSection h2="Track your progress">
        <p>
          Your level, streak, accuracy, and words learned are all visible in one dashboard, so
          you always know what to practice next — instead of guessing.
        </p>
      </SeoSection>

      <SeoSection h2="Where to start">
        <p>
          Not sure what to try first? Most people start with a{' '}
          <a href="/language-exchange" className="text-indigo-600 underline underline-offset-2">
            language exchange
          </a>{' '}
          partner for conversation, or jump straight into{' '}
          <a href="/language-exercises" className="text-indigo-600 underline underline-offset-2">
            exercises
          </a>{' '}
          to warm up on grammar and vocabulary.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
