export type FaqItem = { question: string; answer: string };
export type FaqCategory = { title: string; items: readonly FaqItem[] };

/**
 * Lọc catalogue FAQ theo từ khoá — khớp cả câu hỏi lẫn câu trả lời, bỏ nhóm
 * không còn câu nào. Tách khỏi component để test được mà không cần dựng DOM.
 */
export function filterFaqCategories(
  categories: readonly FaqCategory[],
  query: string,
): FaqCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories.map((category) => ({ ...category }));

  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        `${item.question} ${item.answer}`.toLowerCase().includes(q),
      ),
    }))
    .filter((category) => category.items.length > 0);
}
