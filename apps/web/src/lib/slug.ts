/**
 * `slugify` sống ở `@tourism/ui` từ P4e-4 — bộ render markdown dùng chung cần nó. Bốn chỗ
 * của web (mục lục, FAQ, thân bài pháp lý) giữ đường import cũ qua file này, nên id
 * heading và anchor của mục lục luôn ra từ CÙNG một hàm.
 */
export { slugify } from '@tourism/ui/lib/slug';
