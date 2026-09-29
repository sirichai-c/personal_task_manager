interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <nav className="pagination" aria-label="หน้ารายการงาน">
      <p>
        แสดง {firstItem.toLocaleString("th-TH")}–{lastItem.toLocaleString("th-TH")} จาก{" "}
        {totalItems.toLocaleString("th-TH")} งาน
      </p>
      <div className="pagination-controls">
        <button
          type="button"
          className="page-button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          ก่อนหน้า
        </button>
        <span aria-current="page">
          หน้า {page.toLocaleString("th-TH")} / {Math.max(totalPages, 1).toLocaleString("th-TH")}
        </span>
        <button
          type="button"
          className="page-button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          ถัดไป
        </button>
      </div>
    </nav>
  );
}

