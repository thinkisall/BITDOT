import { useState, useMemo, useCallback } from "react";

interface UsePaginationOptions<T> {
  items: T[];
  itemsPerPage: number;
  initialPage?: number;
}

export function usePagination<T>({
  items,
  itemsPerPage,
  initialPage = 1,
}: UsePaginationOptions<T>) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / itemsPerPage)),
    [items.length, itemsPerPage]
  );

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    },
    [totalPages]
  );

  return { currentPage, totalPages, paginatedItems, goToPage };
}
