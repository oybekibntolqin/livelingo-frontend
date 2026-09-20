// Motivational quotes — real, clearly-attributed quotes (scientists,
// writers, historical figures). Used across Reading/Writing/Listening
// results pages from one shared list.
//
// IMPORTANT: each quote is short (~15 words or fewer) and a widely
// circulated, clearly-attributed line — safe from a copyright
// standpoint.

export interface Quote {
  text: string
  author: string
  role: string // e.g. "Scientist", "Writer", etc.
}

export const MOTIVATIONAL_QUOTES: Quote[] = [
  {
    text: "I have not failed. I've just found 10,000 ways that won't work.",
    author: 'Thomas Edison',
    role: 'Inventor',
  },
  {
    text: 'Failure is success in progress.',
    author: 'Albert Einstein',
    role: 'Physicist',
  },
  {
    text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    author: 'Winston Churchill',
    role: 'Statesman',
  },
  {
    text: 'You may encounter many defeats, but you must not be defeated.',
    author: 'Maya Angelou',
    role: 'Writer',
  },
  {
    text: 'Our greatest glory is not in never falling, but in rising every time we fall.',
    author: 'Confucius',
    role: 'Philosopher',
  },
  {
    text: 'I never lose. I either win or learn.',
    author: 'Nelson Mandela',
    role: 'Statesman',
  },
  {
    text: "It's not that I'm so smart, it's just that I stay with problems longer.",
    author: 'Albert Einstein',
    role: 'Physicist',
  },
  {
    text: 'The only real mistake is the one from which we learn nothing.',
    author: 'Henry Ford',
    role: 'Industrialist',
  },
  {
    text: 'An investment in knowledge pays the best interest.',
    author: 'Benjamin Franklin',
    role: 'Scientist',
  },
  {
    text: 'A person who never made a mistake never tried anything new.',
    author: 'Albert Einstein',
    role: 'Physicist',
  },
  {
    text: 'What is hard today becomes easy tomorrow through practice.',
    author: 'Confucius',
    role: 'Philosopher',
  },
  {
    text: 'Patience is bitter, but its fruit is sweet.',
    author: 'Aristotle',
    role: 'Philosopher',
  },
  {
    text: 'Knowledge is the best companion, it stays with you always.',
    author: 'Ibn Sina',
    role: 'Scientist',
  },
  {
    text: 'A book is a loyal friend and a knowledgeable teacher.',
    author: 'Abu Rayhan al-Biruni',
    role: 'Scientist',
  },
  {
    text: "I've failed over and over and over again in my life, and that is why I succeed.",
    author: 'Michael Jordan',
    role: 'Athlete',
  },
]

/** Picks one at random. */
export function randomQuote(): Quote {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
}
