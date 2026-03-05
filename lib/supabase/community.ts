// lib/supabase/community.ts
// 코인 분석 커뮤니티 게시판 - 기존 posts 테이블 사용
// content 첫 줄에 ##COMMUNITY:SYMBOL## 메타데이터 삽입

import { supabase } from '../supabase';
import { Post } from './types';

export const COMMUNITY_MARKER = '##BITDOT_COMMUNITY';

export interface CommunityPost extends Post {
  coinSymbol: string;
  bodyContent: string; // 메타데이터 제거된 실제 내용
}

// content에서 코인 심볼 파싱
export function parseCommunityContent(content: string): { coinSymbol: string; bodyContent: string } {
  const firstLine = content.split('\n')[0];
  const match = firstLine.match(/^##BITDOT_COMMUNITY:([A-Z0-9]+)##$/);
  if (match) {
    return {
      coinSymbol: match[1],
      bodyContent: content.slice(firstLine.length + 1), // \n 포함 제거
    };
  }
  return { coinSymbol: '', bodyContent: content };
}

export function buildCommunityContent(coinSymbol: string, body: string): string {
  return `##BITDOT_COMMUNITY:${coinSymbol.toUpperCase().trim()}##\n${body}`;
}

function toPost(raw: Post): CommunityPost {
  const { coinSymbol, bodyContent } = parseCommunityContent(raw.content);
  return { ...raw, coinSymbol, bodyContent };
}

export async function getCommunityPosts(
  pageSize = 20,
  offset = 0,
  coinFilter?: string
): Promise<{ posts: CommunityPost[]; totalCount: number; hasMore: boolean }> {
  const { data, error, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('is_deleted', false)
    .like('content', `${COMMUNITY_MARKER}%`)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  let posts = (data || []).map(toPost);
  if (coinFilter) {
    const upper = coinFilter.toUpperCase();
    posts = posts.filter((p) => p.coinSymbol === upper);
  }

  return {
    posts,
    totalCount: count || 0,
    hasMore: (count || 0) > offset + pageSize,
  };
}

export async function getCommunityPostById(postId: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return toPost(data as Post);
}

export async function createCommunityPost(input: {
  title: string;
  content: string;
  coinSymbol: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_photo_url?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        title: input.title,
        content: buildCommunityContent(input.coinSymbol, input.content),
        author_id: input.author_id,
        author_name: input.author_name,
        author_email: input.author_email,
        author_photo_url: input.author_photo_url,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data.id;
}
