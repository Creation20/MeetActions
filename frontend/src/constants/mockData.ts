import { Meeting, Task, OverviewStats } from '../types';

export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    meetingId: 'm1',
    title: 'Prepare Q3 budget report',
    description: 'Compile expense data from all departments and create summary slides',
    owner: 'Sarah K.',
    dueDate: '2026-05-20T00:00:00Z',
    status: 'in_progress',
    priority: 'high',
    createdAt: '2026-05-12T10:00:00Z',
  },
  {
    id: 't2',
    meetingId: 'm1',
    title: 'Send meeting minutes to all attendees',
    owner: 'John D.',
    dueDate: '2026-05-15T00:00:00Z',
    status: 'completed',
    priority: 'medium',
    createdAt: '2026-05-12T10:00:00Z',
  },
  {
    id: 't3',
    meetingId: 'm2',
    title: 'Review lecture slides for Chapter 7',
    description: 'Cover neural networks and backpropagation before Thursday',
    owner: 'Me',
    dueDate: '2026-05-17T00:00:00Z',
    status: 'pending',
    priority: 'high',
    createdAt: '2026-05-13T09:00:00Z',
  },
  {
    id: 't4',
    meetingId: 'm2',
    title: 'Form study group for midterm',
    owner: 'Me',
    dueDate: '2026-05-16T00:00:00Z',
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-05-13T09:00:00Z',
  },
  {
    id: 't5',
    meetingId: 'm3',
    title: 'Book venue for community outreach event',
    owner: 'Pastor Mike',
    dueDate: '2026-05-25T00:00:00Z',
    status: 'pending',
    priority: 'high',
    createdAt: '2026-05-14T14:00:00Z',
  },
  {
    id: 't6',
    meetingId: 'm3',
    title: 'Design promotional flyers',
    owner: 'Grace A.',
    dueDate: '2026-05-22T00:00:00Z',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2026-05-14T14:00:00Z',
  },
];

export const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    title: 'Q3 Planning & Budget Review',
    date: '2026-05-12T10:00:00Z',
    duration: 2820, // 47 min
    status: 'ready',
    tags: ['Finance', 'Planning'],
    summary:
      'Team reviewed Q3 financial projections. Budget allocations were discussed for marketing and engineering. Decision made to cut travel expenses by 20% and redirect funds to software tools.',
    decisions: [
      'Cut travel expenses by 20% for Q3',
      'Increase software tools budget by $5,000',
      'Monthly check-ins every first Monday',
    ],
    tasks: MOCK_TASKS.filter((t) => t.meetingId === 'm1'),
    transcript:
      "Good morning everyone. Let's get started with the Q3 budget review. Sarah, can you walk us through the numbers? Sure, so we're looking at a 12% variance from our initial projections, mostly driven by unexpected infrastructure costs. I think we need to revisit travel first because that's where we're bleeding the most. Agreed, I suggest we cut travel by at least 20%. That gives us room to invest more in the software tools we've been putting off. That sounds reasonable to the group? Yes. Let's do that. John, can you document this and send out the minutes? Absolutely, I'll have it done by end of day.",
  },
  {
    id: 'm2',
    title: 'Machine Learning Lecture – Week 9',
    date: '2026-05-13T09:00:00Z',
    duration: 4200, // 70 min
    status: 'ready',
    tags: ['University', 'ML'],
    summary:
      'Lecture covered neural network architectures, focusing on backpropagation and gradient descent. Professor emphasized the importance of understanding the chain rule for the midterm exam.',
    decisions: [
      'Midterm will cover chapters 5–8',
      'Assignment 3 deadline extended to May 22',
    ],
    tasks: MOCK_TASKS.filter((t) => t.meetingId === 'm2'),
    transcript:
      "Today we're going to dive deep into backpropagation. This is arguably the most important algorithm in modern deep learning. The key insight is the chain rule. You compute derivatives layer by layer, from output back to input. For the midterm, you need to understand this intuitively and mathematically. The exam will cover chapters five through eight. Also, given the holiday on Friday, I'm extending assignment three to May twenty-second. Please form study groups — this material is challenging and you'll benefit from collaborative review.",
  },
  {
    id: 'm3',
    title: 'Church Planning Committee',
    date: '2026-05-14T14:00:00Z',
    duration: 3600, // 60 min
    status: 'ready',
    tags: ['Community', 'Events'],
    summary:
      'Planning committee discussed the upcoming community outreach event scheduled for June 1st. Roles were assigned and a budget of GHC 2,500 was approved.',
    decisions: [
      'Event date confirmed: June 1st',
      'Budget approved: GHC 2,500',
      'Volunteer sign-up sheet to be circulated by Sunday',
    ],
    tasks: MOCK_TASKS.filter((t) => t.meetingId === 'm3'),
    transcript:
      "Let's open in prayer. Amen. So the main item today is the outreach event. We've settled on June first. Pastor Mike, what's the status on the venue? I'll confirm by next week. We need to finalize the budget. I propose GHC 2,500 all inclusive. All in favor? Passed. Grace, can you handle the flyers? Yes, I'll start this week. We also need volunteers. Let's circulate a sign-up sheet on Sunday.",
  },
  {
    id: 'm4',
    title: 'Product Sprint Retrospective',
    date: '2026-05-10T15:00:00Z',
    duration: 1800, // 30 min
    status: 'processing',
    tags: ['Tech', 'Agile'],
  },
];

export const MOCK_STATS: OverviewStats = {
  totalMeetings: 4,
  totalTasks: 6,
  completedTasks: 1,
  totalMinutes: 197,
};
