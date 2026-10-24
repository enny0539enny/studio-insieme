# Studio Insieme

PROJECT: StudySync — a study app for university students, built with partner universities.
Goal: help students organize their study time, understand their courses, review effectively and find people to study with.

In this first step, build ONLY the foundation: authentication, data model, design system, navigation shell and demo data. Later prompts add each module.

LANGUAGE
All interface text in Italian. Code, variable names and comments in English. Keep all UI strings in one translations file so English can be added later.

TWO SOURCES OF DATA
1. University (institutional, read-only for students):
   - student's university, degree program, year
   - enrolled courses for the semester
   - per course: name, professor(s), credits (CFU), class schedule, exam dates, official topic list with weight (high / medium / low), course materials
   For now, load this from seeded data. Later it will come from a university integration, so keep it in separate tables marked source = 'university'.
2. Student (personal, editable): everything collected in onboarding and settings.
Students can never edit university data. They can add a missing exam date manually, stored separately and labelled "inserita da te".

ROLES
- student
- teacher: verified only by university data (listed as professor of the course) or admin approval. Can manage only their own courses.
- admin

AUTH
Sign-in with university email only (domain list per partner university). This verifies that every user is a real student or teacher of a partner university.

DATA MODEL
universities, degree_programs
courses (university_id, name, credits, class_hours, semester, source)
course_topics (course_id, name, weight, order)
course_materials (course_id, topic_id, title, file, version, uploaded_by)
exams (course_id, date, source: university | student)
class_events (course_id, start, end, room)
users (role, name, university_id, degree_program_id, year)
enrollments (user_id, course_id, role)
student_profiles (user_id, archetype, likert answers, exam_scenario, looking_for, group_size, places[], time_slots[], living_situation, tags[], languages[], bio, photo_url optional)
privacy_settings (user_id, map_active, open_to_invitations, discoverable_in_matching, leaderboard_opt_in)
All later modules add their own tables.

AUTHORIZATION (enforce in the backend with row-level security)
- Users read and edit only their own profile, settings and activity.
- Teachers manage only courses they are enrolled in as teacher.
- Course materials are visible only to students enrolled in that course.
- Private AI tutor conversations are never readable by teachers or universities.

DESIGN
Warm, calm, modern. Coral as primary color, teal as secondary, sand as neutral background. Rounded cards, generous spacing, line icons (lucide), no emoji. Mobile-first, works on desktop.
Navigation: bottom tab bar on mobile, sidebar on desktop, with: Home, Studio (tutor), Mappa, Persone, Chat. Empty placeholder pages for now.

DEMO MODE
Seed one university (Politecnico di Milano), one degree program (Ingegneria Gestionale), 5 courses with credits, topics with weights, exam dates and class schedules, 1 teacher per course, and 6 demo students. Every demo person shows a small "Demo" label. Never present demo data as real users.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d31a8351-d156-4007-b9b2-d86c80ae5b2f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
