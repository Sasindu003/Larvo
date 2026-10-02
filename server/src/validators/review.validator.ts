import { z } from 'zod';

export const CreateReviewSchema = z.object({
  rating: z
    .number({ required_error: 'Rating is required' })
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars'),
  title: z
    .string({ required_error: 'Review title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title cannot exceed 120 characters'),
  comment: z
    .string({ required_error: 'Review comment is required' })
    .trim()
    .min(5, 'Comment must be at least 5 characters')
    .max(2000, 'Comment cannot exceed 2000 characters'),
  photos: z
    .array(z.string().trim())
    .max(5, 'Maximum 5 photos allowed per review')
    .optional()
    .default([]),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const AdminReplySchema = z.object({
  text: z
    .string({ required_error: 'Reply text is required' })
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply cannot exceed 2000 characters'),
});

export type AdminReplyInput = z.infer<typeof AdminReplySchema>;

export const UpdateReviewStatusSchema = z.object({
  status: z.enum(['published', 'hidden', 'flagged'], {
    required_error: 'Valid status (published, hidden, flagged) is required',
  }),
});

export type UpdateReviewStatusInput = z.infer<typeof UpdateReviewStatusSchema>;

export const VoteReviewSchema = z.object({
  vote: z.enum(['up', 'down', 'remove'], {
    required_error: "Vote must be 'up', 'down', or 'remove'",
  }),
});

export type VoteReviewInput = z.infer<typeof VoteReviewSchema>;
