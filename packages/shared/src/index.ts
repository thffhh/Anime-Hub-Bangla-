export type UserRole =
  | "SUPER_ADMIN" | "ADMIN" | "CONTENT_MANAGER"
  | "ADVERTISEMENT_MANAGER" | "COLLABORATION_MANAGER"
  | "MODERATOR" | "ANALYST" | "USER";

export interface Anime {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  synopsis?: string;
  posterUrl?: string;
  bannerUrl?: string;
  releaseYear?: number;
  status: "ONGOING" | "COMPLETED" | "UPCOMING" | "HIATUS";
  contentType: "LICENSED" | "ORIGINAL" | "PARTNER";
  genres: string[];
  published: boolean;
}
