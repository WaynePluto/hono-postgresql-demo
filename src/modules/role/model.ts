export type Role = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    name: string;
    code: string;
    description?: string;
    permission_codes?: string[];
    type: 'system' | 'custom'; // 系统默认角色或用户自定义角色
  };
};

export type CreateRoleRequest = Omit<Role["data"], 'type'> & { type?: 'system' | 'custom' };

export type UpdateRoleRequest = Partial<Omit<Role["data"], 'type'>>;

export type RoleDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Role["data"];

export type RoleListResponse = {
  total: number;
  list: Array<Partial<RoleDetailResponse>>;
};