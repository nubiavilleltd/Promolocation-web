import type { ApiId } from "./promoter-brands";

export type PromotionStatus = "active" | "scheduled" | "inactive" | "expired";

export type RawPromotion = {
  id: ApiId;
  promotion_code?: string | null;
  name: string;
  description?: string | null;
  promotion_image?: string | null;
  start_date: string;
  end_date: string;
  status?: PromotionStatus | string | null;
  is_active?: number | string | boolean | null;
  agency_id?: ApiId | null;
  agency?: string | null;
  agency_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Promotion = {
  id: ApiId;
  promotionCode: string;
  name: string;
  description: string;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  isActive: boolean;
  agencyId: string;
  agencyName: string;
  agency: string;
  createdAt: string | null;
  updatedAt: string | null;
  assignments: PromotionAssignment[];
};

export type PromotionAssignment = {
  id: ApiId;
  row?: number;
  promotionCode?: string;
  promoterId: string;
  brandName: string;
  qrPath: string;
  brandImageUrl?: string | null;
  promotionName?: string | null;
  promotionActive?: boolean;
  createdAt?: string;
  lastModified?: string;
};

export type ListPromotionsResponse = {
  status: number | string;
  message: string;
  total: number;
  page: number;
  per_page: number;
  promotions: RawPromotion[];
};

export type ManagePromotionResponse = {
  status: number | string;
  message: string;
  promotion?: RawPromotion;
  promotion_id?: ApiId;
};

export type ListPromotionsPayload = {
  page?: number;
  perPage?: number;
};

export type CreatePromotionPayload = {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status?: PromotionStatus;
  isActive?: boolean;
  agencyId?: string;
};

export type UpdatePromotionPayload = {
  id: ApiId;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: PromotionStatus;
  isActive?: boolean;
  agencyId?: string;
};

export type DeletePromotionPayload = {
  id: ApiId;
};

export type UploadPromotionQrCodesPayload = {
  file: File;
  promotionCode: string;
};

export type UploadPromotionQrCodesResponse = {
  status: number | string;
  message: string;
  [key: string]: unknown;
};

export type RawPromotionBrand = {
  id: ApiId;
  promoter_id?: string | null;
  brand?: string | null;
  promo_URL?: string | null;
  brand_image?: string | null;
  promotion_code?: string | null;
  promotion_name?: string | null;
  promotion_active?: number | string | boolean | null;
  created_at?: string | null;
  last_modified?: string | null;
};

export type GetPromotionBrandsPayload = {
  promotionCode: string;
};

export type GetPromotionBrandsResponse = {
  status: number | string;
  message: string;
  promotion_code?: string | null;
  promotion_name?: string | null;
  total: number;
  brands: RawPromotionBrand[];
};

export type RawQrCodeRecord = {
  id?: ApiId | null;
  qr_code?: string | null;
  qrCode?: string | null;
  code?: string | null;
  filename?: string | null;
  file_name?: string | null;
  promo_URL?: string | null;
  promo_url?: string | null;
  qr_url?: string | null;
  qr_image?: string | null;
  file_url?: string | null;
  promoter_id?: string | null;
  promoter_code?: string | null;
  promotion_code?: string | null;
  promotion_name?: string | null;
  promotion_status?: string | null;
  promotion_active?: number | string | boolean | null;
  agency_id?: ApiId | null;
  agency?: string | null;
  agency_name?: string | null;
  promo_type?: string | null;
  brand?: string | null;
  brand_name?: string | null;
  promoter_name?: string | null;
  promoter_email?: string | null;
  promoter_phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type QrCodeRecord = {
  id: ApiId;
  code: string;
  fileName: string;
  imageUrl: string | null;
  promoterId: string;
  promoterName: string;
  promoterEmail: string;
  promoterPhone: string;
  promotionCode: string;
  promotionName: string;
  promotionStatus: string;
  promotionActive: boolean;
  agencyId: string;
  agencyName: string;
  agency: string;
  promoType: string;
  brandName: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ListQrCodesPayload = {
  promoterId?: string;
  promotionCode?: string;
  brand?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
};

export type ListQrCodesResponse = {
  status: number | string;
  message: string;
  total?: number;
  page?: number;
  per_page?: number;
  qr_codes?: RawQrCodeRecord[];
  qrCodes?: RawQrCodeRecord[];
  data?: RawQrCodeRecord[];
  results?: RawQrCodeRecord[];
};
