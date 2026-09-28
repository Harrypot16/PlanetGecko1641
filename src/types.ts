export interface VideoItem {
  videoId: string;
  title: string;
  author: string;
  authorId: string;
  description?: string;
  viewCount: number;
  likeCount?: number;
  subCountText?: string;
  lengthSeconds: number;
  published?: number;
  thumbnailUrl?: string;
  watchedAt?: number;
  note?: string;
  recommendReason?: string;
  isFromFavoriteCreator?: boolean;
}

export interface ChannelInfo {
  author: string;
  authorId: string;
  handle?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subCountText?: string;
  videoCountText?: string;
  description?: string;
  isVerified?: boolean;
}

export interface StreamQuality {
  quality: string;
  label: string;
  resolution: string;
  isHd: boolean;
}

export type PlayerMode = 'stream' | 'nocookie' | 'invidious';
