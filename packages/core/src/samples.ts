import type { Category, Question, Quiz } from './types';

/**
 * Seeded development PRACTICE content. Answer keys are intentionally public.
 * Do not use these objects or the client scoring helpers for ranked gameplay.
 * Hints are short excerpts from the public-domain King James Version (KJV).
 * Bible hints offer a word or idea association, not factual evidence for answers.
 */
export const categories: Category[] = [
  { id: 'fitness', name: 'Fitness', icon: 'fitness-outline', color: '#ec407a' },
  { id: 'geography', name: 'Geography', icon: 'earth-outline', color: '#308bde' },
  { id: 'sports', name: 'Sports', icon: 'basketball-outline', color: '#ef9b36' },
  { id: 'media', name: 'Media', icon: 'film-outline', color: '#8d57d7' },
  { id: 'music', name: 'Music', icon: 'musical-notes-outline', color: '#dd0089' },
  { id: 'science', name: 'Science', icon: 'flask-outline', color: '#28a390' },
];

const question = (id: string, prompt: string, answers: string[], correctIndex: number, hint: string, reference: string): Question =>
  ({ id, prompt, answers, correctIndex, hint, reference: `${reference} · KJV` });

const questionsByCategory: Record<string, Question[]> = {
  fitness: [
    question('fitness-1', 'What is the name of the 26.2-mile running race?', ['Sprint', 'Marathon', 'Triathlon', 'Relay'], 1, 'let us run with patience the race that is set before us', 'Hebrews 12:1'),
    question('fitness-2', 'Which organ pumps blood around your body?', ['Liver', 'Lungs', 'Heart', 'Stomach'], 2, 'Keep thy heart with all diligence', 'Proverbs 4:23'),
    question('fitness-3', 'A plank is mainly used to strengthen which area?', ['Core', 'Fingers', 'Ankles', 'Jaw'], 0, 'having your loins girt about with truth', 'Ephesians 6:14'),
    question('fitness-4', 'Which activity uses a pool and lanes?', ['Hiking', 'Cycling', 'Rowing', 'Swimming'], 3, 'as he that swimmeth spreadeth forth his hands to swim', 'Isaiah 25:11'),
    question('fitness-5', 'Which piece of equipment has two pedals and handlebars?', ['Treadmill', 'Stationary bicycle', 'Pull-up bar', 'Rowing machine'], 1, 'their work was as it were a wheel in the middle of a wheel', 'Ezekiel 1:16'),
  ],
  geography: [
    question('geography-1', 'The Great Pyramid of Giza is in which country?', ['Greece', 'Mexico', 'Egypt', 'India'], 2, 'Out of Egypt have I called my son', 'Matthew 2:15'),
    question('geography-2', 'Which city is nicknamed the Eternal City?', ['Rome', 'Paris', 'Athens', 'London'], 0, 'To all that be in Rome, beloved of God', 'Romans 1:7'),
    question('geography-3', 'Which body of water lies between northeast Africa and the Arabian Peninsula?', ['Baltic Sea', 'Black Sea', 'Caspian Sea', 'Red Sea'], 3, 'By faith they passed through the Red sea as by dry land', 'Hebrews 11:29'),
    question('geography-4', 'The ruins of ancient Babylon are in which modern country?', ['Italy', 'Iraq', 'Spain', 'Japan'], 1, 'Therefore is the name of it called Babel', 'Genesis 11:9'),
    question('geography-5', 'Which river flows through Cairo?', ['Amazon', 'Thames', 'Nile', 'Danube'], 2, 'and she laid it in the flags by the river\'s brink', 'Exodus 2:3'),
  ],
  sports: [
    question('sports-1', 'In which sport does a player aim for a hole-in-one?', ['Golf', 'Cricket', 'Hockey', 'Tennis'], 0, 'they have digged a pit before me', 'Psalm 57:6'),
    question('sports-2', 'Which sport uses a bow to hit a target?', ['Fencing', 'Archery', 'Wrestling', 'Badminton'], 1, 'Take, I pray thee, thy weapons, thy quiver and thy bow', 'Genesis 27:3'),
    question('sports-3', 'Which sport is played on horseback with mallets?', ['Lacrosse', 'Curling', 'Polo', 'Squash'], 2, 'The horse is prepared against the day of battle', 'Proverbs 21:31'),
    question('sports-4', 'Which sport includes a round called a bout and uses padded gloves?', ['Sailing', 'Tennis', 'Baseball', 'Boxing'], 3, 'so fight I, not as one that beateth the air', '1 Corinthians 9:26'),
    question('sports-5', 'What is passed between runners during a relay?', ['Baton', 'Puck', 'Racket', 'Discus'], 0, 'thy rod and thy staff they comfort me', 'Psalm 23:4'),
  ],
  media: [
    question('media-1', 'Which animated Disney movie features Simba?', ['Frozen', 'The Lion King', 'Aladdin', 'Moana'], 1, 'The lion hath roared, who will not fear?', 'Amos 3:8'),
    question('media-2', 'Which superhero is also known as the Dark Knight?', ['Superman', 'Spider-Man', 'Batman', 'Iron Man'], 2, 'And the light shineth in darkness', 'John 1:5'),
    question('media-3', 'In The Wizard of Oz, which road does Dorothy follow?', ['Yellow Brick Road', 'Abbey Road', 'Silk Road', 'Rainbow Road'], 0, 'the street of the city was pure gold', 'Revelation 21:21'),
    question('media-4', 'Which movie series features a character named Jack Sparrow?', ['Star Wars', 'Jurassic Park', 'Toy Story', 'Pirates of the Caribbean'], 3, 'They that go down to the sea in ships', 'Psalm 107:23'),
    question('media-5', 'Which Pixar movie follows a clownfish searching for his son?', ['Cars', 'Finding Nemo', 'Up', 'Brave'], 1, 'they inclosed a great multitude of fishes', 'Luke 5:6'),
  ],
  music: [
    question('music-1', 'Which instrument usually has 88 black and white keys?', ['Flute', 'Violin', 'Piano', 'Trumpet'], 2, 'I will give unto thee the keys of the kingdom of heaven', 'Matthew 16:19'),
    question('music-2', 'Which brass instrument is played with valves and a mouthpiece?', ['Trumpet', 'Cello', 'Harp', 'Clarinet'], 0, 'Praise him with the sound of the trumpet', 'Psalm 150:3'),
    question('music-3', 'Which string instrument is shaped like a large open frame and is plucked?', ['Saxophone', 'Drum', 'Oboe', 'Harp'], 3, 'David took an harp, and played with his hand', '1 Samuel 16:23'),
    question('music-4', 'What is a group of singers performing together called?', ['Orchestra', 'Choir', 'Duet', 'Solo'], 1, 'Make a joyful noise unto the LORD, all ye lands', 'Psalm 100:1'),
    question('music-5', 'Which percussion instrument consists of two metal plates struck together?', ['Bassoon', 'Viola', 'Cymbals', 'Accordion'], 2, 'Praise him upon the loud cymbals', 'Psalm 150:5'),
  ],
  science: [
    question('science-1', 'What is the chemical formula for water?', ['H₂O', 'CO₂', 'O₂', 'NaCl'], 0, 'let him that is athirst come', 'Revelation 22:17'),
    question('science-2', 'What force keeps the planets in orbit around the Sun?', ['Friction', 'Gravity', 'Magnetism', 'Sound'], 1, 'he hangeth the earth upon nothing', 'Job 26:7'),
    question('science-3', 'What process allows plants to use sunlight to make food?', ['Evaporation', 'Condensation', 'Photosynthesis', 'Fermentation'], 2, 'Let there be light: and there was light', 'Genesis 1:3'),
    question('science-4', 'Which part of a plant usually absorbs water from the soil?', ['Petals', 'Fruit', 'Seeds', 'Roots'], 3, 'spreadeth out her roots by the river', 'Jeremiah 17:8'),
    question('science-5', 'What natural phenomenon is caused by sunlight refracting and reflecting inside water droplets?', ['Rainbow', 'Earthquake', 'Tornado', 'Eclipse'], 0, 'I do set my bow in the cloud', 'Genesis 9:13'),
  ],
};

const publishedAt = '2026-09-05T00:00:00.000Z';
const mixedQuestions = Array.from({ length: 5 }, (_, index) =>
  categories.map(category => questionsByCategory[category.id]![index]!),
).flat();

export const quizzes: Quiz[] = [
  ...categories.map(category => ({
    id: `${category.id}-daily`,
    title: `${category.name} trivia`,
    subtitle: 'Five questions. A little curiosity. A helpful verse.',
    categoryId: category.id,
    mode: 'category' as const,
    questions: questionsByCategory[category.id]!,
    publishedAt,
  })),
  {
    id: 'timed-daily',
    title: 'Beat the clock',
    subtitle: 'Ten questions. Less time each round. How far can you go?',
    categoryId: 'mixed',
    mode: 'timed',
    questions: mixedQuestions.slice(0, 10),
    publishedAt,
  },
  {
    id: 'challenger-daily',
    title: 'The daily challenger',
    subtitle: 'Twenty questions across the things you love.',
    categoryId: 'mixed',
    mode: 'challenger',
    questions: mixedQuestions.slice(0, 20),
    publishedAt,
  },
];
