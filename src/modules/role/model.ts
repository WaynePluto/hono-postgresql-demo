export type Role = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    name: string;
    code: string;
    description?: string;
    permission_codes?: string[];
  };
};

export type CreateRoleRequest = Role["data"];

export type UpdateRoleRequest = Partial<Role["data"]>;

export type RoleDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Role["data"];

export type RoleListResponse = {
  total: number;
  list: Array<Partial<RoleDetailResponse>>;
};
