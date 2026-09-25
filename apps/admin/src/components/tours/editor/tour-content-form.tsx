'use client';

import {
  type AdminTourDetail,
  TOUR_FAQS_MAX,
  TOUR_POLICIES_MAX,
  TourEditorPolicyKindSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import { ListEditor } from '@/components/kit/list-editor';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { newItemKey } from '@/lib/list-editor';
import {
  type ContentContractCode,
  type ContentFormErrors,
  type ContentFormValues,
  contentErrorCopy,
  contentFormValues,
  contentPayload,
  droppedCancellationCount,
  type FaqDraft,
  hasNestedErrors,
  type PolicyDraft,
  type SetContentAction,
  sameValues,
  validateContentForm,
} from '@/lib/tour-editor-write';
import { useSectionSave } from '@/lib/use-section-save';

/**
 * Tab FAQ & policies (spec F17 §2h): hai khung sửa danh sách, một nút Save.
 * Cùng khuôn `TourDetailsForm` (state `base`, `values`, `version`).
 *
 * - Chính sách huỷ KHÔNG nhập ở đây: nó sinh ra từ độ dài chuyến (ADR-0041), nên
 *   một dòng ghi chú luôn nói điều đó.
 * - Dữ liệu cũ còn chính sách loại `CANCELLATION` thì form không mang nó, và lưu
 *   tab này sẽ xoá nó — không được im lặng: một câu báo số dòng sẽ mất.
 * - Tab này không đụng readiness: bản dự tính là readiness hiện tại của tour.
 */
const t = messages.admin.tours.editor.content;

const KIND_OPTIONS = TourEditorPolicyKindSchema.options.map((kind) => ({
  value: kind,
  label: t.kinds[kind],
}));

export function TourContentForm({
  detail,
  save: saveAction,
}: {
  detail: AdminTourDetail;
  save: SetContentAction;
}) {
  const [base, setBase] = useState<ContentFormValues>(() => contentFormValues(detail));
  const [values, setValues] = useState<ContentFormValues>(base);
  const [version, setVersion] = useState(detail.version);
  const [showValidation, setShowValidation] = useState(false);

  const errors: ContentFormErrors = showValidation ? validateContentForm(values) : {};
  const dirty = !sameValues(values, base);
  const dropped = droppedCancellationCount(detail);

  const { pending, banner, save } = useSectionSave<ContentContractCode>({
    copy: contentErrorCopy,
    slug: detail.slug,
    projected: () => detail.readiness,
    onSaved: (next) => {
      const fresh = contentFormValues(next);
      setBase(fresh);
      setValues(fresh);
      setVersion(next.version);
      setShowValidation(false);
    },
  });

  function patch(next: Partial<ContentFormValues>) {
    setValues((current) => ({ ...current, ...next }));
  }

  function patchFaq(key: string, next: Partial<FaqDraft>) {
    patch({ faqs: values.faqs.map((faq) => (faq.key === key ? { ...faq, ...next } : faq)) });
  }

  function patchPolicy(key: string, next: Partial<PolicyDraft>) {
    patch({
      policies: values.policies.map((policy) =>
        policy.key === key ? { ...policy, ...next } : policy,
      ),
    });
  }

  function submit() {
    setShowValidation(true);
    if (hasNestedErrors(validateContentForm(values))) return;
    void save(() => saveAction(contentPayload(detail.id, version, values)));
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame dirty={dirty} pending={pending} banner={banner} onSubmit={submit}>
        <fieldset className="grid gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t.faqTitle}</legend>
          <ListEditor<FaqDraft>
            items={values.faqs}
            onChange={(faqs) => patch({ faqs })}
            max={TOUR_FAQS_MAX}
            newItem={() => ({ key: newItemKey(), question: '', answer: '' })}
            addLabel={t.addFaq}
            itemName={(index) => t.faqName(index + 1)}
            disabled={pending}
            empty={t.emptyFaq}
            renderItem={(faq) => {
              const faqErrors = errors[faq.key];
              return (
                <>
                  <FormField
                    id={`faq-${faq.key}-question`}
                    label={t.question}
                    error={faqErrors?.question}
                  >
                    {(describedBy) => (
                      <Input
                        id={`faq-${faq.key}-question`}
                        value={faq.question}
                        disabled={pending}
                        aria-invalid={faqErrors?.question !== undefined}
                        aria-describedby={describedBy}
                        onChange={(event) => patchFaq(faq.key, { question: event.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField
                    id={`faq-${faq.key}-answer`}
                    label={t.answer}
                    error={faqErrors?.answer}
                  >
                    {(describedBy) => (
                      <Textarea
                        id={`faq-${faq.key}-answer`}
                        rows={3}
                        value={faq.answer}
                        disabled={pending}
                        aria-invalid={faqErrors?.answer !== undefined}
                        aria-describedby={describedBy}
                        onChange={(event) => patchFaq(faq.key, { answer: event.target.value })}
                      />
                    )}
                  </FormField>
                </>
              );
            }}
          />
        </fieldset>

        <fieldset className="grid gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t.policiesTitle}</legend>
          <p className="text-xs text-muted-foreground">{t.cancellationNote}</p>
          {dropped > 0 ? (
            // Giọng CẢNH BÁO: lưu được, chỉ là dòng cũ ấy sẽ mất.
            <p className="text-sm">{t.droppedCancellation(dropped)}</p>
          ) : null}
          <ListEditor<PolicyDraft>
            items={values.policies}
            onChange={(policies) => patch({ policies })}
            max={TOUR_POLICIES_MAX}
            // Ô chọn loại luôn phải mang một giá trị — mặc định là mục đầu, Booking.
            newItem={() => ({
              key: newItemKey(),
              kind: 'BOOKING',
              title: '',
              body: '',
            })}
            addLabel={t.addPolicy}
            itemName={(index) => t.policyName(index + 1)}
            disabled={pending}
            empty={t.emptyPolicies}
            renderItem={(policy) => {
              const policyErrors = errors[policy.key];
              return (
                <>
                  <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <FormField id={`policy-${policy.key}-kind`} label={t.kind}>
                      {(describedBy) => (
                        <FormSelect
                          id={`policy-${policy.key}-kind`}
                          value={policy.kind}
                          options={KIND_OPTIONS}
                          // Ô này luôn mang một giá trị nên câu giữ chỗ không bao giờ hiện.
                          placeholder={t.kind}
                          disabled={pending}
                          describedBy={describedBy}
                          onValueChange={(kind) =>
                            patchPolicy(policy.key, { kind: kind as PolicyDraft['kind'] })
                          }
                        />
                      )}
                    </FormField>
                    <FormField
                      id={`policy-${policy.key}-title`}
                      label={t.policyTitle}
                      error={policyErrors?.title}
                    >
                      {(describedBy) => (
                        <Input
                          id={`policy-${policy.key}-title`}
                          value={policy.title}
                          disabled={pending}
                          aria-invalid={policyErrors?.title !== undefined}
                          aria-describedby={describedBy}
                          onChange={(event) =>
                            patchPolicy(policy.key, { title: event.target.value })
                          }
                        />
                      )}
                    </FormField>
                  </div>
                  <FormField
                    id={`policy-${policy.key}-body`}
                    label={t.policyBody}
                    error={policyErrors?.body}
                  >
                    {(describedBy) => (
                      <Textarea
                        id={`policy-${policy.key}-body`}
                        rows={4}
                        value={policy.body}
                        disabled={pending}
                        aria-invalid={policyErrors?.body !== undefined}
                        aria-describedby={describedBy}
                        onChange={(event) => patchPolicy(policy.key, { body: event.target.value })}
                      />
                    )}
                  </FormField>
                </>
              );
            }}
          />
        </fieldset>
      </EditorFormFrame>
    </div>
  );
}
