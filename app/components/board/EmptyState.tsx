'use client';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16">
      <div className="text-center">
        <div className="text-4xl sm:text-6xl mb-4">📝</div>
        <h3 className="text-base sm:text-lg font-medium text-white mb-2">
          아직 게시글이 없습니다
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400">
          첫 번째 게시글을 작성해보세요!
        </p>
      </div>
    </div>
  );
}
