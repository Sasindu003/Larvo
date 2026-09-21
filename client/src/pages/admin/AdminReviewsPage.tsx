import React, { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare,
  Star,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Flag,
  Trash2,
  Reply,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  X,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  reviewService,
  Review,
  AdminReviewAnalytics,
} from '../../services/review.service';
import { useDebounce } from '../../hooks/useDebounce';

export const AdminReviewsPage: React.FC = () => {
  // ── State ────────────────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<AdminReviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'hidden' | 'flagged'>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [replyFilter, setReplyFilter] = useState<'all' | 'replied' | 'unreplied'>('all');
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);

  // Modals & Active Items
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [activeReviewForReply, setActiveReviewForReply] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Fetch Analytics ──────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await reviewService.getAdminAnalytics();
      setAnalytics(data);
    } catch {
      // Non-critical, fail silently or show error
    }
  }, []);

  // ── Fetch Reviews ────────────────────────────────────────────────────────────
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewService.getAdminReviews({
        page,
        limit: 10,
        q: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        replyStatus: replyFilter === 'all' ? undefined : replyFilter,
        withPhotos: withPhotosOnly || undefined,
      });

      setReviews(res.items || []);
      setTotalPages(res.pages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, ratingFilter, replyFilter, withPhotosOnly]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, ratingFilter, replyFilter, withPhotosOnly]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleStatusChange = async (
    reviewId: string,
    newStatus: 'published' | 'hidden' | 'flagged'
  ) => {
    try {
      const updated = await reviewService.updateReviewStatus(reviewId, newStatus);
      setReviews((prev) =>
        prev.map((r) => (r._id === reviewId ? { ...r, status: updated.status } : r))
      );
      toast.success(`Review set to ${newStatus}`);
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update review status');
    }
  };

  const handleOpenReplyModal = (review: Review) => {
    setActiveReviewForReply(review);
    setReplyText(review.adminReply?.text || '');
    setReplyModalOpen(true);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewForReply || !replyText.trim()) return;

    setSubmittingReply(true);
    try {
      const updated = await reviewService.replyToReview(
        activeReviewForReply._id,
        replyText.trim()
      );
      setReviews((prev) =>
        prev.map((r) => (r._id === activeReviewForReply._id ? { ...r, adminReply: updated.adminReply } : r))
      );
      toast.success('Reply posted successfully');
      setReplyModalOpen(false);
      setActiveReviewForReply(null);
      setReplyText('');
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this review?')) return;

    setDeletingId(reviewId);
    try {
      await reviewService.deleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r._id !== reviewId));
      toast.success('Review deleted permanently');
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    } finally {
      setDeletingId(null);
    }
  };

  const getProductInfo = (product: any) => {
    if (typeof product === 'object' && product !== null) {
      return {
        id: product._id,
        name: product.name || 'Product',
        slug: product.slug || '',
        image: product.images?.[0] || '',
      };
    }
    return { id: String(product), name: 'Product', slug: '', image: '' };
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-600">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Reviews & Ratings</h1>
              <p className="text-sm text-slate-500">
                Moderation module for customer product reviews, photo gallery, and official store replies.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchReviews();
              fetchAnalytics();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Analytics Metric Cards ────────────────────────────────────────── */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Average Rating
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {analytics.averageRating.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-slate-400">/ 5.0</span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(analytics.averageRating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Reviews
              </span>
              <div className="mt-2">
                <span className="text-3xl font-bold text-slate-900">{analytics.totalReviews}</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">All submitted customer reviews</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Needs Reply
              </span>
              <div className="mt-2">
                <span className="text-3xl font-bold text-amber-600">
                  {analytics.unansweredReviews}
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-2">Awaiting store response</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Flagged
              </span>
              <div className="mt-2">
                <span className="text-3xl font-bold text-rose-600">{analytics.flaggedReviews}</span>
              </div>
              <span className="text-xs text-slate-500 mt-2">Requires admin attention</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                With Photos
              </span>
              <div className="mt-2">
                <span className="text-3xl font-bold text-indigo-600">
                  {analytics.reviewsWithPhotos}
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-2">Customer uploaded images</span>
            </div>
          </div>
        )}

        {/* ── Filters & Search Controls ──────────────────────────────────────── */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reviews by title or comment content..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Rating Filter */}
            <div className="w-full md:w-44">
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                aria-label="Filter by star rating"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white font-medium text-slate-700"
              >
                <option value="all">All Stars (★)</option>
                <option value="5">5 Stars only</option>
                <option value="4">4 Stars only</option>
                <option value="3">3 Stars only</option>
                <option value="2">2 Stars only</option>
                <option value="1">1 Star only</option>
              </select>
            </div>

            {/* Reply Status Filter */}
            <div className="w-full md:w-44">
              <select
                value={replyFilter}
                onChange={(e) => setReplyFilter(e.target.value as any)}
                aria-label="Filter by store reply status"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white font-medium text-slate-700"
              >
                <option value="all">All Reply Status</option>
                <option value="unreplied">Needs Reply</option>
                <option value="replied">Replied</option>
              </select>
            </div>
          </div>

          {/* Status Tabs & With-Photos checkbox */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'published', 'hidden', 'flagged'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={withPhotosOnly}
                onChange={(e) => setWithPhotosOnly(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              Only reviews with photos
            </label>
          </div>
        </div>

        {/* ── Reviews List ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 shadow-sm text-center max-w-md mx-auto">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No reviews found</h3>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search query, status tabs, or star rating filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const product = getProductInfo(review.product);
              const authorName = review.user?.name || 'Customer';
              const authorEmail = review.user?.email || '';

              return (
                <div
                  key={review._id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-6 space-y-4">
                    {/* Top Row: Product info + Status badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        {product.image ? (
                          <img
                            src={
                              product.image.startsWith('http') || product.image.startsWith('/api/')
                                ? product.image
                                : `/api/files/${product.image}`
                            }
                            alt={product.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900 truncate">
                              {product.name}
                            </h2>
                            {product.slug && (
                              <a
                                href={`/products/${product.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                                title="View Product Page"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-medium text-slate-700">{authorName}</span>
                            {authorEmail && <span>• {authorEmail}</span>}
                            <span>• {new Date(review.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Badges & Status */}
                      <div className="flex items-center gap-2 shrink-0">
                        {review.verifiedPurchase && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Verified Purchase
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                            review.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : review.status === 'hidden'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {review.status}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Star Rating + Title + Comment */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {review.rating} out of 5
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">•</span>
                        <span className="text-sm font-bold text-slate-900">{review.title}</span>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {review.comment}
                      </p>
                    </div>

                    {/* Photos Strip (if uploaded) */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Customer Photos ({review.photos.length})
                        </span>
                        <div className="flex flex-wrap gap-2.5">
                          {review.photos.map((photoId, idx) => {
                            const photoSrc =
                              photoId.startsWith('http') || photoId.startsWith('/api/files/')
                                ? photoId
                                : `/api/files/${photoId}`;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveLightboxImage(photoSrc)}
                                className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
                              >
                                <img
                                  src={photoSrc}
                                  alt={`Review attachment ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Official Store Reply (if present) */}
                    {review.adminReply?.text && (
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-amber-800 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Reply className="w-3.5 h-3.5 rotate-180 text-amber-600" />
                            Official Store Reply
                          </span>
                          <span className="text-amber-700/80 font-normal">
                            {new Date(review.adminReply.repliedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                          {review.adminReply.text}
                        </p>
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      {/* Helpful score */}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                          {review.helpfulVotes?.up?.length || 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ThumbsDown className="w-3.5 h-3.5 text-slate-400" />
                          {review.helpfulVotes?.down?.length || 0}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-medium text-slate-600">
                          Score: {review.helpfulScore || 0}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {/* Reply Button */}
                        <button
                          onClick={() => handleOpenReplyModal(review)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Reply className="w-3.5 h-3.5 rotate-180" />
                          {review.adminReply?.text ? 'Edit Reply' : 'Reply'}
                        </button>

                        {/* Status Toggle buttons */}
                        {review.status !== 'published' && (
                          <button
                            onClick={() => handleStatusChange(review._id, 'published')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Publish
                          </button>
                        )}

                        {review.status !== 'hidden' && (
                          <button
                            onClick={() => handleStatusChange(review._id, 'hidden')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            Hide
                          </button>
                        )}

                        {review.status !== 'flagged' && (
                          <button
                            onClick={() => handleStatusChange(review._id, 'flagged')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            Flag
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteReview(review._id)}
                          disabled={deletingId === review._id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">
                  Showing page <span className="font-bold text-slate-800">{page}</span> of{' '}
                  <span className="font-bold text-slate-800">{totalPages}</span> ({totalCount} total
                  reviews)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Reply Modal ───────────────────────────────────────────────────── */}
        {replyModalOpen && activeReviewForReply && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Reply className="w-4 h-4 rotate-180 text-amber-600" />
                  Official Store Reply
                </h3>
                <button
                  onClick={() => {
                    setReplyModalOpen(false);
                    setActiveReviewForReply(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReply} className="p-5 space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    Review by {activeReviewForReply.user?.name || 'Customer'}:
                  </div>
                  <div className="text-slate-600 italic line-clamp-2">
                    "{activeReviewForReply.comment}"
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Store Response
                  </label>
                  <textarea
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a professional, helpful response from Larvo customer care..."
                    required
                    maxLength={2000}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all resize-none"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>This reply will be publicly visible under the review.</span>
                    <span>{replyText.length}/2000</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyModalOpen(false);
                      setActiveReviewForReply(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReply || !replyText.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submittingReply && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Post Official Reply
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Photo Lightbox Modal ───────────────────────────────────────────── */}
        {activeLightboxImage && (
          <div
            onClick={() => setActiveLightboxImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm cursor-zoom-out animate-fadeIn"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-3xl max-h-[85vh] bg-transparent rounded-2xl overflow-hidden cursor-default"
            >
              <button
                type="button"
                onClick={() => setActiveLightboxImage(null)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900 transition-colors shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={activeLightboxImage}
                alt="Enlarged review photo"
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReviewsPage;
