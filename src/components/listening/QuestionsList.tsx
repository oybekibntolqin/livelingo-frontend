// Umumiy savol-javob render komponenti — avval faqat
// ListeningPracticeSession.tsx ичida yashiringan edi, endi
// ListeningExam.tsx (va kelajakda boshqa joylar) ham ishlatishi
// uchun alohida faylga ko'chirildi.

import { useMemo } from 'react'
import { parseOptions, type ListeningQuestionPublic } from '../../lib/listening'

export function QuestionsList({
  grouped,
  answers,
  onChangeAnswer,
  disabled = false,
}: {
  grouped: Array<{ section: string; items: ListeningQuestionPublic[] }>
  answers: Record<string, string>
  onChangeAnswer: (id: string, v: string) => void
  // true bo'lsa — savollar KO'RINADI, lekin javob berib bo'lmaydi
  // (Exam rejimida "Men tayyorman"ni bosishdan oldingi preview uchun)
  disabled?: boolean
}) {
  return (
      <section>
        <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
          Savollar
        </p>
        <div className="space-y-6">
          {grouped.map((group, gi) => (
              <div
                  key={gi}
                  className="overflow-hidden rounded-3xl border border-ink/8 bg-white shadow-sm"
              >
                <div className="border-b border-ink/6 bg-cream/60 px-5 py-3">
                  <p className="font-display text-sm font-semibold text-ink">
                    {group.section}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {group.items.length} ta savol
                  </p>
                </div>
                <div className="divide-y divide-ink/6">
                  {group.items.map((q) => (
                      <QuestionBlock
                          key={q.id}
                          question={q}
                          answer={answers[q.id] ?? ''}
                          onChange={(v) => onChangeAnswer(q.id, v)}
                          disabled={disabled}
                      />
                  ))}
                </div>
              </div>
          ))}
        </div>
      </section>
  )
}

function QuestionBlock({
  question: q,
  answer,
  onChange,
  disabled = false,
}: {
  question: ListeningQuestionPublic
  answer: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const options = useMemo(() => parseOptions(q.options), [q.options])

  return (
      <div className={`px-5 py-4 ${disabled ? 'opacity-70' : ''}`}>
        <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-cream font-mono text-[10px] font-semibold text-ink-soft tabular-nums">
          {q.orderIndex}
        </span>
          <p className="flex-1 text-sm leading-relaxed text-ink">{q.question}</p>
        </div>

        <div className="pl-9">
          {q.questionType === 'MCQ' && (
              <div className="space-y-1.5">
                {options.map((opt, i) => {
                  const selected = answer === opt
                  return (
                      <label
                          key={i}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                          } ${
                              selected
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-ink/8 bg-white hover:border-indigo-500/25 hover:bg-cream'
                          }`}
                      >
                        <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={selected}
                            disabled={disabled}
                            onChange={() => onChange(opt)}
                            className="h-4 w-4 accent-indigo-500"
                        />
                        <span className="text-sm text-ink">{opt}</span>
                      </label>
                  )
                })}
              </div>
          )}
          {q.questionType === 'TRUE_FALSE' && (
              <div className="flex flex-wrap gap-1.5">
                {(options.length ? options : ['True', 'False']).map((opt) => {
                  const selected = answer === opt
                  return (
                      <button
                          key={opt}
                          disabled={disabled}
                          onClick={() => onChange(opt)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                              disabled ? 'cursor-not-allowed' : ''
                          } ${
                              selected
                                  ? 'border-indigo-500 bg-indigo-500 text-white'
                                  : 'border-ink/12 bg-white text-ink-soft hover:border-indigo-500/30'
                          }`}
                      >
                        {opt}
                      </button>
                  )
                })}
              </div>
          )}
          {q.questionType === 'SHORT_ANSWER' && (
              <input
                  type="text"
                  value={answer}
                  disabled={disabled}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Javobingiz…"
                  className="w-full max-w-md rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed"
              />
          )}
        </div>
      </div>
  )
}
