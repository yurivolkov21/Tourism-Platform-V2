// Bề mặt TS của @tourism/tokens cho FE — vùng lãnh thổ (data-region).
// Giá trị màu KHÔNG nằm ở đây (nguồn: style-dictionary/tokens.mjs).
export const REGIONS = ['north', 'central', 'south'] as const;
export type Region = (typeof REGIONS)[number];
