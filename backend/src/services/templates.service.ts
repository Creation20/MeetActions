/**
 * Custom extraction templates (#8).
 *
 * Each template tunes what the AI emphasises when distilling a transcript.
 * The `instructions` string is injected into the extraction prompt; `focus`
 * fields describe the template to the client for the picker UI.
 */

export interface ExtractionTemplate {
  id: string;
  label: string;
  icon: string; // emoji / ionicon name hint for the frontend
  description: string;
  instructions: string;
}

export const EXTRACTION_TEMPLATES: ExtractionTemplate[] = [
  {
    id: 'Default',
    label: 'General Meeting',
    icon: 'sparkles',
    description: 'Balanced summary, decisions, and action items.',
    instructions:
      'Produce a balanced, general-purpose analysis. Weigh summary, decisions, and tasks equally.',
  },
  {
    id: '1:1',
    label: '1:1 / Check-in',
    icon: 'people',
    description: 'Growth, blockers, feedback, and personal commitments.',
    instructions: `This is a one-on-one check-in between a manager and a report.
      - SUMMARY: Capture morale, career growth topics, and blockers raised.
      - DECISIONS: Note any agreements about goals, scope, or working style.
      - TASKS: Separate commitments made by the manager vs. the report. Always set a clear owner.
      - ANALYSIS: Be sensitive to sentiment and unspoken concerns.`,
  },
  {
    id: 'Sales',
    label: 'Sales Call',
    icon: 'trending-up',
    description: 'BANT, objections, next steps, and buying signals.',
    instructions: `This is a sales / discovery call.
      - SUMMARY: Capture the prospect's pain points, current solution, and desired outcome.
      - DECISIONS: Record budget, authority, need, and timeline (BANT) signals explicitly.
      - TASKS: Every follow-up (send pricing, schedule demo, loop in stakeholder) must be a task owned by the rep.
      - ENTITIES: Extract the company, competitors mentioned, and key stakeholders.
      - ANALYSIS: Flag objections and buying signals in the tone field.`,
  },
  {
    id: 'Standup',
    label: 'Standup',
    icon: 'git-branch',
    description: 'Per-person yesterday / today / blockers.',
    instructions: `This is an engineering standup.
      - SUMMARY: For each speaker, summarise what they did, what they will do, and any blockers.
      - DECISIONS: Capture any scope or priority changes agreed on the call.
      - TASKS: Convert blockers into tasks owned by whoever will unblock them. Keep them terse.`,
  },
  {
    id: 'Interview',
    label: 'Interview',
    icon: 'clipboard',
    description: 'Candidate signal, strengths, concerns, recommendation.',
    instructions: `This is a candidate interview.
      - SUMMARY: Summarise the candidate's background and how they performed.
      - DECISIONS: Capture the interviewer's leaning (advance / hold / reject) if stated.
      - TASKS: Follow-ups such as reference checks or additional rounds.
      - ANALYSIS: In the tone field, note strengths and concerns as signal.
      Do NOT invent a hiring decision that was not expressed.`,
  },
  {
    id: 'Lecture',
    label: 'Lecture / Class',
    icon: 'school',
    description: 'Study notes, key concepts, and revision questions.',
    instructions: `This is an educational lecture or class.
      - SUMMARY: Write structured study notes covering the main concepts taught.
      - DECISIONS: Repurpose as "key takeaways" the student must remember.
      - TASKS: Convert assignments, readings, and deadlines into tasks with due dates.
      - ENTITIES: Extract key concepts and terminology as 'concept' entities.`,
  },
];

export const getTemplate = (id?: string): ExtractionTemplate => {
  return EXTRACTION_TEMPLATES.find((t) => t.id === id) || EXTRACTION_TEMPLATES[0];
};
