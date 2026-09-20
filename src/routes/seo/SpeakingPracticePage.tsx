import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function SpeakingPracticePage() {
  useSEO({
    title: 'Speaking Practice With Native Speakers | LiveLingo',
    description:
      'Build speaking confidence on LiveLingo with structured speaking exercises and live P2P video conversation with native and fellow language learners.',
    path: '/speaking-practice',
  })

  return (
    <SeoPageLayout
      eyebrow="Speaking practice"
      h1="Speaking practice that leads to a real conversation"
      intro="Speaking is the skill most learners avoid — and the one that improves fastest with practice. LiveLingo builds speaking confidence step by step, ending in live conversation."
    >
      <SeoSection h2="Start low-pressure">
        <p>
          Speaking practice on LiveLingo starts with structured prompts and recordings you
          control, so you can build confidence before talking live with someone else.
        </p>
      </SeoSection>

      <SeoSection h2="Then go live">
        <p>
          When you're ready, move into a{' '}
          <a href="/language-exchange" className="text-indigo-600 underline underline-offset-2">
            language exchange
          </a>{' '}
          conversation over{' '}
          <a href="/video-chat" className="text-indigo-600 underline underline-offset-2">
            P2P video chat
          </a>
          . Talking to a real person — not a script — is what actually builds fluency.
        </p>
      </SeoSection>

      <SeoSection h2="Round out your practice">
        <p>
          Speaking improves faster alongside{' '}
          <a href="/listening-practice" className="text-indigo-600 underline underline-offset-2">
            listening practice
          </a>{' '}
          — the two skills reinforce each other. Add{' '}
          <a href="/language-exercises" className="text-indigo-600 underline underline-offset-2">
            exercises
          </a>{' '}
          for the grammar and vocabulary behind what you're saying.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
