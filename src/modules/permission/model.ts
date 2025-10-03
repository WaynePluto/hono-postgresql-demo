export type Permission = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    name: string;
    code: string;
    description?: string;
  };
};

export type CreatePermissionRequest = Permission["data"];

export type UpdatePermissionRequest = Partial<Permission["data"]>;

export type PermissionDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Permission["data"];

export type PermissionListResponse = {
  total: number;
  list: Array<Partial<PermissionDetailResponse>>;
};