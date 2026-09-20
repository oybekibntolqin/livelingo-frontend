import { useSEO } from '../../lib/useSEO'
import SeoPageLayout, { SeoSection } from './SeoPageLayout'

export default function VideoChatPage() {
  useSEO({
    title: 'P2P Language Video Chat | LiveLingo',
    description:
      'Practice speaking a new language face-to-face with real people using LiveLingo\'s peer-to-peer (P2P) video chat — no scheduling apps, just live conversation.',
    path: '/video-chat',
  })

  return (
    <SeoPageLayout
      eyebrow="Video chat"
      h1="Face-to-face practice, powered by P2P video chat"
      intro="Seeing someone's expressions and hearing natural pace and intonation is hard to replace. LiveLingo's built-in peer-to-peer video chat lets you practice speaking without leaving the app."
    >
      <SeoSection h2="Why video, not just text">
        <p>
          Text chat is useful, but speaking is a different skill — timing, pronunciation,
          listening under pressure. A short video call with a{' '}
          <a href="/language-exchange" className="text-indigo-600 underline underline-offset-2">
            language exchange
          </a>{' '}
          partner gives you that practice in a low-stakes, one-on-one setting.
        </p>
      </SeoSection>

      <SeoSection h2="What you get in a call">
        <ul className="list-disc space-y-2 pl-5">
          <li>Direct peer-to-peer video and audio — call starts right from a chat.</li>
          <li>Mute, camera toggle, and speaker controls built in.</li>
          <li>Works alongside your ongoing text conversation, so nothing gets lost.</li>
        </ul>
      </SeoSection>

      <SeoSection h2="Before your first call">
        <p>
          If live conversation still feels early, build confidence first with{' '}
          <a href="/speaking-practice" className="text-indigo-600 underline underline-offset-2">
            speaking practice
          </a>{' '}
          or general{' '}
          <a href="/language-learning" className="text-indigo-600 underline underline-offset-2">
            language learning
          </a>{' '}
          exercises — then bring what you've practiced into a real call.
        </p>
      </SeoSection>
    </SeoPageLayout>
  )
}
