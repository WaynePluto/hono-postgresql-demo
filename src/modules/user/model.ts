export type User = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    username: string;
    password: string;
    email?: string;
    nickname?: string;
    role_codes?: string[];
  };
};

export type CreateUserRequest = User["data"];

export type UpdateUserRequest = Partial<User["data"]>;

export type UserDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Omit<User["data"], "password">;

export type UserListResponse = {
  total: number;
  list: Array<Partial<UserDetailResponse>>;
};
