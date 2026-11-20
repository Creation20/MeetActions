import { calculateCoachMetrics } from './metrics.service';

const mockTranscript = `
[00:00] Speaker A: Welcome to the meeting. Today we are discussing the roadmap.
[00:10] Speaker B: Thanks. I have some ideas for the AI features.
[00:20] Speaker A: Great, let's hear them.
[00:30] Speaker B: We should add speaker naming and semantic search.
[00:45] Speaker A: I agree. Let's make it happen.
`;

const metrics = calculateCoachMetrics(mockTranscript, 60);
console.log('--- TEST RESULTS ---');
console.log(JSON.stringify(metrics, null, 2));

if (metrics.speakingTime.length === 2 && metrics.interruptionCount === 4) {
  console.log('✅ TEST PASSED');
} else {
  console.log('❌ TEST FAILED');
  console.log(`Expected 2 speakers, got ${metrics.speakingTime.length}`);
  console.log(`Expected 4 interruptions, got ${metrics.interruptionCount}`);
}
