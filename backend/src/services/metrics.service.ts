interface SpeakerMetric {
  speakerId: string;
  durationSec: number;
  percentage: number;
}

interface CoachMetrics {
  speakingTime: SpeakerMetric[];
  interruptionCount: number;
  pacingScore: number;
}

export const calculateCoachMetrics = (transcript: string, totalDurationSec: number): CoachMetrics => {
  // Regex to match [MM:SS] Speaker X: Content
  const segmentRegex = /\[(\d{1,3}):(\d{2})\]\s+([^:]+):/g;
  const segments: { time: number; speakerId: string }[] = [];
  
  let match;
  while ((match = segmentRegex.exec(transcript)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const timeInSec = minutes * 60 + seconds;
    const speakerId = match[3].trim();
    
    segments.push({ time: timeInSec, speakerId });
  }

  if (segments.length === 0) {
    return { speakingTime: [], interruptionCount: 0, pacingScore: 0 };
  }

  const speakerDurations: { [key: string]: number } = {};
  let interruptionCount = 0;
  let lastSpeakerId = '';

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const next = segments[i + 1];
    
    // Duration is until next segment or end of meeting
    const segmentDuration = next ? next.time - current.time : Math.max(0, totalDurationSec - current.time);
    
    speakerDurations[current.speakerId] = (speakerDurations[current.speakerId] || 0) + segmentDuration;

    if (lastSpeakerId && lastSpeakerId !== current.speakerId) {
      interruptionCount++;
    }
    lastSpeakerId = current.speakerId;
  }

  // Calculate percentages
  const totalAttributedTime = Object.values(speakerDurations).reduce((a, b) => a + b, 0) || 1;
  const speakingTime: SpeakerMetric[] = Object.entries(speakerDurations).map(([id, dur]) => ({
    speakerId: id,
    durationSec: Math.round(dur),
    percentage: Math.round((dur / totalAttributedTime) * 100)
  })).sort((a, b) => b.durationSec - a.durationSec);

  // Calculate pacing (words per minute)
  const wordCount = transcript.split(/\s+/).length;
  const pacingScore = totalDurationSec > 0 ? Math.round((wordCount / totalDurationSec) * 60) : 0;

  return {
    speakingTime,
    interruptionCount,
    pacingScore
  };
};
