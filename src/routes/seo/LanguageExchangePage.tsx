import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function LanguageExchangePage() {
  useSEO({
    title: 'Language Exchange — Practice With Real People | LiveLingo',
    description:
      'Find a language exchange partner on LiveLingo and practice speaking with real native and fellow learners over live P2P video chat — in 15+ languages.',
    path: '/language-exchange',
  })

  return (
    <SeoPageLayout
      eyebrow="Language exchange"
      h1="Find a language exchange partner and just talk"
      intro="Textbooks teach vocabulary. Conversation teaches fluency. LiveLingo connects you with real people — native speakers and fellow learners — for live, spoken practice."
    >
      <SeoSection h2="Why language exchange works">
        <p>
          Language exchange pairs people learning each other's languages, so both sides
          practice and both sides help. It's one of the fastest ways to get comfortable
          speaking out loud, handling real accents and pace, and picking up the natural
          phrasing that a textbook rarely teaches.
        </p>
      </SeoSection>

      <SeoSection h2="How it works on LiveLingo">
        <ul className="list-disc space-y-2 pl-5">
          <li>Set your native language and the language you're learning during onboarding.</li>
          <li>
            Find and chat with other learners, then move to a live{' '}
            <a href="/video-chat" className="text-indigo-600 underline underline-offset-2">
              P2P video call
            </a>{' '}
            whenever you're ready to talk.
          </li>
          <li>Practice at your level — CEFR tagging helps you find a comfortable match.</li>
        </ul>
      </SeoSection>

      <SeoSection h2="Not ready to talk yet?">
        <p>
          You don't need to start with a live conversation. Many learners warm up with{' '}
          <a href="/speaking-practice" className="text-indigo-600 underline underline-offset-2">
            speaking practice
          </a>{' '}
          exercises or a few rounds of{' '}
          <a href="/language-exercises" className="text-indigo-600 underline underline-offset-2">
            exercises
          </a>{' '}
          first, then move into a real exchange once they feel ready.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
