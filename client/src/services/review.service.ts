import api, { ApiResponse } from './api';

export interface ReviewAdminReply {
  text: string;
  repliedAt: string;
  repliedBy?: string;
}

export interface ReviewHelpfulVotes {
  up: string[];
  down: string[];
}

export interface Review {
  _id: string;
  product: string | { _id: string; name: string; slug: string; images: string[] };
  user: { _id: string; name: string; email?: string };
  order?: { _id: string; status: string; createdAt: string } | string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  status: 'published' | 'hidden' | 'flagged';
  photos: string[];
  helpfulVotes?: ReviewHelpfulVotes;
  helpfulScore: number;
  upvoteCount?: number;
  downvoteCount?: number;
  userVote?: 'up' | 'down' | null;
  adminReply?: ReviewAdminReply | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListResponse {
  items: Review[];
  results: number;
  total: number;
  page: number;
  pages: number;
  ratingDistribution: Record<number, number>;
  photoGallery: { photoUrl: string; reviewId: string; rating: number; userName: string }[];
}

export interface EligibilityResponse {
  canReview: boolean;
  reason?: 'already_reviewed' | 'not_purchased' | 'not_delivered';
  orderId?: string;
  existingReview?: Review | null;
  currentOrderStatus?: string;
}

export interface AdminReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  unansweredReviews: number;
  flaggedReviews: number;
  reviewsWithPhotos: number;
}

export interface AdminReviewListResponse {
  items: Review[];
  results: number;
  total: number;
  page: number;
  pages: number;
}

export interface CreateReviewDto {
  rating: number;
  title: string;
  comment: string;
  photos?: string[];
}

export const reviewService = {
  /**
   * Check if current user can review this product (must have delivered order)
   */
  async checkEligibility(productId: string): Promise<EligibilityResponse> {
    const res = await api.get<ApiResponse<EligibilityResponse>>(
      `/reviews/product/${productId}/eligibility`
    );
    return (res as any).data || (res as any);
  },

  /**
   * Get public reviews for product
   */
  async getProductReviews(
    productId: string,
    params?: {
      page?: number;
      limit?: number;
      sort?: string;
      withPhotos?: boolean;
    }
  ): Promise<ReviewListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.sort) query.append('sort', params.sort);
    if (params?.withPhotos !== undefined) query.append('withPhotos', String(params.withPhotos));

    const res = await api.get<ApiResponse<ReviewListResponse>>(
      `/reviews/product/${productId}?${query.toString()}`
    );
    return (res as any).data || (res as any);
  },

  /**
   * Submit a new review
   */
  async createReview(productId: string, data: CreateReviewDto): Promise<Review> {
    const res = await api.post<ApiResponse<Review>>(`/reviews/product/${productId}`, data);
    return (res as any).data || (res as any);
  },

  /**
   * Vote helpful/not helpful on review
   */
  async voteReview(reviewId: string, vote: 'up' | 'down' | 'remove'): Promise<Review> {
    const res = await api.patch<ApiResponse<Review>>(`/reviews/${reviewId}/vote`, { vote });
    return (res as any).data || (res as any);
  },

  /**
   * Upload photos to GridFS storage (max 5)
   */
  async uploadPhotos(files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const res = await api.post<ApiResponse<{ fileIds: string[]; urls: string[] }>>(
      '/files/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const payload = (res as any).data || (res as any);
    return payload?.fileIds || [];
  },

  /**
   * Admin: Get filtered review list
   */
  async getAdminReviews(params?: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    rating?: number | string;
    replyStatus?: string;
    withPhotos?: boolean;
    productId?: string;
  }): Promise<AdminReviewListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.q) query.append('q', params.q);
    if (params?.status) query.append('status', params.status);
    if (params?.rating) query.append('rating', String(params.rating));
    if (params?.replyStatus) query.append('replyStatus', params.replyStatus);
    if (params?.withPhotos !== undefined) query.append('withPhotos', String(params.withPhotos));
    if (params?.productId) query.append('productId', params.productId);

    const res = await api.get<ApiResponse<AdminReviewListResponse>>(
      `/reviews/admin?${query.toString()}`
    );
    return (res as any).data || (res as any);
  },

  /**
   * Admin: Get analytics
   */
  async getAdminAnalytics(): Promise<AdminReviewAnalytics> {
    const res = await api.get<ApiResponse<AdminReviewAnalytics>>('/reviews/admin/analytics');
    return (res as any).data || (res as any);
  },

  /**
   * Admin: Reply to review
   */
  async replyToReview(reviewId: string, text: string): Promise<Review> {
    const res = await api.post<ApiResponse<Review>>(`/reviews/admin/${reviewId}/reply`, { text });
    return (res as any).data || (res as any);
  },

  /**
   * Admin: Change status
   */
  async updateReviewStatus(
    reviewId: string,
    status: 'published' | 'hidden' | 'flagged'
  ): Promise<Review> {
    const res = await api.patch<ApiResponse<Review>>(`/reviews/admin/${reviewId}/status`, {
      status,
    });
    return (res as any).data || (res as any);
  },

  /**
   * Admin: Delete review
   */
  async deleteReview(reviewId: string): Promise<void> {
    await api.delete(`/reviews/admin/${reviewId}`);
  },
};

export default reviewService;
