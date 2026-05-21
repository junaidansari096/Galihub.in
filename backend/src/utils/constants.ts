export enum Severity {
  MILD = 'mild',
  MEDIUM = 'medium',
  EXTREME = 'extreme'
}

export enum PostStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  HIDDEN = 'hidden',
  AI_FLAGGED = 'ai_flagged'
}

export enum RoleName {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN'
}

/**
 * Maps new lowercase database role names (like 'super_admin')
 * to legacy uppercase role names expected by the frontend.
 */
export const mapRoleToLegacy = (roleName: string): string => {
  const norm = roleName.toLowerCase().trim();
  if (norm === 'super_admin') return 'SUPERADMIN';
  return norm.toUpperCase();
};
