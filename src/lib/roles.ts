export const roles = ['admin', 'manager', 'telecaller', 'creative_analyst'] as const;
export type Role = typeof roles[number];
export const roleLabels: Record<Role, string> = {
  admin: 'Admin', manager: 'Team Leader / Manager', telecaller: 'Telecaller', creative_analyst: 'Creative Analyst',
};
export function isRole(value: unknown): value is Role { return roles.includes(value as Role); }
