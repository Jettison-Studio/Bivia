import type { Quiz } from './types';

// Public sample only; ranked answer keys remain server-side. NIV text is fetched on demand.
export const quizzes: Quiz[] = [
  {
    "title": "Small discoveries",
    "subtitle": "Everyday things worth a second look.",
    "categoryId": "mixed",
    "mode": "category",
    "questions": [
      {
        "id": "guest-small-discoveries-q1-v1",
        "prompt": "How does a hot griddle mainly transfer heat into dough touching its surface?",
        "answers": [
          "Convection",
          "Conduction",
          "Radiation",
          "Evaporation"
        ],
        "correctIndex": 1,
        "hint": "Focus on the place where the dough meets the cooking surface.",
        "reference": "Leviticus 2:5 · NIV"
      },
      {
        "id": "guest-small-discoveries-q2-v1",
        "prompt": "Why do you see distant lightning before hearing its thunder?",
        "answers": [
          "Thunder begins several seconds after the flash",
          "The light has a shorter distance to travel",
          "Light travels much faster than sound",
          "Your ears take several seconds to detect sound"
        ],
        "correctIndex": 2,
        "hint": "The flash and thunder originate in the same lightning event.",
        "reference": "Job 37:3–4 · NIV"
      },
      {
        "id": "guest-small-discoveries-q3-v1",
        "prompt": "In traditional winnowing, what carries the loose chaff away from the grain?",
        "answers": [
          "Moving air",
          "Flowing water",
          "A mesh screen",
          "Rotating grindstones"
        ],
        "correctIndex": 0,
        "hint": "The lighter pieces travel farther from where the mixture falls.",
        "reference": "Luke 3:17 · NIV"
      },
      {
        "id": "guest-small-discoveries-q4-v4",
        "prompt": "Which group of organisms explains the moldy part of the bread’s condition?",
        "answers": [
          "Bacteria",
          "Fungi",
          "Algae",
          "Viruses"
        ],
        "correctIndex": 1,
        "hint": "Mushrooms belong to this group too.",
        "reference": "Joshua 9:4–6 · NIV"
      },
      {
        "id": "guest-small-discoveries-q5-v2",
        "prompt": "Which device turns the trees into speaking characters in Jotham’s story?",
        "answers": [
          "Alliteration",
          "Flashback",
          "Personification",
          "Onomatopoeia"
        ],
        "correctIndex": 2,
        "hint": "It also lets a cartoon teapot argue with its owner.",
        "reference": "Judges 9:8–15 · NIV"
      }
    ],
    "id": "guest-niv-day-one",
    "publishedAt": "2026-09-06T00:00:00Z"
  }
];
