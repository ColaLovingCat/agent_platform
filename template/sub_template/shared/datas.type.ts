export type UserRole = 'admin' | 'user';

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type UserInput = {
  id?: number;
  name: string;
  email: string;
  role: UserRole;
};

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '用户' },
];
