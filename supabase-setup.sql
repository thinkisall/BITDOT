-- Supabase 게시판 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. posts 테이블 생성
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 2. comments 테이블 생성
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_is_deleted ON posts(is_deleted);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- 4. Row Level Security (RLS) 활성화
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 - Posts (Firebase Auth 사용으로 간단하게 설정)
-- 모두 읽기 가능 (삭제되지 않은 글만)
CREATE POLICY "Anyone can read non-deleted posts"
  ON posts FOR SELECT
  USING (is_deleted = FALSE);

-- 모두 작성/수정/삭제 가능 (클라이언트에서 Firebase Auth로 검증)
CREATE POLICY "Anyone can insert posts"
  ON posts FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can update posts"
  ON posts FOR UPDATE
  USING (TRUE);

CREATE POLICY "Anyone can delete posts"
  ON posts FOR DELETE
  USING (TRUE);

-- 6. RLS 정책 - Comments
-- 모두 읽기 가능 (삭제되지 않은 댓글만)
CREATE POLICY "Anyone can read non-deleted comments"
  ON comments FOR SELECT
  USING (is_deleted = FALSE);

-- 모두 작성/삭제 가능 (클라이언트에서 Firebase Auth로 검증)
CREATE POLICY "Anyone can insert comments"
  ON comments FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can delete comments"
  ON comments FOR DELETE
  USING (TRUE);

-- 7. 댓글 수 자동 업데이트를 위한 함수
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_deleted = FALSE THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    UPDATE posts SET comment_count = comment_count - 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.is_deleted = FALSE THEN
    UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
CREATE TRIGGER trigger_update_comment_count
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- 9. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. updated_at 트리거
CREATE TRIGGER trigger_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. 조회수 증가 함수 (선택사항 - RPC 사용 시)
CREATE OR REPLACE FUNCTION increment_view_count(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
