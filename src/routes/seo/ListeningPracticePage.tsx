import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function ListeningPracticePage() {
  useSEO({
    title: 'Listening Practice — Real Audio, Real Pace | LiveLingo',
    description:
      'Train your ear on LiveLingo with real-paced listening material, transcripts, and comprehension questions — in 15+ languages.',
    path: '/listening-practice',
  })

  return (
    <SeoPageLayout
      eyebrow="Listening practice"
      h1="Train your ear with real-paced listening material"
      intro="Understanding a language at natural speed is one of the hardest skills to build alone. LiveLingo's listening practice uses real audio, transcripts, and comprehension checks to close that gap."
    >
      <SeoSection h2="How it works">
        <ul className="list-disc space-y-2 pl-5">
          <li>Choose audio at your CEFR level and language.</li>
          <li>Listen with playback speed control and an optional transcript.</li>
          <li>Answer comprehension questions to check what you actually caught.</li>
          <li>Review your results and track improvement over time.</li>
        </ul>
      </SeoSection>

      <SeoSection h2="From listening to speaking">
        <p>
          Listening comprehension is the foundation for real conversation. Once audio at your
          level feels manageable, try a live{' '}
          <a href="/language-exchange" className="text-indigo-600 underline underline-offset-2">
            language exchange
          </a>{' '}
          call over{' '}
          <a href="/video-chat" className="text-indigo-600 underline underline-offset-2">
            video chat
          </a>{' '}
          to practice listening in real time.
        </p>
      </SeoSection>

      <SeoSection h2="Round out your practice">
        <p>
          Combine listening with{' '}
          <a href="/reading-practice" className="text-indigo-600 underline underline-offset-2">
            reading
          </a>{' '}
          and{' '}
          <a href="/language-exercises" className="text-indigo-600 underline underline-offset-2">
            exercises
          </a>{' '}
          for a complete study session.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
