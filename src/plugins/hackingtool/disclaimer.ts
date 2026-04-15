// Authorization disclaimer for security toolkit operations

export const DISCLAIMER_SHORT =
  "For authorized security testing, education, and research only.";

export const DISCLAIMER_FULL = `
SECURITY TOOLKIT AUTHORIZATION NOTICE

This toolkit indexes open-source security tools from the z4nzu/hackingtool
knowledge graph. All tools listed are publicly available on GitHub.

AUTHORIZED USE ONLY:
  - Penetration testing with written authorization
  - CTF competitions and security challenges
  - Security research and education
  - Defensive security and threat modeling

PROHIBITED USE:
  - Unauthorized access to systems you do not own
  - Attacks without explicit written permission
  - Any activity violating applicable laws

By using this toolkit, you confirm you have proper authorization.
`.trim();

export function formatDisclaimer(compact: boolean): string {
  return compact ? DISCLAIMER_SHORT : DISCLAIMER_FULL;
}
