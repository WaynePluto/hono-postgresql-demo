export type Role = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    name: string;
    code: string;
    description?: string;
    permission_ids?: string[];
  };
};

export type CreateRoleRequest = Role["data"];

export type UpdateRoleRequest = Partial<Role["data"]>;

export type RoleDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Omit<Role["data"], "permission_ids"> & {
    permission_ids: string[];
  };

export type RoleListResponse = {
  total: number;
  list: Array<Partial<RoleDetailResponse>>;
};