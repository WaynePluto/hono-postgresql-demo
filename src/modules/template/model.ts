export type Model = {
  id: number;
  created_at: Date;
  updated_at: Date;
  data: {
    open_id: string;
    name?: string;
  };
};
