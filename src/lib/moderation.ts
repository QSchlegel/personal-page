const blockedPatterns = [
  /\bchild\s*sexual\s*abuse\b/i,
  /\bmalware\s*payload\b/i,
  /\bcredit\s*card\s*dump\b/i,
];

const maxContentLength = 4000;

export function moderateContent(content: string): { allowed: boolean; reason?: string } {
  if (!content.trim()) {
    return { allowed: false, reason: "Message content cannot be empty." };
  }

  if (content.length > maxContentLength) {
    return {
      allowed: false,
      reason: `Message exceeds ${maxContentLength} character limit.`,
    };
  }

  for (const pattern of blockedPatterns) {
    if (pattern.test(content)) {
      return { allowed: false, reason: "Message content failed moderation checks." };
    }
  }

  return { allowed: true };
}
