"use client";

import { Button } from "@/components/ui/Button";
import { createPostAction } from "@/app/actions/postActions";
import { CreatePostInput, createPostSchema } from "@/lib/validators/post";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Stack, TextField } from "@mui/material";
import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";

export const CreatePostForm = () => {
  const [isPending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: "", content: "", published: true },
  });

  const onSubmit = handleSubmit((values) => {
    setServerMessage(null);
    setServerError(null);
    startTransition(async () => {
      const result = await createPostAction(values);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      setServerMessage(result?.message ?? "Post created");
      reset();
    });
  });

  return (
    <form onSubmit={onSubmit}>
      <Stack spacing={2}>
        {serverMessage && <Alert severity="success">{serverMessage}</Alert>}
        {serverError && <Alert severity="error">{serverError}</Alert>}
        <TextField
          label="Title"
          placeholder="An engaging headline"
          error={!!errors.title}
          helperText={errors.title?.message}
          {...register("title")}
        />
        <TextField
          label="Content"
          placeholder="Share more about this post"
          minRows={4}
          multiline
          error={!!errors.content}
          helperText={errors.content?.message}
          {...register("content")}
        />
        <Button type="submit" variant="contained" loading={isPending}>
          Create Post
        </Button>
      </Stack>
    </form>
  );
};
