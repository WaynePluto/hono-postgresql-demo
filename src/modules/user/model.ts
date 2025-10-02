export type User = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    username: string;
    password: string;
    email?: string;
    nickname?: string;
    role_ids?: string[];
  };
};

export type CreateUserRequest = {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
  role_ids?: string[];
};

export type UpdateUserRequest = {
  username?: string;
  email?: string;
  nickname?: string;
  role_ids?: string[];
};

export type UserListResponse = {
  total: number;
  list: Array<{
    id: string;
    username: string;
    email?: string;
    nickname?: string;
    role_ids?: string[];
    created_at: Date;
    updated_at: Date;
  }>;
};

export type UserDetailResponse = {
  id: string;
  username: string;
  email?: string;
  nickname?: string;
  role_ids?: string[];
  created_at: Date;
  updated_at: Date;
};
