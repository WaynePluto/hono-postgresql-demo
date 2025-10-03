export type Model = {
  id: string;
  created_at: Date;
  updated_at: Date;
  data: {
    name: string;
  };
};

export type CreateTemplateRequest = Model["data"];

export type UpdateTemplateRequest = Partial<Model["data"]>;

export type TemplateDetailResponse = {
  id: string;
  created_at: string;
  updated_at: string;
} & Model["data"];

export type TemplateListResponse = {
  total: number;
  list: Array<Partial<TemplateDetailResponse>>;
};
