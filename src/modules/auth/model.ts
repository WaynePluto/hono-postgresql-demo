export type User = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    username: string;
    // 前端传来的经过MD5的密文
    password: string;
    email?: string;
    nickname?: string;
    role_ids?: string[];
  };
};

export type LoginRequest = {
  username: string;
  // 前端传来的经过MD5的密文
  password: string;
};

export type LoginResponse = {
  token: string;
  refresh_token: string;
  user: {
    id: string;
  } & Omit<User["data"], "password">;
};

export type RefreshTokenResponse = {
  token: string;
  refresh_token: string;
};

export type MeResponse = {
  id: string;
} & Omit<User["data"], "password">;
