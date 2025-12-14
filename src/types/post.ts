export type Post = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  authorId?: string | null;
};
