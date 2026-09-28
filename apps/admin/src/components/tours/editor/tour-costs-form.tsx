'use client';

import {
  type AdminTourDetail,
  TOUR_COST_ITEMS_MAX,
  type TourCostBasis,
  TourCostBasisSchema,
  type TourCostCategory,
  TourCostCategorySchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import { ListEditor } from '@/components/kit/list-editor';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import { formatAmount } from '@/lib/bookings-view';
import { newItemKey } from '@/lib/list-editor';
import { costBreakdown } from '@/lib/tour-editor-view';
import {
  type CostDraft,
  type CostsContractCode,
  type CostsFormErrors,
  type CostsFormValues,
  costDraftItems,
  costsErrorCopy,
  costsFormValues,
  costsPayload,
  hasNestedErrors,
  type SetCostsAction,
  validateCostsForm,
} from '@/lib/tour-editor-write';
import { useSectionSave } from '@/lib/use-section-save';
import { useTourFormState } from '@/lib/use-tour-form-state';

/**
 * Tab Costs (spec F17 §2h): khung sửa danh sách dòng chi phí, và khung Totals
 * tính NGAY khi gõ bằng chính ba hàm giá vốn của contract mà API gọi lúc lưu —
 * màn hình và server không thể ra hai con số khác nhau. Không có ô nhập giá vốn:
 * nó luôn được tính lại (spec §2b.5).
 *
 * - Khung Totals có `aria-live="polite"` để trình đọc màn hình nghe tổng mới.
 * - Dòng đang gõ dở số tiền ("12.") bị bỏ qua khi cộng, không hiện `NaN`.
 * - Ghi chú cạnh nút Save nói hệ quả đã đo: chuyến và booking cũ giữ bản chụp chi
 *   phí của chúng.
 */
const t = messages.admin.tours.editor.costs;

const CATEGORY_OPTIONS = TourCostCategorySchema.options.map((category) => ({
  value: category,
  label: t.categories[category],
}));
const BASIS_OPTIONS = TourCostBasisSchema.options.map((basis) => ({
  value: basis,
  label: t.bases[basis],
}));

export function TourCostsForm({
  detail,
  save: saveAction,
}: {
  detail: AdminTourDetail;
  save: SetCostsAction;
}) {
  const publishSaved = usePublishSavedDetail();
  const form = useTourFormState<CostsFormValues>(detail, costsFormValues);
  const { values, version, dirty, showValidation } = form;

  const errors: CostsFormErrors = showValidation ? validateCostsForm(values) : {};
  const totals = costBreakdown(costDraftItems(values), detail.basePrice, detail.maxGroupSize);
  const money = (amount: string) => formatAmount(amount, detail.currency);

  const { pending, banner, save } = useSectionSave<CostsContractCode>({
    copy: costsErrorCopy,
    slug: detail.slug,
    version,
    projected: () => detail.readiness,
    onSaved: (next) => {
      form.adopt(next);
      // Phần đầu (readiness, công tắc) theo kịp ngay, không chờ lượt refresh.
      publishSaved(next);
    },
  });

  function patchItem(key: string, next: Partial<CostDraft>) {
    form.setValues((current) => ({
      items: current.items.map((item) => (item.key === key ? { ...item, ...next } : item)),
    }));
  }

  function submit() {
    form.setShowValidation(true);
    if (hasNestedErrors(validateCostsForm(values))) return;
    void save(() => saveAction(costsPayload(detail.id, version, values)));
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        note={t.note}
        onSubmit={submit}
        onReload={form.reload}
      >
        <ListEditor<CostDraft>
          items={values.items}
          onChange={(items) => form.setValues({ items })}
          max={TOUR_COST_ITEMS_MAX}
          // Hai ô chọn luôn phải mang một giá trị — mặc định là mục đầu của mỗi ô.
          newItem={() => ({
            key: newItemKey(),
            category: 'TRANSPORT',
            label: '',
            amount: '',
            basis: 'PER_PERSON',
          })}
          addLabel={t.addItem}
          itemName={(index) => t.itemName(index + 1)}
          disabled={pending}
          empty={t.empty}
          renderItem={(item) => {
            const itemErrors = errors[item.key];
            const field = (name: string) => `cost-${item.key}-${name}`;
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_8rem_10rem]">
                <FormField id={field('category')} label={t.category}>
                  {(describedBy) => (
                    <FormSelect
                      id={field('category')}
                      value={item.category}
                      options={CATEGORY_OPTIONS}
                      // Ô này luôn mang một giá trị nên câu giữ chỗ không bao giờ hiện.
                      placeholder={t.category}
                      disabled={pending}
                      describedBy={describedBy}
                      onValueChange={(category) =>
                        patchItem(item.key, { category: category as TourCostCategory })
                      }
                    />
                  )}
                </FormField>
                <FormField id={field('label')} label={t.label} error={itemErrors?.label}>
                  {(describedBy) => (
                    <Input
                      id={field('label')}
                      value={item.label}
                      disabled={pending}
                      aria-invalid={itemErrors?.label !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patchItem(item.key, { label: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField id={field('amount')} label={t.amount} error={itemErrors?.amount}>
                  {(describedBy) => (
                    <Input
                      id={field('amount')}
                      inputMode="decimal"
                      value={item.amount}
                      disabled={pending}
                      aria-invalid={itemErrors?.amount !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patchItem(item.key, { amount: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField id={field('basis')} label={t.basis}>
                  {(describedBy) => (
                    <FormSelect
                      id={field('basis')}
                      value={item.basis}
                      options={BASIS_OPTIONS}
                      placeholder={t.basis}
                      disabled={pending}
                      describedBy={describedBy}
                      onValueChange={(basis) =>
                        patchItem(item.key, { basis: basis as TourCostBasis })
                      }
                    />
                  )}
                </FormField>
              </div>
            );
          }}
        />

        <section
          aria-labelledby="tour-cost-totals"
          className="grid gap-3 rounded-lg border bg-muted/30 p-4"
        >
          <h3 id="tour-cost-totals" className="text-sm font-semibold">
            {t.totals.title}
          </h3>
          <div aria-live="polite">
            {totals.costPrice === null ? (
              <p className="text-sm text-muted-foreground">{t.totals.none}</p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">{t.totals.perPerson}</dt>
                <dd className="text-right tabular-nums">{money(totals.perPerson)}</dd>
                <dt className="text-muted-foreground">{t.totals.perDeparture}</dt>
                <dd className="text-right tabular-nums">{money(totals.perDeparture)}</dd>
                <dt className="text-muted-foreground">{t.totals.costPrice(detail.maxGroupSize)}</dt>
                <dd className="text-right font-medium tabular-nums">{money(totals.costPrice)}</dd>
                {totals.margin ? (
                  <>
                    <dt className="text-muted-foreground">{t.totals.margin}</dt>
                    <dd className="text-right tabular-nums">
                      {t.totals.marginValue(money(totals.margin.amount), totals.margin.percent)}
                    </dd>
                  </>
                ) : null}
              </dl>
            )}
          </div>
        </section>
      </EditorFormFrame>
    </div>
  );
}
