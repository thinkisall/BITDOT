// lib/supabase/users.ts
import { supabase } from '../supabase';

export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  isPremium: boolean;
  premiumUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  uid: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  is_premium: boolean;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 유저 정보 가져오기
 */
export async function getUser(uid: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    if (!data) return null;

    const row = data as UserRow;
    return {
      uid: row.uid,
      email: row.email,
      displayName: row.display_name,
      photoURL: row.photo_url,
      isPremium: row.is_premium || false,
      premiumUntil: row.premium_until ? new Date(row.premium_until) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

/**
 * 유저 생성 또는 업데이트 (로그인 시 자동 호출)
 */
export async function createOrUpdateUser(
  uid: string,
  email: string,
  displayName: string | null,
  photoURL: string | null
): Promise<User> {
  try {
    // 기존 유저 확인
    const existingUser = await getUser(uid);

    if (existingUser) {
      // 기존 유저 - 프로필 정보만 업데이트
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName,
          photo_url: photoURL,
          updated_at: new Date().toISOString(),
        })
        .eq('uid', uid);

      if (error) throw error;

      return {
        ...existingUser,
        displayName,
        photoURL,
        updatedAt: new Date(),
      };
    } else {
      // 신규 유저 - 기본값으로 생성
      const { error } = await supabase
        .from('users')
        .insert({
          uid,
          email,
          display_name: displayName,
          photo_url: photoURL,
          is_premium: false,
          premium_until: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return {
        uid,
        email,
        displayName,
        photoURL,
        isPremium: false,
        premiumUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

/**
 * 프리미엄 상태 업데이트
 */
export async function updatePremiumStatus(
  uid: string,
  isPremium: boolean,
  premiumUntil?: Date | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        is_premium: isPremium,
        premium_until: premiumUntil ? premiumUntil.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', uid);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating premium status:', error);
    throw error;
  }
}

/**
 * 프리미엄 만료 확인 (만료되었으면 자동으로 일반 유저로 변경)
 */
export async function checkPremiumExpiry(user: User): Promise<boolean> {
  if (!user.isPremium) return false;

  // 만료일이 없으면 영구 프리미엄
  if (!user.premiumUntil) return true;

  // 만료일 체크
  const now = new Date();
  if (user.premiumUntil < now) {
    // 만료됨 - 일반 유저로 변경
    await updatePremiumStatus(user.uid, false, null);
    return false;
  }

  return true;
}
