// Reading — 6 ta savol turini render qiladigan umumiy komponent.
// components/listening/QuestionsList.tsx bilan bir xil naqsh, lekin
// Reading'ga xos: savollar TUR bo'yicha guruhlanadi (section emas),
// va MCQ/TRUE_FALSE_NOT_GIVEN/MATCHING_HEADINGS/MATCHING_INFO — 4
// tur ham aslida bir xil "options ro'yxatidan bittasini tanlash"
// vidjetini ishlatadi (faqat savol matni farq qiladi) — shuning
// uchun bitta umumiy <ChoiceQuestion> orqali render qilinadi.

import {useMemo} from 'react'
import {groupByQuestionType, parseOptions, type ReadingQuestionPublic,} from '../../lib/reading'

const CHOICE_TYPES = new Set([
    'MCQ',
    'TRUE_FALSE_NOT_GIVEN',
    'MATCHING_HEADINGS',
    'MATCHING_INFO',
])

export function ReadingQuestionsList({
                                         questions,
                                         answers,
                                         onChangeAnswer,
                                         disabled = false,
                                     }: {
    questions: ReadingQuestionPublic[]
    answers: Record<string, string>
    onChangeAnswer: (id: string, v: string) => void
    // true bo'lsa — savollar KO'RINADI, lekin javob berib bo'lmaydi
    // (Exam'нинг "Men tayyorman"dan oldingi preview bosqichi uchun)
    disabled?: boolean
}) {
    const grouped = useMemo(() => groupByQuestionType(questions), [questions])

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
                                {group.label}
                            </p>
                            <p className="text-xs text-ink-muted">{group.hint}</p>
                        </div>
                        <div className="divide-y divide-ink/6">
                            {group.items.map((q) => (
                                <ReadingQuestionBlock
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

function ReadingQuestionBlock({
                                  question: q,
                                  answer,
                                  onChange,
                                  disabled = false,
                              }: {
    question: ReadingQuestionPublic
    answer: string
    onChange: (v: string) => void
    disabled?: boolean
}) {
    const options = useMemo(() => parseOptions(q.options), [q.options])

    return (
        <div className={`px-5 py-4 ${disabled ? 'opacity-70' : ''}`}>
            <div className="mb-3 flex items-start gap-3">
        <span
            className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-cream font-mono text-[10px] font-semibold text-ink-soft tabular-nums">
          {q.orderIndex}
        </span>
                <p className="flex-1 text-sm leading-relaxed text-ink">
                    {/* GAP_FILL'да "_____" ko'rinishida keladi — buni vizual
          jihatdan ajratib ko'rsatamiz. */}
                    {q.questionType === 'GAP_FILL'
                        ? q.question.split('_____').map((part, i, arr) => (
                            <span key={i}>
                  {part}
                                {i < arr.length - 1 && (
                                    <span
                                        className="mx-1 inline-block rounded border-b-2 border-indigo-400 px-2 text-transparent">
                      ____
                    </span>
                                )}
                </span>
                        ))
                        : q.question}
                </p>
            </div>

            <div className="pl-9">
                {CHOICE_TYPES.has(q.questionType) && (
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

                {(q.questionType === 'GAP_FILL' || q.questionType === 'SHORT_ANSWER') && (
                    <input
                        type="text"
                        value={answer}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={
                            q.questionType === 'GAP_FILL' ? "Bo'sh joyga so'z..." : 'Javobingiz…'
                        }
                        className="w-full max-w-md rounded-xl border border-ink/12 bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed"
                    />
                )}
            </div>
        </div>
    )
}
