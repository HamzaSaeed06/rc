/**
 * participantColors.js
 *
 * Deterministic color palette for participants.
 * Same userId → same color always (across tiles, panels, name badges).
 */

// 12 vibrant Google Meet–inspired colors
const PALETTE = [
  { bg: '#1a73e8', light: '#d2e3fc', text: '#ffffff' }, // Google Blue
  { bg: '#0f9d58', light: '#ceead6', text: '#ffffff' }, // Google Green
  { bg: '#e53935', light: '#fce8e6', text: '#ffffff' }, // Red
  { bg: '#f9ab00', light: '#fef7e0', text: '#1a1a1a' }, // Amber
  { bg: '#a142f4', light: '#e9d7fd', text: '#ffffff' }, // Purple
  { bg: '#e91e63', light: '#fce4ec', text: '#ffffff' }, // Pink
  { bg: '#00acc1', light: '#e0f7fa', text: '#ffffff' }, // Cyan
  { bg: '#fb8c00', light: '#fff3e0', text: '#ffffff' }, // Orange
  { bg: '#43a047', light: '#e8f5e9', text: '#ffffff' }, // Green
  { bg: '#5c6bc0', light: '#e8eaf6', text: '#ffffff' }, // Indigo
  { bg: '#00897b', light: '#e0f2f1', text: '#ffffff' }, // Teal
  { bg: '#c62828', light: '#ffebee', text: '#ffffff' }, // Deep Red
];

/**
 * Hash a string to a stable integer.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic color object for a participant.
 * @param {string} userId - The user's _id string.
 * @returns {{ bg: string, light: string, text: string }}
 */
export function getParticipantColor(userId) {
  const idx = hashString(userId || 'default') % PALETTE.length;
  return PALETTE[idx];
}

/**
 * Get only the background color string.
 * @param {string} userId
 * @returns {string} CSS color string
 */
export function getParticipantBg(userId) {
  return getParticipantColor(userId).bg;
}
