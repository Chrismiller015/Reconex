"use client";

import { apiClient } from "@/lib/axios";
import { useRealtimePosts } from "@/hooks/useRealtimePosts";
import { Post } from "@/types/post";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";

const fetchPosts = async (): Promise<Post[]> => {
  const response = await apiClient.get<Post[]>("/posts");
  return response.data;
};

export const PostList = () => {
  const queryClient = useQueryClient();
  const queryKey = ["posts"] as const;

  const query = useQuery({ queryKey, queryFn: fetchPosts });

  useRealtimePosts(() => {
    queryClient.invalidateQueries({ queryKey });
  });

  if (query.isPending) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rectangular" height={80} />
        <Skeleton variant="rectangular" height={80} />
      </Stack>
    );
  }

  if (query.isError) {
    return <Alert severity="error">Failed to load posts. {query.error.message}</Alert>;
  }

  if (!query.data.length) {
    return <Alert severity="info">No posts yet. Create one to see it appear instantly.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {query.data.map((post) => (
        <Card key={post.id} variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h6">{post.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(post.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="body1">{post.content}</Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
