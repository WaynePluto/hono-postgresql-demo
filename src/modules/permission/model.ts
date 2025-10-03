export type Permission = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    name: string;
    code: string;
    description?: string;
    type: 'system' | 'custom'; // 系统默认权限或用户自定义权限
  };
};

export type CreatePermissionRequest = Omit<Permission["data"], 'type'> & { type?: 'system' | 'custom' };

export type UpdatePermissionRequest = Partial<Omit<Permission["data"], 'type'>>;

export type PermissionDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Permission["data"];

export type PermissionListResponse = {
  total: number;
  list: Array<Partial<PermissionDetailResponse>>;
};