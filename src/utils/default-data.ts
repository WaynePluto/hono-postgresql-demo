import { CreatePermissionRequest } from "@/modules/permission/model";
import { CreateRoleRequest } from "@/modules/role/model";

/**
 * 默认权限列表
 */
export const defaultPermissions: CreatePermissionRequest[] = [
  // 用户管理权限
  {
    name: "创建用户",
    code: "user:create",
    description: "创建新用户",
    resource: "用户管理",
    type: "system",
  },
  {
    name: "查看用户",
    code: "user:read",
    description: "查看用户信息",
    resource: "用户管理",
    type: "system",
  },
  {
    name: "更新用户",
    code: "user:update",
    description: "更新用户信息",
    resource: "用户管理",
    type: "system",
  },
  {
    name: "删除用户",
    code: "user:delete",
    description: "删除用户",
    resource: "用户管理",
    type: "system",
  },
  {
    name: "用户列表",
    code: "user:list",
    description: "查看用户列表",
    resource: "用户管理",
    type: "system",
  },

  // 角色管理权限
  {
    name: "创建角色",
    code: "role:create",
    description: "创建新角色",
    resource: "角色管理",
    type: "system",
  },
  {
    name: "查看角色",
    code: "role:read",
    description: "查看角色信息",
    resource: "角色管理",
    type: "system",
  },
  {
    name: "更新角色",
    code: "role:update",
    description: "更新角色信息",
    resource: "角色管理",
    type: "system",
  },
  {
    name: "删除角色",
    code: "role:delete",
    description: "删除角色",
    resource: "角色管理",
    type: "system",
  },
  {
    name: "角色列表",
    code: "role:list",
    description: "查看角色列表",
    resource: "角色管理",
    type: "system",
  },

  // 权限管理权限
  {
    name: "创建权限",
    code: "permission:create",
    description: "创建新权限",
    resource: "权限管理",
    type: "system",
  },
  {
    name: "查看权限",
    code: "permission:read",
    description: "查看权限信息",
    resource: "权限管理",
    type: "system",
  },
  {
    name: "更新权限",
    code: "permission:update",
    description: "更新权限信息",
    resource: "权限管理",
    type: "system",
  },
  {
    name: "删除权限",
    code: "permission:delete",
    description: "删除权限",
    resource: "权限管理",
    type: "system",
  },
  {
    name: "权限列表",
    code: "permission:list",
    description: "查看权限列表",
    resource: "权限管理",
    type: "system",
  },
];

/**
 * 默认角色列表
 */
export const defaultRoles: CreateRoleRequest[] = [
  {
    name: "超级管理员",
    code: "super_admin",
    description: "拥有系统所有权限的超级管理员角色",
    type: "system",
    // 注意：不在此处指定权限，而是在运行时动态获取所有权限
  },
  {
    name: "管理员",
    code: "admin",
    description: "拥有除权限管理外的所有管理权限",
    permission_codes: [
      "user:create",
      "user:read",
      "user:update",
      "user:delete",
      "user:list",
      "role:create",
      "role:read",
      "role:update",
      "role:delete",
      "role:list",
    ],
    type: "system",
  },
  {
    name: "普通用户",
    code: "user",
    description: "普通用户角色，拥有基本的查看和操作自己数据的权限",
    permission_codes: ["user:read", "user:update"],
    type: "system",
  },
  {
    name: "访客",
    code: "guest",
    description: "访客角色，只拥有最基本的查看权限",
    permission_codes: [],
    type: "system",
  },
];
