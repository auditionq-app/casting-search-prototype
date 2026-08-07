// scripts/add-test-fixtures.ts
//
// Adds ~24 clearly-separate test fixture profiles with real, distinctive,
// non-templated bios covering known archetypes — NOT part of the R&D kit's
// seed data. Kept identifiable via email domain (@test-fixture.local) so
// they're trivial to find and remove (see remove-test-fixtures.ts).
//
// These go through the REAL Phase 4 ingestion pipeline (enqueueArtistIngestion)
// rather than having search_document/embedding hand-crafted, so this also
// exercises the worker on fresh inserts, not just backfill.
//
// Run with the worker already running:
//   Terminal 1: npx tsx scripts/start-ingestion-worker.ts
//   Terminal 2: npx tsx scripts/add-test-fixtures.ts

import { prisma } from "../lib/prisma";
import { enqueueArtistIngestion } from "../lib/queues/ingestion-queue";

const TEST_EMAIL_DOMAIN = "test-fixture.local";

function dobForAge(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d;
}

interface Fixture {
  full_name: string;
  age: number;
  gender: "Male" | "Female" | "Non_binary";
  skin_tone?: string;
  eye_color?: string;
  hair_color?: string;
  build?: "Slim" | "Average" | "Athletic" | "Muscular" | "Plus_size" | "Petite";
  current_location: string;
  state: string;
  country: string;
  primary_language: string;
  language_preferences: string[];
  primary_category: "Actor";
  experience_level: "Beginner" | "Intermediate" | "Professional" | "Expert" | "Veteran";
  years_of_experience: number;
  specializations: string[];
  genre_preferences: string[];
  bio: string;
}

const FIXTURES: Fixture[] = [
  // --- "warm/authoritative father figure" archetype ---
  {
    full_name: "Rajesh Menon",
    age: 54,
    gender: "Male",
    build: "Average",
    current_location: "Kochi",
    state: "Kerala",
    country: "India",
    primary_language: "Malayalam",
    language_preferences: ["Malayalam", "English"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 28,
    specializations: ["Drama", "Family roles"],
    genre_preferences: ["Family Drama", "Period Drama"],
    bio: "Known for warm, grounded performances as fathers and patriarchs. Brings a gentle but firm authority to every scene — audiences describe his screen presence as instantly trustworthy and comforting, like a father who has seen it all and still shows up with patience.",
  },
  {
    full_name: "David Fernandes",
    age: 57,
    gender: "Male",
    build: "Average",
    current_location: "Goa",
    state: "Goa",
    country: "India",
    primary_language: "English",
    language_preferences: ["English", "Konkani"],
    primary_category: "Actor",
    experience_level: "Expert",
    years_of_experience: 22,
    specializations: ["Drama", "Stage acting"],
    genre_preferences: ["Family Drama"],
    bio: "A theatre veteran who specializes in authoritative yet tender father-figure roles. Directors often cast him as the disciplined but loving parent whose warmth quietly commands the room without ever raising his voice.",
  },
  {
    full_name: "Suresh Iyer",
    age: 61,
    gender: "Male",
    build: "Slim",
    current_location: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    primary_language: "Tamil",
    language_preferences: ["Tamil", "English"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 35,
    specializations: ["Drama"],
    genre_preferences: ["Family Drama", "Classic"],
    bio: "Veteran character actor whose specialty is the wise, commanding elder — the kind of authoritative warmth that anchors a family saga. Has played patriarchs and mentors across three decades of film.",
  },

  // --- "mafia boss / intimidating" archetype ---
  {
    full_name: "Vincenzo Moretti",
    age: 49,
    gender: "Male",
    build: "Muscular",
    current_location: "Mumbai",
    state: "Maharashtra",
    country: "India",
    primary_language: "English",
    language_preferences: ["English", "Italian"],
    primary_category: "Actor",
    experience_level: "Expert",
    years_of_experience: 19,
    specializations: ["Action", "Crime drama"],
    genre_preferences: ["Crime Thriller", "Gangster"],
    bio: "Specializes in intimidating, commanding antagonist roles — crime bosses, ruthless enforcers, and powerful men who control a room by simply entering it. Known for a cold, calculating screen presence that unsettles other actors on set.",
  },
  {
    full_name: "Baldev Rana",
    age: 52,
    gender: "Male",
    build: "Muscular",
    current_location: "Delhi",
    state: "Delhi",
    country: "India",
    primary_language: "Hindi",
    language_preferences: ["Hindi", "Punjabi"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 26,
    specializations: ["Action", "Crime drama"],
    genre_preferences: ["Gangster", "Crime Thriller"],
    bio: "A powerful, imposing physical presence with a reputation for playing ruthless, commanding crime bosses. Directors cast him when a scene needs genuine menace without a single line of dialogue.",
  },
  {
    full_name: "Camille Dubois",
    age: 46,
    gender: "Female",
    build: "Slim",
    current_location: "Mumbai",
    state: "Maharashtra",
    country: "India",
    primary_language: "French",
    language_preferences: ["French", "English"],
    primary_category: "Actor",
    experience_level: "Expert",
    years_of_experience: 20,
    specializations: ["Crime drama", "Thriller"],
    genre_preferences: ["Crime Thriller"],
    bio: "Plays a rare and sought-after archetype: the calculating, intimidating matriarch of a crime family. Commanding, precise, and quietly terrifying — she controls every scene with restraint rather than volume.",
  },

  // --- "royal / prince" archetype (including older age, to test we don't over-filter) ---
  {
    full_name: "Arman Qureshi",
    age: 27,
    gender: "Male",
    build: "Athletic",
    current_location: "Hyderabad",
    state: "Telangana",
    country: "India",
    primary_language: "Urdu",
    language_preferences: ["Urdu", "Hindi", "English"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 6,
    specializations: ["Period drama", "Royal roles"],
    genre_preferences: ["Historical", "Period Drama"],
    bio: "A regal, commanding screen presence well suited to noble and royal roles — princes, young rulers, and period-drama heirs. Carries himself with an effortless authority that reads as inherited, not performed.",
  },
  {
    full_name: "Devendra Pratap Singh",
    age: 66,
    gender: "Male",
    build: "Average",
    current_location: "Jodhpur",
    state: "Rajasthan",
    country: "India",
    primary_language: "Hindi",
    language_preferences: ["Hindi", "English"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 40,
    specializations: ["Period drama", "Royal roles"],
    genre_preferences: ["Historical", "Period Drama"],
    bio: "An aging-king specialist with an unmistakably regal, commanding presence built over four decades on screen. Has played maharajas, emperors, and royal patriarchs across major period productions.",
  },
  {
    full_name: "Isabelle Laurent",
    age: 31,
    gender: "Female",
    build: "Slim",
    current_location: "Mumbai",
    state: "Maharashtra",
    country: "India",
    primary_language: "French",
    language_preferences: ["French", "English"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 8,
    specializations: ["Period drama", "Royal roles"],
    genre_preferences: ["Historical", "Period Drama"],
    bio: "Noble, composed, and quietly commanding — frequently cast in royal and aristocratic roles that call for regal poise rather than overt drama. A strong presence in period ensemble pieces.",
  },

  // --- factual-match precision tests (34-year-old man, blue eyes, English) ---
  {
    full_name: "Michael Thompson",
    age: 34,
    gender: "Male",
    skin_tone: "Fair",
    eye_color: "Blue",
    hair_color: "Brown",
    build: "Athletic",
    current_location: "Bengaluru",
    state: "Karnataka",
    country: "India",
    primary_language: "English",
    language_preferences: ["English"],
    primary_category: "Actor",
    experience_level: "Intermediate",
    years_of_experience: 7,
    specializations: ["Drama", "Commercial"],
    genre_preferences: ["Drama"],
    bio: "A versatile actor with a naturalistic style, equally comfortable in drama and commercial work. Fair-skinned with striking blue eyes, often cast in contemporary urban stories.",
  },
  {
    full_name: "James Walker",
    age: 33,
    gender: "Male",
    skin_tone: "Fair",
    eye_color: "Blue",
    hair_color: "Blonde",
    build: "Average",
    current_location: "Mumbai",
    state: "Maharashtra",
    country: "India",
    primary_language: "English",
    language_preferences: ["English"],
    primary_category: "Actor",
    experience_level: "Intermediate",
    years_of_experience: 6,
    specializations: ["Drama"],
    genre_preferences: ["Drama", "Romance"],
    bio: "Fair skin, blue eyes, and an easy naturalism that suits contemporary drama and romance. English is his primary working language, with credits in independent and commercial productions alike.",
  },
  {
    full_name: "Daniel Osei",
    age: 34,
    gender: "Male",
    skin_tone: "Dark",
    eye_color: "Brown",
    hair_color: "Black",
    build: "Athletic",
    current_location: "Delhi",
    state: "Delhi",
    country: "India",
    primary_language: "English",
    language_preferences: ["English"],
    primary_category: "Actor",
    experience_level: "Intermediate",
    years_of_experience: 9,
    specializations: ["Drama", "Action"],
    genre_preferences: ["Action", "Drama"],
    bio: "A 34-year-old English-speaking actor with a strong physical presence, deliberately included here with brown eyes and dark skin — a near-miss test case to confirm eye/skin descriptors aren't silently treated as hard filters.",
  },

  // --- language diversity ---
  {
    full_name: "Priya Krishnamurthy",
    age: 38,
    gender: "Female",
    build: "Slim",
    current_location: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    primary_language: "Tamil",
    language_preferences: ["Tamil", "English", "Telugu"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 12,
    specializations: ["Drama", "Dance"],
    genre_preferences: ["Family Drama", "Musical"],
    bio: "A classically trained performer fluent in Tamil, English, and Telugu, known for emotionally rich family-drama roles and strong stage presence in musical theatre.",
  },
  {
    full_name: "Carlos Mendes",
    age: 41,
    gender: "Male",
    build: "Athletic",
    current_location: "Goa",
    state: "Goa",
    country: "India",
    primary_language: "Spanish",
    language_preferences: ["Spanish", "English", "Portuguese"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 15,
    specializations: ["Action", "Drama"],
    genre_preferences: ["Action", "Thriller"],
    bio: "A Spanish-speaking actor with fluent English and Portuguese, bringing an international edge to action and thriller roles. Trained in stage combat and physical performance.",
  },
  {
    full_name: "Li Wei Zhang",
    age: 29,
    gender: "Male",
    build: "Slim",
    current_location: "Mumbai",
    state: "Maharashtra",
    country: "India",
    primary_language: "Mandarin",
    language_preferences: ["Mandarin", "English"],
    primary_category: "Actor",
    experience_level: "Intermediate",
    years_of_experience: 5,
    specializations: ["Drama", "Martial arts"],
    genre_preferences: ["Action", "Drama"],
    bio: "Mandarin-speaking actor with strong martial arts training and a calm, focused screen presence, increasingly cast in cross-cultural action-drama productions.",
  },

  // --- age-range edge cases (very young, very old) ---
  {
    full_name: "Aditi Bhatt",
    age: 21,
    gender: "Female",
    build: "Slim",
    current_location: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    primary_language: "Gujarati",
    language_preferences: ["Gujarati", "Hindi", "English"],
    primary_category: "Actor",
    experience_level: "Beginner",
    years_of_experience: 1,
    specializations: ["Drama"],
    genre_preferences: ["Coming of Age", "Drama"],
    bio: "An emerging young actor with a natural, unpolished energy well suited to coming-of-age stories. Just beginning her professional career after training in college theatre.",
  },
  {
    full_name: "Narayan Achrekar",
    age: 74,
    gender: "Male",
    build: "Slim",
    current_location: "Pune",
    state: "Maharashtra",
    country: "India",
    primary_language: "Marathi",
    language_preferences: ["Marathi", "Hindi", "English"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 50,
    specializations: ["Drama"],
    genre_preferences: ["Family Drama", "Classic"],
    bio: "A five-decade veteran of Marathi theatre and film, now specializing in grandfather and elder-statesman roles. Frail in build but commanding in presence, especially in quiet, dialogue-driven scenes.",
  },

  // --- general variety filler, distinct bios (not templated) ---
  {
    full_name: "Fatima Sheikh",
    age: 44,
    gender: "Female",
    build: "Average",
    current_location: "Lucknow",
    state: "Uttar Pradesh",
    country: "India",
    primary_language: "Urdu",
    language_preferences: ["Urdu", "Hindi"],
    primary_category: "Actor",
    experience_level: "Expert",
    years_of_experience: 18,
    specializations: ["Drama", "Poetry recitation"],
    genre_preferences: ["Period Drama", "Literary adaptation"],
    bio: "Known for nuanced, literary performances in Urdu-language period dramas, often drawing on a background in classical poetry recitation to bring unusual texture to dialogue delivery.",
  },
  {
    full_name: "Tomás Rivera",
    age: 36,
    gender: "Male",
    build: "Athletic",
    current_location: "Bengaluru",
    state: "Karnataka",
    country: "India",
    primary_language: "Spanish",
    language_preferences: ["Spanish", "English"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 10,
    specializations: ["Comedy", "Improvisation"],
    genre_preferences: ["Comedy", "Sitcom"],
    bio: "A sharp comic timing specialist with a background in improvisational theatre, frequently cast in ensemble comedy for his quick, unpredictable line delivery.",
  },
  {
    full_name: "Ananya Deshpande",
    age: 28,
    gender: "Female",
    build: "Athletic",
    current_location: "Mumbai",
    state: "Maharashtra",
    country: "India",
    primary_language: "Marathi",
    language_preferences: ["Marathi", "Hindi", "English"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 7,
    specializations: ["Action", "Stunts"],
    genre_preferences: ["Action", "Thriller"],
    bio: "A trained stunt performer turned lead actor, known for doing her own action sequences and bringing genuine physical intensity to thriller roles.",
  },
  {
    full_name: "Robert Okafor",
    age: 39,
    gender: "Male",
    build: "Muscular",
    current_location: "Delhi",
    state: "Delhi",
    country: "India",
    primary_language: "English",
    language_preferences: ["English", "Igbo"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 11,
    specializations: ["Action", "Drama"],
    genre_preferences: ["Action", "Sports Drama"],
    bio: "A former athlete turned actor, bringing genuine physicality to sports-drama and action roles. Known for intense, committed performances in physically demanding shoots.",
  },
  {
    full_name: "Meera Pillai",
    age: 50,
    gender: "Female",
    build: "Average",
    current_location: "Thiruvananthapuram",
    state: "Kerala",
    country: "India",
    primary_language: "Malayalam",
    language_preferences: ["Malayalam", "English"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 24,
    specializations: ["Drama", "Family roles"],
    genre_preferences: ["Family Drama"],
    bio: "A warm, deeply respected performer known for playing the emotional anchor of a family — mothers and elder sisters whose quiet strength holds a story together.",
  },
  {
    full_name: "Non_binary Test",
    age: 30,
    gender: "Non_binary",
    build: "Slim",
    current_location: "Bengaluru",
    state: "Karnataka",
    country: "India",
    primary_language: "English",
    language_preferences: ["English", "Kannada"],
    primary_category: "Actor",
    experience_level: "Professional",
    years_of_experience: 8,
    specializations: ["Drama", "Contemporary"],
    genre_preferences: ["Drama", "Independent"],
    bio: "A gender-nonconforming performer specializing in contemporary, boundary-pushing independent theatre and film, known for emotionally direct, unconventional roles.",
  },
  {
    full_name: "Harold Whitfield",
    age: 68,
    gender: "Male",
    build: "Average",
    current_location: "Shimla",
    state: "Himachal Pradesh",
    country: "India",
    primary_language: "English",
    language_preferences: ["English", "Hindi"],
    primary_category: "Actor",
    experience_level: "Veteran",
    years_of_experience: 42,
    specializations: ["Drama", "Period roles"],
    genre_preferences: ["Period Drama", "Historical"],
    bio: "A distinguished elder statesman of English-language period drama, with a resonant voice and unhurried authority well suited to judges, professors, and retired officials.",
  },
];

async function main() {
  // Determine an existing user_type convention from real seed data, rather
  // than guessing a string for a free-text (non-enum) column.
  const sample = await prisma.$queryRaw<{ user_type: string }[]>`
    SELECT u.user_type
    FROM users u
    JOIN artist_profiles ap ON ap.user_id = u.id
    LIMIT 1
  `;
  const userType = sample[0]?.user_type;
  if (!userType) {
    throw new Error(
      "Couldn't find an existing artist user_type value to reuse. " +
        "Check that seed data exists, or set a literal value manually."
    );
  }
  console.log(`Using user_type: "${userType}" (matched from existing seed data)`);

  const createdIds: { id: string; name: string }[] = [];

  for (let i = 0; i < FIXTURES.length; i++) {
    const f = FIXTURES[i];
    const email = `fixture.${i}.${f.full_name.toLowerCase().replace(/\s+/g, ".")}@${TEST_EMAIL_DOMAIN}`;

    const user = await prisma.users.create({
      data: {
        email,
        user_type: userType,
        is_verified: true,
      },
    });

    const profile = await prisma.artist_profiles.create({
      data: {
        user_id: user.id,
        full_name: f.full_name,
        date_of_birth: dobForAge(f.age),
        gender: f.gender,
        skin_tone: f.skin_tone,
        eye_color: f.eye_color,
        hair_color: f.hair_color,
        build: f.build,
        current_location: f.current_location,
        state: f.state,
        country: f.country,
        primary_language: f.primary_language,
        language_preferences: f.language_preferences,
        primary_category: f.primary_category,
        experience_level: f.experience_level,
        years_of_experience: f.years_of_experience,
        specializations: f.specializations,
        genre_preferences: f.genre_preferences,
        bio: f.bio,
        is_active: true,
      },
    });

    createdIds.push({ id: profile.id, name: f.full_name });
  }

  console.log(`\nCreated ${createdIds.length} test fixture profiles.`);
  console.log("Enqueuing them for indexing (worker must be running)...\n");

  for (const { id, name } of createdIds) {
    await enqueueArtistIngestion(id);
    console.log(`Enqueued: ${name}`);
  }

  console.log(
    `\nDone. Watch the worker terminal for ${createdIds.length} completed jobs. ` +
      `Run scripts/remove-test-fixtures.ts later to clean these up.`
  );
}

main()
  .catch((err) => {
    console.error("add-test-fixtures failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));